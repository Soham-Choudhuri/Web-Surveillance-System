from twilio.rest import Client
import sys
import os
import json
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
import json
from utils.logger import setup_logger

logger = setup_logger(__name__)

def _load_config():
    config_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "model_config.json")
    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                return json.load(f)
        except:
            pass
    return {}

def send_alert(message_body):
    """
    Sends an alert (SMS or WhatsApp) via Twilio based on dashboard configuration.
    """
    cfg = _load_config()
    
    if not cfg.get("alerts_enabled", False):
        logger.info("Alerts are disabled in the dashboard. Alert NOT sent.")
        return False
        
    sid = cfg.get("twilio_sid", "")
    token = cfg.get("twilio_auth", "")
    from_num = cfg.get("twilio_from", "")
    to_num = cfg.get("twilio_to", "")
    alert_type = cfg.get("twilio_type", "SMS")

    if not all([sid, token, from_num, to_num]):
        logger.warning("Twilio credentials missing in dashboard config. Alert NOT sent.")
        return False

    try:
        # Initialize Twilio Client
        client = Client(sid, token)
        
        # Apply WhatsApp prefix if selected in dashboard
        if alert_type == "WhatsApp" and not from_num.lower().startswith("whatsapp:"):
            from_num = f"whatsapp:{from_num}"
        if alert_type == "WhatsApp" and not to_num.lower().startswith("whatsapp:"):
            to_num = f"whatsapp:{to_num}"
            
        logger.info(f"Attempting to send {alert_type} from {from_num} to {to_num}...")

        message = client.messages.create(
            body=message_body,
            from_=from_num,
            to=to_num
        )
        logger.info(f"✅ {alert_type} Alert Sent! SID: {message.sid}")
        return True
    
    except Exception as e:
        logger.error(f"❌ Failed to send alert: {e}")
        return False

if __name__ == "__main__":
    # Test alert
    logger.info("Testing Alert System...")
    send_alert("🚨 DEBUG: This is a test alert from the AI Surveillance System.")
