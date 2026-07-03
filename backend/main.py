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
try:
    import sounddevice as sd
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, Request, Form, UploadFile, File
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

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global Ollama Process reference
ollama_process = None

def get_config_dict():
    default_config = {
        "ollama_models_path": "",
        "active_mode": "local",
        "provider": "ollama",
        "model_name": config.LOCAL_LLM_MODEL if hasattr(config, "LOCAL_LLM_MODEL") else "moondream",
        "api_key": "",
        "twilio_sid": "",
        "twilio_auth": "",
        "twilio_type": "SMS",
        "twilio_from": "",
        "twilio_to": "",
        "alerts_enabled": False
    }
    CONFIG_FILE = "model_config.json"
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                return json.load(f)
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
        self.fps = 30.0
        self.input_source = "Webcam"
        self.audio_data = None
        self.audio_sr = None
        self.audio_stream = None

state = AppState()

# Initialize AI Modules
vision_engine = VisionEngine()
agent = IncidentAgent()

CONFIG_FILE = "model_config.json"
STATUS_FILE = "status.json"

@app.get("/api/state")
def get_state():
    return {
        "monitoring": state.monitoring,
        "threat_level": state.threat_level,
        "object_count": state.object_count,
        "latest_report": state.latest_report,
        "history": get_logs(10),
        "is_analyzing": state.is_analyzing
    }

def audio_monitor_thread():
    if not AUDIO_AVAILABLE:
        return
        
    def audio_callback(indata, frames, time_info, status):
        volume_norm = np.linalg.norm(indata)*10
        if volume_norm > 150: # Loud noise threshold
            state.audio_context = "LOUD NOISE DETECTED (Possible glass breaking, shouting, or impact)"
            
    try:
        with sd.InputStream(callback=audio_callback):
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
        subprocess.run(["ffmpeg", "-y", "-i", tfile.name, "-vn", "-acodec", "pcm_s16le", "-ar", "44100", "-ac", "1", audio_path], 
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        
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
            
        if not state.cap.isOpened():
            logger.error(f"Failed to open camera: {cam_input}")
            return JSONResponse({"status": "Error", "message": f"Camera access failed: {cam_input}"}, status_code=500)
            
        state.fps = 30.0
        state.audio_data = None # Clear any previous video audio
        
    state.monitoring = True
    state.last_analysis_time = 0
    state.analysis_interval = interval
    state.person_trackers = {}
    
    if AUDIO_AVAILABLE and source != "Upload Video":
        threading.Thread(target=audio_monitor_thread, daemon=True).start()
        
    return {"status": "Started"}

@app.post("/api/stop")
def stop_monitoring():
    state.monitoring = False
    if state.cap:
        state.cap.release()
        state.cap = None
    if state.audio_stream:
        state.audio_stream.stop()
        state.audio_stream.close()
        state.audio_stream = None
    state.threat_level = "Waiting..."
    state.latest_report = None
    state.object_count = 0
    state.last_gray_frame = None
    return {"status": "Stopped"}

def generate_frames():
    frame_count = 0
    while True:
        if not state.monitoring or state.cap is None or not state.cap.isOpened():
            state.monitoring = False
            break
            
        success, frame = state.cap.read()
        if not success:
            state.monitoring = False
            if state.cap:
                state.cap.release()
                state.cap = None
            if state.audio_stream:
                state.audio_stream.stop()
                state.audio_stream.close()
                state.audio_stream = None
            state.threat_level = "Waiting..."
            state.latest_report = None
            state.object_count = 0
            state.last_gray_frame = None
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
                    
                    # Volume Check
                    volume_norm = np.linalg.norm(audio_chunk) / len(audio_chunk) * 1000
                    if volume_norm > 150:
                        state.audio_context = "LOUD NOISE DETECTED in video audio track"
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
            
        MOTION_THRESHOLD = 500
        
        if motion_score >= MOTION_THRESHOLD:
            # YOLO Processing with frame skipping
            if frame_count % config.Frame_Skip == 0:
                ann_frame, det_list, ts = vision_engine.process_frame(frame)
                frame = ann_frame # Use the annotated frame for the video feed
                
                detections = [d["label"] for d in det_list]
                state.object_count = len(detections)
                
                # Loitering Logic
                current_person_ids = []
                for det in det_list:
                    if det["label"].lower() == "person" and det.get("track_id", -1) != -1:
                        tid = det["track_id"]
                        current_person_ids.append(tid)
                        if tid not in state.person_trackers:
                            state.person_trackers[tid] = current_time
                            
                # Cleanup lost trackers
                for tid in list(state.person_trackers.keys()):
                    if tid not in current_person_ids:
                        del state.person_trackers[tid]
                        
                loitering_context = None
                for tid, first_seen in state.person_trackers.items():
                    if current_time - first_seen > 10: # 10 seconds demo threshold
                        loitering_context = "A person has been loitering without interacting for over 10 seconds."
                        break

                # AI Reasoning (Strictly respects user interval, but includes context if present)
                if current_time - state.last_analysis_time >= state.analysis_interval:
                    pil_image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    try:
                        state.is_analyzing = True
                        
                        context_str = ""
                        if state.audio_context:
                            context_str += f"AUDIO ALERT: {state.audio_context}\n"
                            state.audio_context = None # Reset flag after using it
                        if loitering_context:
                            context_str += f"BEHAVIOR ALERT: {loitering_context}\n"
                            
                        incident_report = agent.analyze_incident(pil_image, detections, context_str)
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
                        state.is_analyzing = False
                        
                    state.last_analysis_time = datetime.now().timestamp()

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
    
    with open(CONFIG_FILE, "w") as f:
        json.dump(data, f, indent=4)
        
    # If the path changed, restart Ollama
    if old_path != new_path:
        launch_ollama()
        
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
