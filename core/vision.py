from ultralytics import YOLO
import cv2
import config
import time
import os
from datetime import datetime
try:
    from deepface import DeepFace
except Exception as e:
    print(f"DeepFace failed to load: {e}")

class VisionEngine:
    def __init__(self, model_path=None):
        """
        Initialize YOLOv8 model.
        Auto-downloads 'yolov8n.pt' if not present.
        """
        if model_path is None:
            model_path = config.MODEL_PATH
            
        # Fallback to standard YOLOv8 nano if custom model is missing (e.g. on fresh git clone)
        if not os.path.exists(model_path):
            print(f"Warning: Custom model {model_path} not found. Falling back to standard 'yolov8n.pt' which will auto-download.")
            model_path = "yolov8n.pt"
            
        self.model = YOLO(model_path)
        
        # Phase 3: Triggered Pose Estimation Model
        pose_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models", "yolov8n-pose.pt")
        self.pose_model = YOLO(pose_path)
    
    def process_frame(self, frame):
        """
        Detect objects in a frame.
        Returns:
            - processed_frame (with bounding boxes)
            - detections (list of dicts: {label, conf, box})
            - timestamp
        """
        results = self.model.track(frame, persist=True, conf=config.CONFIDENCE_THRESHOLD, verbose=False)
        
        detections = []
        
        # We generally work with the first result in the list (single frame)
        result = results[0]
        
        # Extract detections
        for box in result.boxes:
            class_id = int(box.cls[0])
            label = self.model.names[class_id]
            conf = float(box.conf[0])
            xyxy = box.xyxy[0].tolist() # Coordinates
            track_id = int(box.id[0]) if box.id is not None else -1
            
            detections.append({
                "label": label,
                "confidence": round(conf, 2),
                "box": xyxy,
                "track_id": track_id
            })

        # Draw bounding boxes
        annotated_frame = result.plot()
        
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Add timestamp to frame
        cv2.putText(annotated_frame, timestamp, (10, 30), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
        
        return annotated_frame, detections, timestamp
        
    def analyze_pose(self, frame):
        """
        Runs YOLO-Pose on the frame and returns a posture context string.
        Only runs when strictly triggered to save CPU.
        """
        results = self.pose_model(frame, verbose=False)
        posture_contexts = []
        
        if len(results) > 0 and results[0].keypoints is not None:
            # keypoints shape is usually (num_persons, 17, 2 or 3)
            # YOLOv8 keypoints: 5=L Shoulder, 6=R Shoulder, 9=L Wrist, 10=R Wrist, 11=L Hip, 12=R Hip
            keypoints = results[0].keypoints.xy.cpu().numpy()
            
            for person_idx, kps in enumerate(keypoints):
                if len(kps) >= 13: # Ensure we have enough keypoints
                    l_shoulder_y = kps[5][1]
                    r_shoulder_y = kps[6][1]
                    l_wrist_y = kps[9][1]
                    r_wrist_y = kps[10][1]
                    l_hip_y = kps[11][1]
                    r_hip_y = kps[12][1]
                    
                    # Both shoulders and wrists must be detected (y > 0)
                    if (l_shoulder_y > 0 or r_shoulder_y > 0) and (l_wrist_y > 0 or r_wrist_y > 0):
                        avg_shoulder_y = max(l_shoulder_y, r_shoulder_y) # lower Y is higher on screen
                        avg_wrist_y = min(y for y in [l_wrist_y, r_wrist_y] if y > 0)
                        
                        # In image coordinates, Y=0 is top. So if wrist_y < shoulder_y, arm is raised.
                        if avg_wrist_y > 0 and avg_wrist_y < (avg_shoulder_y - 20):
                            posture_contexts.append(f"Person {person_idx+1} has arms raised aggressively.")
                            
                    # Crouching logic: shoulder to hip distance compressed
                    if (l_shoulder_y > 0 and l_hip_y > 0):
                        torso_height = l_hip_y - l_shoulder_y
                        # Need a reference scale (could use face height or bounding box height)
                        # A very crude check: if torso is very small in Y direction, they might be crouched.
                        # Since we don't have bounding box height easily here, we'll keep the arms raised logic as primary.
                        pass
        
        if posture_contexts:
            return " ".join(posture_contexts)
        return "No distinct aggressive posture detected."
        
    def analyze_emotion(self, frame, detections):
        """
        Crops persons from the frame and analyzes their facial emotion.
        Returns a context string of the emotions.
        """
        emotion_contexts = []
        person_count = 0
        
        for det in detections:
            if det["label"].lower() == "person":
                person_count += 1
                try:
                    # Parse bounding box [x1, y1, x2, y2]
                    x1, y1, x2, y2 = [int(v) for v in det["box"]]
                    
                    # Ensure within bounds
                    h, w = frame.shape[:2]
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)
                    
                    if (x2 - x1) > 20 and (y2 - y1) > 20: # Minimum crop size
                        person_crop = frame[y1:y2, x1:x2]
                        
                        # Analyze emotion on the cropped image (suppress output to save time)
                        results = DeepFace.analyze(person_crop, actions=['emotion'], enforce_detection=False, silent=True)
                        if isinstance(results, list) and len(results) > 0:
                            dominant_emotion = results[0].get('dominant_emotion')
                            if dominant_emotion:
                                emotion_contexts.append(f"Person {person_count} looks {dominant_emotion}.")
                except Exception as e:
                    pass
                    
        if emotion_contexts:
            return " ".join(emotion_contexts)
        return "No clear facial emotions detected."

if __name__ == "__main__":
    # Test with webcam
    cap = cv2.VideoCapture(0)
    vision = VisionEngine()
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret: break
        
        ann_frame, dets, ts = vision.process_frame(frame)
        cv2.imshow("Vision Test", ann_frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
            
    cap.release()
    cv2.destroyAllWindows()
