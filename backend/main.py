import sys
import os
import cv2
import json
import logging
import time
import tempfile
import base64
from datetime import datetime
from PIL import Image
import numpy as np
import threading
import subprocess
import scipy.io.wavfile as wav
import csv
from backend import download_models
try:
    import tensorflow as tf
except ImportError:
    tf = None
try:
    import sounddevice as sd
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request, Form, UploadFile, File, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import requests
from twilio.twiml.messaging_response import MessagingResponse

import config
from core.vision import VisionEngine
from core.agent import IncidentAgent
from core.decision import evaluate_threat
from comms.alerts import send_alert
from core.db import insert_log, get_logs, delete_log, clear_all_logs, get_cameras, add_camera, delete_camera
from utils.logger import setup_logger

# Configure Logging
logger = setup_logger(__name__)

# Global Ollama Process reference
ollama_process = None

# Download and Load YAMNet
download_models.download_yamnet()
yamnet_interpreter = None
yamnet_classes = []
if tf:
    try:
        yamnet_interpreter = tf.lite.Interpreter(model_path="models/yamnet.tflite")
        yamnet_interpreter.allocate_tensors()
        yamnet_input_details = yamnet_interpreter.get_input_details()
        yamnet_output_details = yamnet_interpreter.get_output_details()
        
        with open("models/yamnet_class_map.csv", "r") as f:
            reader = csv.reader(f)
            next(reader) # skip header
            for row in reader:
                yamnet_classes.append(row[2])
        logger.info("YAMNet Audio Engine loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load YAMNet: {e}")

def get_config_dict():
    default_config = {
        "ollama_models_path": "",
        "active_mode": "local",
        "provider": "ollama",
        "model_name": config.LOCAL_LLM_MODEL if hasattr(config, "LOCAL_LLM_MODEL") else "moondream",
        "cloud_models": [], # e.g. [{"id": 1, "provider": "gemini", "model": "gemini-1.5-flash", "api_key": "...", "base_url": "", "is_primary": True}]
        "twilio_sid": "",
        "twilio_auth": "",
        "twilio_type": "SMS",
        "twilio_from": "",
        "twilio_to": "",
        "alerts_enabled": False,
        "allowed_origins": []
    }
    CONFIG_FILE = "model_config.json"
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                loaded = json.load(f)
                
                # Migration logic: moving api_key/api_keys to the new cloud_models array
                if "cloud_models" not in loaded:
                    loaded["cloud_models"] = []
                    # Try to migrate from legacy api_keys
                    if "api_keys" in loaded and isinstance(loaded["api_keys"], dict):
                        for prov, key in loaded["api_keys"].items():
                            loaded["cloud_models"].append({
                                "id": f"migrated_{prov}",
                                "provider": prov,
                                "model": loaded.get("model_name", "default-model"),
                                "api_key": key,
                                "base_url": "",
                                "is_primary": (prov == loaded.get("provider"))
                            })
                    # Or migrate from legacy api_key
                    elif "api_key" in loaded and loaded["api_key"] and loaded.get("provider") in ["gemini", "groq", "huggingface", "mistral"]:
                        loaded["cloud_models"].append({
                            "id": "migrated_single",
                            "provider": loaded["provider"],
                            "model": loaded.get("model_name", "default-model"),
                            "api_key": loaded["api_key"],
                            "base_url": "",
                            "is_primary": True
                        })
                        
                # Ensure exactly one primary model if active_mode is cloud
                if loaded.get("active_mode") == "cloud" and loaded.get("cloud_models"):
                    if not any(m.get("is_primary") for m in loaded["cloud_models"]):
                        loaded["cloud_models"][0]["is_primary"] = True
                        
                # Merge defaults
                for k, v in default_config.items():
                    if k not in loaded:
                        loaded[k] = v
                return loaded
        except:
            return default_config
    return default_config

def launch_ollama():
    global ollama_process
    
    # Terminate any existing instance first
    if ollama_process:
        try:
            ollama_process.terminate()
            ollama_process.wait(timeout=2)
        except:
            pass
            
    # Always attempt to kill any stray ollama processes
    subprocess.run(["taskkill", "/f", "/im", "ollama.exe"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    
    cfg = get_config_dict()
    models_path = cfg.get("ollama_models_path", "").strip()
    
    env = os.environ.copy()
    if models_path:
        env["OLLAMA_MODELS"] = models_path
        logger.info(f"Launching Ollama with custom models path: {models_path}")
    else:
        logger.info("Launching Ollama with default models path")
        
    try:
        # Start Ollama in the background
        ollama_process = subprocess.Popen(
            ["ollama", "serve"], 
            env=env,
            stdout=subprocess.DEVNULL, 
            stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
    except Exception as e:
        logger.error(f"Failed to start local Ollama engine: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Launch Ollama Engine
    launch_ollama()
    yield
    # Shutdown: Clean up Ollama Engine
    global ollama_process
    if ollama_process:
        try:
            ollama_process.terminate()
            ollama_process.wait(timeout=3)
        except:
            pass

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global State
class AppState:
    def __init__(self):
        self.monitoring = False
        self.cap = None
        self.last_analysis_time = 0
        self.threat_level = "Waiting..."
        self.object_count = 0
        self.latest_report = None
        self.is_analyzing = False
        self.analysis_interval = 10
        self.last_gray_frame = None
        self.audio_context = None
        self.person_trackers = {}
        self.threat_trackers = {}
        self.fps = 30.0
        self.input_source = "Webcam"
        self.audio_data = None
        self.audio_sr = None
        self.audio_stream = None
        self.avg_motion_score = 0.0
        self.avg_volume_norm = 0.0

state = AppState()

# Initialize AI Modules
vision_engine = VisionEngine()
agent = IncidentAgent()

CONFIG_FILE = "model_config.json"
STATUS_FILE = "status.json"

client_camera_frame = None

@app.websocket("/api/ws/client_stream")
async def websocket_client_stream(websocket: WebSocket):
    global client_camera_frame
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            if data.startswith("data:image/jpeg;base64,"):
                b64_data = data.split(",")[1]
                img_data = base64.b64decode(b64_data)
                np_arr = np.frombuffer(img_data, np.uint8)
                img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
                if img is not None:
                    client_camera_frame = img
    except WebSocketDisconnect:
        pass

@app.get("/api/state")
def get_state():
    return {
        "monitoring": state.monitoring,
        "threat_level": state.threat_level,
        "object_count": state.object_count,
        "latest_report": state.latest_report,
        "history": get_logs(10),
        "is_analyzing": state.is_analyzing,
        "api_stats": agent.get_api_stats()
    }

import whisper
from collections import deque

whisper_model = None
try:
    print("Loading whisper-tiny model...")
    whisper_model = whisper.load_model("tiny")
    print("Whisper model loaded.")
except Exception as e:
    logger.error(f"Failed to load whisper model: {e}")

def audio_monitor_thread():
    if not AUDIO_AVAILABLE:
        return
        
    audio_buffer = deque(maxlen=3)
    def audio_callback(indata, frames, time_info, status):
        waveform = indata.flatten().astype(np.float32)
        audio_buffer.append(waveform)
        
        volume_norm = np.linalg.norm(indata)*10
        if volume_norm > 100: # Slightly lower threshold before engaging YAMNet to be safe
            base_context = "LOUD NOISE DETECTED"
            
            if yamnet_interpreter:
                try:
                    yamnet_interpreter.set_tensor(yamnet_input_details[0]['index'], waveform)
                    yamnet_interpreter.invoke()
                    scores = yamnet_interpreter.get_tensor(yamnet_output_details[0]['index'])
                    top_class_index = scores.mean(axis=0).argmax()
                    top_class_name = yamnet_classes[top_class_index]
                    
                    critical_sounds = ["Screaming", "Glass", "Gunshot", "Explosion", "Siren", "Alarm", "Gun", "Shatter"]
                    if any(c.lower() in top_class_name.lower() for c in critical_sounds):
                        base_context = f"CRITICAL AUDIO DETECTED: {top_class_name}"
                    else:
                        base_context = f"Loud noise detected: {top_class_name}"
                except Exception as e:
                    base_context = "LOUD NOISE DETECTED (Classification failed)"
            else:
                base_context = "LOUD NOISE DETECTED (Possible glass breaking, shouting, or impact)"
                
            # Phase 2: Whisper Transcription Event Trigger
            transcription = ""
            if whisper_model and len(audio_buffer) > 0:
                try:
                    # Stitch the rolling buffer together (up to 3 seconds)
                    full_audio = np.concatenate(list(audio_buffer))
                    result = whisper_model.transcribe(full_audio, fp16=False, language="en")
                    text = result.get("text", "").strip()
                    if text:
                        transcription = f" | Transcript: '{text}'"
                except Exception as e:
                    logger.error(f"Whisper transcription failed: {e}")
                    
            state.audio_context = base_context + transcription
            
    try:
        # YAMNet natively expects 16000Hz. We capture 16000 samples (1 second).
        with sd.InputStream(samplerate=16000, channels=1, callback=audio_callback, blocksize=16000, dtype='float32'):
            while state.monitoring:
                time.sleep(0.5)
    except Exception as e:
        logger.error(f"Audio stream error: {e}")

@app.post("/api/upload")
def upload_video(file: UploadFile = File(...)):
    try:
        suffix = os.path.splitext(file.filename)[1]
        tfile = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        tfile.write(file.file.read())
        tfile.close()
        
        # Rip audio using FFmpeg
        audio_path = tempfile.mktemp(suffix=".wav")
        # Subprocess FFmpeg - using shell=False, redirecting output
        try:
            subprocess.run(["ffmpeg", "-y", "-i", tfile.name, "-vn", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1", audio_path], 
                           check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except (subprocess.CalledProcessError, FileNotFoundError) as e:
            logger.warning(f"FFmpeg audio extraction failed or FFmpeg not installed. Proceeding with video only. Error: {e}")
        
        # Load audio into memory
        if os.path.exists(audio_path):
            sr, data = wav.read(audio_path)
            state.audio_sr = sr
            state.audio_data = data
            try:
                os.remove(audio_path)
            except:
                pass
        else:
            state.audio_data = None
            
        return {"status": "Uploaded", "video_path": tfile.name}
    except Exception as e:
        logger.error(f"Error during upload/extraction: {e}")
        return JSONResponse({"status": "Error", "message": str(e)}, status_code=500)

@app.post("/api/start")
def start_monitoring(source: str = Form(...), interval: int = Form(10), video_path: str = Form(None), camera_url: str = Form(None)):
    if state.monitoring:
        return {"status": "Already monitoring"}
        
    state.input_source = source
    if source == "Upload Video" and video_path:
        state.video_path = video_path
        state.cap = cv2.VideoCapture(state.video_path)
        state.fps = state.cap.get(cv2.CAP_PROP_FPS)
        if not state.fps or state.fps <= 0:
            state.fps = 30.0
            
        if AUDIO_AVAILABLE and state.audio_data is not None:
            try:
                state.audio_stream = sd.OutputStream(samplerate=state.audio_sr, channels=1, dtype='int16')
                state.audio_stream.start()
            except Exception as e:
                logger.error(f"Could not open audio stream: {e}")
                state.audio_stream = None
    else:
        if source == "Client Camera":
            state.cap = "WebSocket"
            state.fps = 15.0
            state.audio_data = None
        else:
            cam_input = 0
            if camera_url:
                if camera_url.isdigit():
                    cam_input = int(camera_url)
                else:
                    cam_input = camera_url
                    
            if isinstance(cam_input, int):
                # Try DirectShow first for Windows local webcams, fallback to default
                state.cap = cv2.VideoCapture(cam_input, cv2.CAP_DSHOW)
                if not state.cap.isOpened():
                    state.cap = cv2.VideoCapture(cam_input)
            else:
                # RTSP/IP cameras
                state.cap = cv2.VideoCapture(cam_input)
            
        if state.cap != "WebSocket" and (not state.cap or not state.cap.isOpened()):
            logger.error(f"Failed to open camera: {cam_input}")
            return JSONResponse({"status": "Error", "message": f"Camera access failed: {cam_input}"}, status_code=500)
            
        # Eliminate latency drift by forcing OpenCV to drop old frames instead of queueing them
        if state.cap != "WebSocket":
            state.cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
        state.fps = 30.0
        state.audio_data = None # Clear any previous video audio
        
    state.monitoring = True
    state.monitoring_run_id = getattr(state, "monitoring_run_id", 0) + 1
    if source == "Upload Video":
        state.last_analysis_time = 0
    else:
        state.last_analysis_time = datetime.now().timestamp() # Warm-up period for live cameras
    state.analysis_interval = interval
    state.person_trackers = {}
    state.threat_trackers = {}
    
    if AUDIO_AVAILABLE and source != "Upload Video":
        threading.Thread(target=audio_monitor_thread, daemon=True).start()
        
    return {"status": "Started"}

@app.post("/api/stop")
def stop_monitoring():
    # Only set the flag. The generator thread safely releases the camera in its finally block.
    # This completely prevents thread-safety segfaults inside OpenCV.
    state.monitoring = False
    state.is_analyzing = False # Immediately clear UI overlay
    return {"status": "Stopped"}

def generate_frames():
    try:
        yield from _generate_frames_internal()
    finally:
        if getattr(state, "cap", None):
            if state.cap != "WebSocket":
                state.cap.release()
            state.cap = None
        if getattr(state, "audio_stream", None):
            state.audio_stream.stop()
            state.audio_stream.close()
            state.audio_stream = None
        state.threat_level = "Waiting..."
        state.latest_report = None
        state.object_count = 0
        state.last_gray_frame = None

def _generate_frames_internal():
    frame_count = 0
    while True:
        if not state.monitoring or state.cap is None or (state.cap != "WebSocket" and not state.cap.isOpened()):
            state.monitoring = False
            break
            
        if getattr(state, "is_analyzing", False) and getattr(state, "last_yielded_frame", None) is not None:
            if getattr(state, "input_source", "") == "Upload Video":
                # Dynamic Pausing: Keep HTTP MJPEG stream alive while AI is reasoning for video files
                ret, buffer = cv2.imencode('.jpg', state.last_yielded_frame)
                if ret:
                    frame_bytes = buffer.tobytes()
                    yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                time.sleep(0.1) # 10 FPS keep-alive for video files
                continue
            
        if state.cap == "WebSocket":
            if client_camera_frame is None:
                time.sleep(0.05)
                continue
            frame = client_camera_frame.copy()
            client_camera_frame = None # Consume the frame to prevent MJPEG spam loop
            success = True
        else:
            success, frame = state.cap.read()
            
        if not success:
            state.monitoring = False
            break

        frame_count += 1
        current_time = datetime.now().timestamp()
        
        # Synced Audio Playback for Uploaded Video
        if state.input_source == "Upload Video" and state.audio_data is not None and state.audio_stream:
            try:
                samples_per_frame = int(state.audio_sr / state.fps)
                start_idx = (frame_count - 1) * samples_per_frame
                end_idx = frame_count * samples_per_frame
                
                if start_idx < len(state.audio_data):
                    audio_chunk = state.audio_data[start_idx:end_idx]
                    
                    # Blocking write naturally syncs video to audio
                    state.audio_stream.write(audio_chunk)
                    
                    # Dynamic Volume Baseline (EWMA)
                    volume_norm = np.linalg.norm(audio_chunk) / len(audio_chunk) * 1000
                    if state.avg_volume_norm == 0.0:
                        state.avg_volume_norm = volume_norm
                    else:
                        state.avg_volume_norm = (0.9 * state.avg_volume_norm) + (0.1 * volume_norm)
                    
                    # Trigger if > 300% of background noise AND above absolute floor of 20
                    if frame_count > 30 and volume_norm > (state.avg_volume_norm * 3) and volume_norm > 20:
                        state.audio_context = "CRITICAL: Loud noise/volume spike detected (possible kicking or yelling) in video audio track"
            except Exception as e:
                pass
        
        # Motion Detection logic to save resources
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        
        if state.last_gray_frame is None:
            state.last_gray_frame = gray
            motion_score = 1000  # Force process first frame
        else:
            frame_delta = cv2.absdiff(state.last_gray_frame, gray)
            thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
            motion_score = cv2.countNonZero(thresh)
            state.last_gray_frame = gray
            
        # Dynamic Motion Baseline (EWMA)
        if state.avg_motion_score == 0.0:
            state.avg_motion_score = motion_score
        else:
            state.avg_motion_score = (0.9 * state.avg_motion_score) + (0.1 * motion_score)
            
        MOTION_THRESHOLD = 500
        
        if motion_score >= MOTION_THRESHOLD:
            # YOLO Processing with frame skipping
            if frame_count % config.Frame_Skip == 0:
                ann_frame, det_list, ts = vision_engine.process_frame(frame)
                frame = ann_frame # Use the annotated frame for the video feed
                
                # Filter out vehicles to ignore them in combinatorial tracking
                det_list = [d for d in det_list if d["label"].lower() != "vehicle"]
                
                detections = [d["label"] for d in det_list]
                state.object_count = len(detections)
                
                # Combinatorial Logic (Person + Weapon)
                current_person_ids = []
                weapon_classes = ["weapon", "dangerous object", "knife", "baseball bat", "scissors", "bottle", "sports ball"]
                weapon_present = any(d["label"].lower() in weapon_classes for d in det_list)
                
                for det in det_list:
                    if det["label"].lower() == "person" and det.get("track_id", -1) != -1:
                        tid = det["track_id"]
                        current_person_ids.append(tid)
                        
                        # Combinatorial Tracking
                        if weapon_present:
                            if tid not in state.threat_trackers:
                                state.threat_trackers[tid] = current_time
                        else:
                            if tid in state.threat_trackers:
                                del state.threat_trackers[tid]
                                
                        # Standard Loitering
                        if tid not in state.person_trackers:
                            state.person_trackers[tid] = current_time
                            
                # Cleanup lost trackers
                for tid in list(state.person_trackers.keys()):
                    if tid not in current_person_ids:
                        del state.person_trackers[tid]
                for tid in list(state.threat_trackers.keys()):
                    if tid not in current_person_ids:
                        del state.threat_trackers[tid]
                        
                combinatorial_context = None
                for tid, first_seen in state.threat_trackers.items():
                    if current_time - first_seen > 3.0: # 3.0 seconds duration rule for weapons
                        combinatorial_context = "A person has been holding a suspected weapon (knife/bat) for over 3 seconds."
                        break
                        
                loitering_context = None
                for tid, first_seen in state.person_trackers.items():
                    if current_time - first_seen > 10: # 10 seconds demo threshold for loitering
                        loitering_context = "A person has been loitering without interacting for over 10 seconds."
                        break
                        
                commotion_context = None
                # Ignore first 30 frames. Trigger if motion spikes 300% above moving average AND is huge (> 10000)
                if frame_count > 30 and motion_score > (state.avg_motion_score * 3) and motion_score > 10000 and len(current_person_ids) > 0:
                    commotion_context = "Sudden high-motion commotion detected with people present."

                # The VLM Gate: Only trigger if critical audio, weapon combination, sudden commotion, or prolonged loitering is detected
                trigger_vlm = False
                ctx_string = ""
                
                if getattr(state, "audio_context", None) and "CRITICAL" in state.audio_context:
                    trigger_vlm = True
                    ctx_string += f"Audio Alert: {state.audio_context}. "
                
                if commotion_context:
                    trigger_vlm = True
                    ctx_string += f"Visual Alert: {commotion_context} "
                elif combinatorial_context:
                    trigger_vlm = True
                    ctx_string += f"Visual Alert: {combinatorial_context} "
                elif loitering_context:
                    trigger_vlm = True
                    ctx_string += f"Visual Alert: {loitering_context} "
                    
                if trigger_vlm:
                    # Phase 3: Trigger Pose Analysis conditionally
                    try:
                        pose_ctx = vision_engine.analyze_pose(frame)
                        ctx_string += f"[BODY LANGUAGE] {pose_ctx} "
                    except Exception as e:
                        logger.error(f"Pose analysis failed: {e}")
                        
                    # Phase 4: Trigger Emotion Analysis conditionally
                    try:
                        emo_ctx = vision_engine.analyze_emotion(frame, det_list)
                        ctx_string += f"[FACIAL EMOTION] {emo_ctx} "
                    except Exception as e:
                        logger.error(f"Emotion analysis failed: {e}")
                    now = datetime.now()
                    time_str = now.strftime("%I:%M %p")
                    hour = now.hour
                    is_open = config.BUSINESS_HOURS["start"] <= hour < config.BUSINESS_HOURS["end"]
                    status_str = "OPEN" if is_open else "CLOSED"
                    env_ctx = f"[ENVIRONMENT CONTEXT] Location: {config.LOCATION_NAME} | Current Time: {time_str} | Business Status: {status_str}. "
                    ctx_string = env_ctx + ctx_string

                # Dynamic Throttling Logic
                actual_interval = state.analysis_interval
                stats = agent.get_api_stats()
                cfg = agent._load_config()
                if cfg.get("active_mode") == "cloud":
                    cloud_models = cfg.get("cloud_models", [])
                    primary = next((m for m in cloud_models if m.get("is_primary")), None)
                    if primary:
                        p_stats = stats.get(primary.get("provider", ""), {})
                        used = p_stats.get("rpm_used", 0)
                        limit = p_stats.get("rpm_limit", 30)
                        if limit > 0 and used >= limit - 2:
                            # Dangerously close to limit, throttle!
                            actual_interval = max(actual_interval, 15) # Force at least 15s delay

                # AI Reasoning (Strictly respects user interval, but includes context if present)
                if trigger_vlm and (current_time - state.last_analysis_time >= actual_interval) and not getattr(state, "is_analyzing", False):
                    pil_image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    
                    def background_analysis_task(img, det, ctx_str, run_id):
                        try:
                            state.is_analyzing = True
                            # Pass our powerful new context string directly to the VLM
                            incident_report = agent.analyze_incident(img, det, ctx_str)
                            
                            # Abort all downstream processes if stream was stopped or restarted!
                            if not getattr(state, "monitoring", False) or getattr(state, "monitoring_run_id", 0) != run_id:
                                return
                                
                            state.latest_report = incident_report
                            
                            # Decision Engine
                            severity = incident_report.get("severity", "LOW").upper()
                            classification = incident_report.get("classification", "Normal")
                            
                            # Update threat level string
                            state.threat_level = f"{severity} ({classification})"
                            
                            action_log, requires_alert, alert_msg = evaluate_threat(incident_report)
                            
                            # Log to DB
                            description_text = incident_report.get("description", classification)
                            if not isinstance(description_text, str):
                                description_text = classification
                            insert_log("Analysis", severity, description_text, incident_report)
                            
                            if requires_alert:
                                send_alert(alert_msg)
                                
                        except Exception as e:
                            logger.error(f"Error during incident analysis: {e}")
                        finally:
                            if getattr(state, "monitoring_run_id", 0) == run_id:
                                state.is_analyzing = False
                                state.last_analysis_time = datetime.now().timestamp()
                    
                    context_str = ""
                    if getattr(state, "audio_context", None):
                        context_str += f"AUDIO ALERT: {state.audio_context}\n"
                        state.audio_context = None # Reset flag after using it
                    if loitering_context:
                        context_str += f"BEHAVIOR ALERT: {loitering_context}\n"
                        
                    threading.Thread(target=background_analysis_task, args=(pil_image, detections, context_str, getattr(state, "monitoring_run_id", 0))).start()

        # Update last yielded frame for dynamic pausing
        state.last_yielded_frame = frame

        # Encode frame to JPEG
        ret, buffer = cv2.imencode('.jpg', frame)
        if not ret:
            continue
            
        frame_bytes = buffer.tobytes()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        
        if state.input_source == "Upload Video":
            if not getattr(state, "audio_stream", None):
                # Sleep to match video framerate only if audio pacing isn't active
                time.sleep(max(0, (1.0 / state.fps) - 0.005))
        else:
            time.sleep(0.01)

@app.get("/api/video_feed")
def video_feed():
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

# Admin Config Endpoints
@app.get("/api/admin_check")
def admin_check():
    if os.path.exists(".admin_access"):
        return {"access": True}
    return {"access": False}

@app.get("/api/config")
def get_config():
    return get_config_dict()

@app.post("/api/config")
async def save_config(request: Request):
    data = await request.json()
    
    # Check if the models path changed
    current_cfg = get_config_dict()
    old_path = current_cfg.get("ollama_models_path", "").strip()
    new_path = data.get("ollama_models_path", "").strip()
    
    old_origins = current_cfg.get("allowed_origins", [])
    new_origins = data.get("allowed_origins", [])
    
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=4)
        
    # If the path changed, restart Ollama
    if old_path != new_path:
        launch_ollama()
        
    # If origins changed, trigger Next.js Hot Reload
    if old_origins != new_origins:
        next_config_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "next.config.ts")
        if os.path.exists(next_config_path):
            try:
                with open(next_config_path, "r") as nf:
                    content = nf.read()
                import re
                from datetime import datetime
                # Increment the trigger or use timestamp
                new_content = re.sub(r"// HOT_RELOAD_TRIGGER: \d+", f"// HOT_RELOAD_TRIGGER: {int(datetime.now().timestamp())}", content)
                with open(next_config_path, "w") as nf:
                    nf.write(new_content)
            except Exception as e:
                logger.error(f"Failed to hot-reload Next.js: {e}")
        
    return {"status": "Saved"}

# Ollama Model Manager Proxy Endpoints
@app.get("/api/ollama/tags")
def get_ollama_tags():
    try:
        resp = requests.get("http://localhost:11434/api/tags", timeout=5)
        return resp.json()
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.delete("/api/ollama/delete")
async def delete_ollama_model(request: Request):
    try:
        data = await request.json()
        resp = requests.delete("http://localhost:11434/api/delete", json=data, timeout=5)
        if resp.status_code == 200:
            return {"status": "Deleted"}
        return JSONResponse({"error": resp.text}, status_code=resp.status_code)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.post("/api/ollama/pull")
async def pull_ollama_model(request: Request):
    try:
        data = await request.json()
    except Exception:
        return JSONResponse({"error": "Invalid JSON"}, status_code=400)
        
    def stream_pull():
        try:
            with requests.post("http://localhost:11434/api/pull", json=data, stream=True, timeout=600) as resp:
                for line in resp.iter_lines():
                    if line:
                        yield line + b"\n"
        except Exception as e:
            yield json.dumps({"error": str(e)}).encode() + b"\n"
            
    return StreamingResponse(stream_pull(), media_type="application/x-ndjson")

# Camera Endpoints
@app.get("/api/cameras")
def api_get_cameras():
    return get_cameras()

@app.post("/api/cameras")
async def api_add_camera(request: Request):
    data = await request.json()
    add_camera(data.get("name"), data.get("url"))
    return {"status": "Added"}

@app.delete("/api/cameras/{cam_id}")
def api_delete_camera(cam_id: int):
    delete_camera(cam_id)
    return {"status": "Deleted"}

# Logs Endpoints
@app.get("/api/logs")
def api_get_logs():
    return get_logs(100)

@app.delete("/api/logs/{log_id}")
def api_delete_log(log_id: int):
    if not os.path.exists(".admin_access"):
        return JSONResponse({"status": "Access Denied"}, status_code=403)
    delete_log(log_id)
    return {"status": "Deleted"}

@app.delete("/api/logs")
def api_clear_logs():
    if not os.path.exists(".admin_access"):
        return JSONResponse({"status": "Access Denied"}, status_code=403)
    clear_all_logs()
    return {"status": "Cleared"}

# Webhook Endpoints
@app.post("/sms-webhook")
@app.post("/whatsapp-webhook")
async def inbound_reply(Body: str = Form(...), From: str = Form(...)):
    user_response = Body.lower().strip()
    resp = MessagingResponse()
    
    if "help" in user_response:
        reply_text = "Commands:\n- 'Status': Check system status\n- 'Stop': Stop alerts"
    elif "status" in user_response:
        reply_text = f"🟢 System is ONLINE. Monitoring: {state.monitoring}"
    elif "stop" in user_response:
        state.monitoring = False
        reply_text = "🛑 Stopping monitoring. Alerts suspended."
    else:
        reply_text = f"🤖 System received: '{Body}'. Type 'Help' for options."
        
    msg = resp.message()
    msg.body(reply_text)
    return str(resp)

if __name__ == "__main__":
    import uvicorn
    try:
        uvicorn.run(app, host="0.0.0.0", port=8000)
    except KeyboardInterrupt:
        pass
