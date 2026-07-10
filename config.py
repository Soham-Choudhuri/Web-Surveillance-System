import os
from dotenv import load_dotenv

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "models", "yolov8n_all.pt")

# Load environment variables from .env file
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Twilio Configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")
AUTHORITY_PHONE_NUMBER = os.getenv("AUTHORITY_PHONE_NUMBER")

# Local AI Configuration
LOCAL_LLM_MODEL = "moondream"
OLLAMA_HOST = "http://localhost:11434"

# System Configuration
Frame_Skip = 5  # Analyze every Nth frame to save resources
Resolution = (640, 480) # Resize frames for faster processing

# Alerting Thresholds
CONFIDENCE_THRESHOLD = 0.25

# Environment Context
LOCATION_NAME = "Main Branch ATM Vestibule"
BUSINESS_HOURS = {"start": 8, "end": 18} # 8 AM to 6 PM
