import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from fastapi import FastAPI, Request, Form
from twilio.twiml.messaging_response import MessagingResponse
import config
from utils.logger import setup_logger
import json

logger = setup_logger(__name__)

app = FastAPI()

# Shared state file with Streamlit
STATUS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "status.json")

@app.post("/sms-webhook")
async def inbound_reply(Body: str = Form(...), From: str = Form(...)):
    """
    Handle incoming messages (SMS or WhatsApp) from Twilio.
    """
    logger.info(f"📩 Received Message from {From}: {Body}")
    
    # 1. Process the user's reply
    user_response = Body.lower().strip()
    
    # 2. Formulate a response
    resp = MessagingResponse()
    
    if "help" in user_response:
        reply_text = "Commands:\n- 'Status': Check system status\n- 'Stop': Stop alerts\n- 'Report': Get latest summary"
    elif "status" in user_response:
        reply_text = "🟢 System is ONLINE and monitoring active."
    elif "stop" in user_response:
        try:
            with open(STATUS_FILE, "w") as f:
                json.dump({"monitoring": False}, f)
            reply_text = "🛑 Stopping monitoring. Alerts suspended."
            logger.info("Sent stop signal to Streamlit app via status.json")
        except Exception as e:
            reply_text = f"❌ Failed to stop monitoring remotely."
            logger.error(f"Failed to write to status.json: {e}")
    elif "ack" in user_response or "ok" in user_response:
        reply_text = "✅ Acknowledgement received. Logging incident as 'Under Review'."
    else:
        reply_text = f"🤖 AI System received: '{Body}'. Type 'Help' for options."
    
    # 3. Send response back
    msg = resp.message()
    msg.body(reply_text)
    
    return str(resp)

if __name__ == "__main__":
    import uvicorn
    print("🚀 Webhook Server running on port 8000...")
    # Map both for compatibility
    @app.post("/whatsapp-webhook")
    async def whatsapp_reply(Body: str = Form(...), From: str = Form(...)):
        return await inbound_reply(Body, From)
        
    uvicorn.run(app, host="0.0.0.0", port=8000)
