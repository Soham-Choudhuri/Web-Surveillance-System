# AwareX: Multimodal Autonomous Surveillance System

AwareX is a next-generation, deeply autonomous AI surveillance system. Unlike traditional closed-circuit systems that rely on human operators to constantly stare at screens, AwareX utilizes **Multimodal Artificial Intelligence** (combining Computer Vision and Large Language Models) to autonomously detect, reason about, and report security threats in real-time.

It acts as a tireless, expert security analyst that actively watches camera feeds, listens to audio anomalies, and immediately pages human authorities via WhatsApp or SMS the moment an emergency occurs.

See **[Changelog](docs/Changelog.md)** for recent architectural changes, new features, additions, fixes, and improvements added to the project.

---

## Key Features

### Advanced Multimodal Intelligence
- **Vision Engine**: Leverages blazing-fast **YOLOv8** object tracking to monitor physical movement.
- **Visual Reasoning**: Instead of just drawing bounding boxes, the system passes critical frames to a Vision Language Model (like **Moondream**, **Gemini**, or **Llama 3.2 Vision**) to contextualize the scene and evaluate actual threat levels (e.g., distinguishing between a technician fixing an ATM and a vandal tampering with it).
- **Audio Monitoring**: AwareX listens. If it detects loud anomalies (like breaking glass or screaming), it injects that context directly into the AI's reasoning pipeline.

### Dynamic Camera Management
- Connect any standard USB Webcam or external **RTSP / HTTP IP Camera**.
- Features a zero-code **Camera Management UI** powered by SQLite, allowing operators to instantly add, test, or delete surveillance streams on the fly.

### Central Dispatch & Automated Alerting
- **Central Dispatch Portal**: A highly responsive, dedicated view (`/dispatch`) designed for a secondary monitor or mobile device. When a CRITICAL incident is detected, it pulses a massive alert that requires manual operator acknowledgment.
- **Two-Way Communications**: Pushes detailed incident reports, confidence scores, and action recommendations directly to your phone via Twilio (SMS/WhatsApp). 
- **Remote Stopping**: Reply to the alert message with `"Stop"` from your phone, and AwareX will automatically halt the live feed and AI processing.

### Historical Incident Database
- All analysis logs are permanently saved to a local **SQLite Database**.
- View, search, and manage historical threats securely via the passwordless Admin Logs portal.

---

## The "Bare-Metal" Installation Guide

*We didn't use Docker to containerize this project. Why?*

AwareX requires extremely fast, low-level access to a Graphics Card (for AI reasoning), a Microphone (for audio anomalies), and USB hardware (for Webcams). Virtualizing this hardware passthrough inside Docker on any OS is notoriously difficult and can cause performance issues.

For maximum performance, zero latency, and zero configuration headaches, AwareX is designed to run **"bare-metal"** directly on your host machine.

### Step 1: System Prerequisites
Before downloading AwareX, you need three standard developer tools installed on your computer:
1. **Python (3.10+)**: The engine for our backend logic. [Download Here](https://www.python.org/downloads/) *(Ensure you check the box that says "Add Python to PATH" during installation!)*
2. **Node.js (v18+)**: The engine for our Next.js frontend UI. [Download Here](https://nodejs.org/)
3. **Ollama**: The engine that runs local AI models entirely offline on your GPU. [Download Here](https://ollama.com/download)

### Step 2: Clone the Repository
Download this repository as a `.zip` file from the top right of this page, or clone it via git:
```cmd
git clone https://github.com/Soham-Choudhuri/Web-Surveillance-System.git
cd Web-Surveillance-System
```

### Step 3: 1-Click Launch
Double-click the **`run.bat`** file in the project folder. 

The launch script is completely automated. On its very first run, it will do all the heavy lifting for you:
- Download and install all required Python libraries (FastAPI, OpenCV, etc.).
- Download and build all Next.js frontend dependencies.
- Safely boot up the Ollama background engine.
- Launch the AwareX UI in your default web browser.

### Step 4: Configure an AI Model (In-Browser)
Once the dashboard opens (`http://localhost:3000`), you need an AI model to perform the visual reasoning. Click **Admin Portal** in the top right navigation bar and scroll down to the **Model Configuration** section. You have two choices:

**Option A: Local Processing (Requires decent hardware)**
If you want 100% offline privacy, select `ollama` as your provider. Type in the name of a lightweight vision model (we highly recommend `moondream` or `llama3.2-vision`) and click **Download Model**. You will see a live progress bar right on the screen.

**Option B: Cloud Processing (Lightning fast, requires API Key)**
If your hardware is older or you want maximum speed, select a cloud provider like `google` (for Gemini 1.5) or `groq` (for Llama 3.2 Vision). Simply paste in your API key and click **Save Configuration**. No massive downloads required!

Once configured, navigate back to the main dashboard, select your webcam from the dropdown, and click **Start Stream**!

---

## Documentation & Advanced Guides
Because AwareX is designed to run locally on your own hardware for maximum privacy and zero latency, it is isolated from the internet by default. We provide the following guides to help you safely extend its capabilities to the outside world:

- **[Mobile Phone Camera Setup Guide](docs/mobile_camera_guide.md)**
  - **Why you need this**: If you don't have a desktop webcam, or if you want to place a wireless camera in another room.
  - **How it works**: Explains how to use a free IP Camera app to turn your old smartphone into a high-quality, wireless surveillance camera that connects directly into the AwareX dashboard.

- **[Remote Access & VPN Guide](docs/tailscale_setup_guide.md)**
  - **Why you need this**: If you leave the house and want to view your live camera feeds or check the Admin Dashboard from your mobile phone, your home router's firewall will block you.
  - **How it works**: This guide walks you through installing Tailscale (a free, zero-configuration VPN). It creates a secure, encrypted tunnel directly to your machine, completely bypassing port-forwarding headaches and allowing you to securely view the dashboard from anywhere.

- **[Twilio Alerting Setup Guide](docs/twilio_free_setup_guide.md)**
  - **Why you need this**: AwareX can detect a threat autonomously, but it needs a way to instantly wake you up or notify you when you aren't staring at the screen.
  - **How it works**: This step-by-step guide helps you set up a free Twilio developer account. It grants AwareX the ability to physically push automated SMS or WhatsApp messages containing the incident details directly to your phone the exact second an emergency occurs.