# AwareX: Multimodal Autonomous Surveillance System

# Changelog: Version 10.0 (Current)

## 1. Enterprise Logging Architecture
- **Centralized Event History**: Replaced fragile, disjointed console prints with a robust `utils.logger.py` module.
- **Rotating File Handler**: All system events, API limits, and VLM JSON parsing errors are now permanently logged to `logs/awarex.log`. The system automatically caps the file size at 5MB and keeps the last 3 backups to prevent infinite storage bloat.
- **Module Traceability**: Log strings are now strictly formatted (e.g., `[core.agent] | ERROR`) to make debugging specific backend modules incredibly efficient.

## 2. Dynamic Qwen-VL Compatibility
- **Deterministic VLM Fix**: Pushed a critical patch to `core.agent` for `qwen3-vl:4b` compatibility. Removed the strict Ollama `format="json"` API flag exclusively for Qwen architectures to prevent hallucination crashes, falling back to a highly deterministic `temperature: 0.1` parameter.
- **Aggressive JSON Extraction**: Rewrote the JSON parsing fallback logic to physically hunt for `{}` brackets and strip illegal control characters (like `\r\n`), ensuring flawless threat report extraction from chatty local models.

## 3. Structural Organization
- **Model Pathing**: Consolidated `yolov8n-pose.pt` into the `models/` directory. Upgraded backend pathing logic in `core/vision.py` to use absolute `os.path` mappings, guaranteeing zero-downtime execution regardless of where the launch script is called from.

---

# Changelog: Version 9.0 (Stable)

## 1. Context-Aware Cascade Architecture
- **Hardware-Optimized Gating**: Engineered a strict 4-phase cascade pipeline. Heavy AI models (Whisper, Pose, DeepFace) remain completely asleep using 0% CPU during normal surveillance. They are only violently triggered the exact moment the primary YOLO weapon/loitering rules evaluate to True.

## 2. Temporal & Environmental Context
- **Zero-Cost Context Wrapper**: The backend now programmatically injects the `LOCATION_NAME`, the exact local time, and evaluates `BUSINESS_HOURS` to append `[OPEN]` or `[CLOSED]` status directly into the VLM prompt. This massively improves the AI's situational awareness (e.g., someone with a tool at an ATM at 2 AM vs 2 PM) with absolutely zero hardware overhead.

## 3. Event-Driven Audio Transcription (Whisper)
- **Rolling Audio Buffer**: Re-engineered the live microphone thread to silently maintain a rolling 3-second memory buffer.
- **Whisper-Tiny Integration**: When the volume breaches the anomaly threshold, the buffer freezes and pipes the exact 3-second clip through OpenAI's Whisper engine. Transcriptions of aggressive speech (e.g., *"Give me the money!"*) are explicitly passed to the Cloud VLM.

## 4. Algorithmic Body Language AI
- **Triggered Pose Estimation**: Integrated `yolov8n-pose.pt`. Upon a cascade trigger, it maps 17 skeletal keypoints of the suspect. It runs fast mathematical logic comparing the Y-axis of wrists to shoulders to detect aggressive postures (e.g., arms raised to swing a bat) and injects this as `[BODY LANGUAGE]`.

## 5. Facial Emotion Recognition (FER)
- **DeepFace Analysis**: Integrated the `deepface` sentiment analyzer. When triggered, the engine dynamically crops out the tiny bounding box of a detected `"person"` and extracts their `dominant_emotion` (Anger, Fear, Surprise, etc.), finalizing the ultimate context wrapper for the VLM.

---

# Changelog: Version 8.0 (Stable)

## 1. Evolved Gating Architecture (Zero Background Bloat)
- **YAMNet Audio Gatekeeper**: Integrated a microscopic 4MB TensorFlow-CPU audio model (YAMNet) to monitor the host machine's microphone. It accurately classifies 521 audio events (e.g., screams, gunshots, breaking glass) in real-time, acting as a zero-latency tripwire that wakes up the VLM only during critical anomalies.
- **Combinatorial Object Tracking**: The YOLOv8 Vision Engine was upgraded from simple presence detection to complex combinatorial tracking. The VLM gate now identifies intersections of specific classes (e.g., `Person` AND `Weapon`).
- **Temporal State Machines**: Replaced raw frame triggering with a stateful tracker. The system now runs a strict duration rule: a person must be tracked holding a weapon for **> 3.0 seconds** before the frame is escalated to the VLM, drastically reducing false positives.

## 2. Premium UI/UX Polish
- **Dynamic Threat Visualization**: Upgraded the `Intelligence Hub` container to dynamically shift its glassmorphism border colors (e.g., pulsing red borders for `CRITICAL` threats) to draw the operator's eye immediately.
- **Active AI Shimmer**: When the VLM is actively reasoning, the "Active Intelligence" badge on the video feed displays an animated shimmer gradient over the module, visually communicating that the neural engine is engaged.
- **System Standby Animations**: Replaced static "Camera Offline" empty states with a glowing, smoothly pulsing `System Standby` graphic using layered blur effects.
- **Admin Aesthetics**: Overhauled primary action buttons in the Admin Panel with translucent glassmorphism styles and glowing hover shadows.

## 3. Mission-Critical Backend Robustness
- **FFmpeg Failsafe**: Implemented a robust fallback for video uploads. If the host machine lacks FFmpeg, the backend gracefully catches the error and seamlessly processes the video stream without audio instead of crashing the API.
- **Custom YOLO Weapons Guide**: Published a comprehensive [Custom YOLO Weights Guide](CUSTOM_WEIGHTS.md) detailing exactly how administrators can swap the default COCO proxy weights for custom-trained `.pt` firearm models.

## 4. Remote Camera Tunneling (Tailscale Funnel)
- **Client Camera WebRTC**: You can now securely tunnel any mobile device's physical camera back to the host server. By selecting "This Device's Camera", the Next.js frontend securely pipes the mobile camera directly into the Python AI backend.
- **Automated Funneling**: Refactored `run.bat` to completely automate public Tailscale access. It instantly boots up the Python backend, the Next.js frontend, and automatically executes `tailscale funnel 3000` in a visible terminal window, immediately providing a public HTTPS URL without touching a single router setting.

## 5. Enterprise API Rate Limiting & Failover
- **Hybrid Dynamic Tracking**: The Python core now physically intercepts HTTP headers (like `x-ratelimit-remaining`) to fetch live rate limits. If a provider hides headers, it seamlessly falls back to a precise 60-second sliding-window tracker.
- **Auto-Throttling Failsafe**: The VLM gate now self-regulates. If it detects it is dangerously close to hitting an API limit (e.g. 14/15 RPM), it artificially injects a 15-second delay to dynamically throttle requests and prevent a total API block.
- **Visual Analytics**: Upgraded the Admin Portal and Dashboard to display animated, real-time API Usage progress bars that shift from Emerald to Rose when encountering HTTP 429 Cooldown errors.

---

# Changelog: Version 7.0 (Stable)
## 1. Universal Mobile Responsiveness
- **Dynamic Mobile-First Scaling**: The entire Next.js frontend suite (Main Dashboard, Admin Portal, and Logs Database) has been rigorously overhauled with mobile-first CSS architecture. Elements now intelligently flex, wrap, and stack via dynamic viewport boundaries (Tailwind `sm:`, `md:`), guaranteeing flawless operation across any mobile aspect ratio.
- **Adaptive Data Tables**: Resolved aggressive horizontal scrolling issues caused by rigid HTML tables on the Logs page. The system now dynamically shrinks cellular padding and truncates text exclusively on mobile screens to drastically improve viewport efficiency.

## 2. Dynamic Origins & Security Management
- **In-Dashboard DNS Protection**: Introduced a brand new "Security: Allowed Origins" module directly into the Admin Portal. Administrators can now visually append new Tailscale IPs or Funnel URLs to the system's database to grant them remote access on the fly.
- **Automated Next.js Hot-Reloads**: Re-engineered the Python backend to physically synchronize with the Next.js compiler. When an admin updates security settings, Python injects a microscopic timestamp trigger directly into the `next.config.ts` source code, forcing the Next.js engine to perform an instant hot-reload and immediately apply the new firewall rules without taking the server offline.
- **Compiler Input Sanitization**: Next.js 15 operates with extremely strict `allowedDevOrigins` parameters. The config compiler now employs robust normalization algorithms that automatically strip user-pasted URL protocols (`https://`) and ports, feeding Next.js the exact raw hostnames it demands to prevent fatal server crashes.

## 3. Mobile Push Notification Stability
- **Illegal Constructor Patch**: Fixed a severe frontend crash that occurred strictly on mobile devices (Android Chrome / iOS Safari). Mobile operating systems explicitly block the Desktop `new Notification()` API to prevent battery drain.
- **Service Worker Downgrade**: The Notification block is now wrapped in an intelligent fallback system. The dashboard safely attempts the standard API, catches any OS-level `Illegal constructor` exceptions, and dynamically reroutes the alert through the `ServiceWorkerRegistration` engine to keep the React application completely stable while still delivering the push alert.

---

# Changelog: Version 6.0 (Stable)

## 1. Automated Ollama Subprocess Management
- **FastAPI Process Control**: Shifted the responsibility of managing the `ollama serve` background engine from the disjointed Windows `.bat` script directly into the FastAPI Python backend. FastAPI now seamlessly spawns Ollama in the background on boot and gracefully terminates it on shutdown.
- **Dynamic Model Paths**: Administrators can now define a custom, absolute path for local Ollama models directly via the Next.js Admin Dashboard.
- **Zero-Downtime Restarts**: The `POST /api/config` endpoint intelligently detects if the model path has been updated. If so, it instantly kills the running Ollama process and re-launches it with the new `OLLAMA_MODELS` environment variable without requiring a system reboot.
- **Script Cleanup**: Refactored `run.bat` to eliminate hardcoded executable shims and global system path injections, switching to robust `python -m pip` and `python -m uvicorn` commands. This completely resolves "Fatal error in launcher" bugs that occurred when the project folder was renamed or moved.

## 2. In-Dashboard Model Manager
- **Live UI Model Downloads**: Added a sleek Model Manager directly to the Next.js Admin Dashboard. Administrators can now pull heavy local AI models (like `llama3`) directly through the browser without ever opening a terminal.
- **Dynamic Progress Streaming**: Integrated native JavaScript streaming APIs that hook directly into Ollama's background engine via a FastAPI reverse proxy. Download progress is physically drawn onto the screen in real-time with a dynamic CSS progress bar.
- **Strict UI Safeguards**: Implemented robust lockdown functionality during active downloads. The UI disables all configuration panels, grays out exit buttons, and injects a `beforeunload` browser hook to forcefully block accidental page refreshes that would sever the download connection.
- **Resume & Cancellation**: Introduced an explicit red "Cancel" button utilizing `AbortController`. The system allows admins to safely sever the connection at any time while Ollama intelligently caches the progress to the hard drive, allowing seamless resuming at a later time.

## 3. Standalone Dispatch Gateway
- **Native OS Push Notifications**: Upgraded the Central Dispatch Center (`/dispatch`) to act as a robust, free alternative to Twilio. It now triggers native system-level push notifications for incidents, ensuring operators are instantly alerted even if their browser is minimized.
- **Dynamic Audio Sirens**: Embedded a multi-severity audio alarm system. The browser plays different looping siren tracks (`critical.mp3`, `high.mp3`, `medium.mp3`, `low.mp3`) based on the threat level until manually acknowledged.
- **Audio Testing Panel**: Added an interactive testing bank on the All Clear screen. Operators can manually test the siren for each threat level (Critical, High, Medium, Low) to familiarize themselves with the sounds before a real emergency occurs, complete with a dedicated Mute button.
- **Security Lock Screen**: Implemented a mandatory "Start Monitoring" lock screen to cleanly bypass modern browser Autoplay policies, granting the system explicit permission to fire audio and push alerts at any time.

---

# Changelog: Version 5.0

## 1. AwareX Rebranding & UI Polish
- **Official Branding**: The project has officially been named **AwareX**. Next.js meta tags, dashboard headers, and metadata descriptions were thoroughly updated to reflect this new premium identity.
- **Mobile Responsiveness**: The Central Dispatch Center (`/dispatch`) was entirely rewritten using Tailwind CSS responsive prefixes. It now flawlessly scales its typography and layout to look imposing on massive secondary monitors, while stacking neatly for thumb-friendly usage on mobile phones and tablets during an emergency.

## 2. Dynamic IP Camera Manager (SQLite)
- **Zero-Code Camera Deployment**: Removed rigid source selection buttons in favor of a dynamic dropdown menu powered by the SQLite database.
- **Management Modal**: A brand new sleek dark-mode modal was added directly to the main dashboard. Non-technical security operators can now visually view, add, and securely delete external IP cameras (RTSP/HTTP streams) on the fly without touching a single line of code.
- **Windows Webcam Stability Fix**: Integrated a `cv2.CAP_DSHOW` explicit hardware initialization fallback for Windows integer webcams, completely resolving silent freezing bugs when OpenCV struggles to locate standard cameras.

## 3. Remote Access & Next.js Reverse Proxy
- **Bypassing Windows Firewall**: Re-engineered the Next.js network layer (`next.config.ts`) to act as a stealthy reverse proxy. All frontend API requests to the Python backend (`:8000`) are now internally proxied through the Next.js server (`:3000`). This completely bypasses restrictive Windows Defender inbound port blocking, allowing seamless LAN access.
- **Tailscale P2P VPN Guide**: Shipped a comprehensive setup document detailing how to establish a zero-configuration mesh network to securely stream AwareX feeds and incident logs from anywhere in the world. **[View Tailscale Setup Guide](tailscale_setup_guide.md)**

---

# Changelog: Version 4.0

## 1. Advanced Threat Detection Features
- **Multi-Modal Audio Processing**: The system now listens as well as it watches.
  - *Live Webcam*: Monitors the host machine's microphone in the background for loud volume spikes (screams, glass breaking) and injects an alert directly into the AI's reasoning context.
  - *Video Files*: Uploaded video files are automatically processed via FFmpeg. The audio track is extracted and played in perfect sync with the video frames, pausing dynamically alongside the video when the AI kicks in for analysis.
- **Loitering Detection**: Upgraded the Vision Engine to use YOLO's official object tracking (`model.track()`). The system now tracks how long an individual has been standing in the frame and triggers a specific behavior alert if they loiter for too long.
- **AI Confidence Scoring**: The Vision Language Model now rates its own analysis certainty (0-100%). This score is displayed visually via a color-coded progress bar on the dashboard.

## 2. Central Dispatch & Logs Portals
- **Dispatch Center View**: A dedicated Next.js route (`/dispatch`) designed for a secondary monitor. If a `CRITICAL` or `HIGH` severity incident is logged, this screen pulses red and displays a massive alert that must be manually acknowledged by an operator.
- **Logs Management**: A protected route (`/logs`) accessible only via the `.admin_access` token. It provides a clean table view of the entire SQLite database history, allowing admins to clear or delete specific logs.

## 3. Core Architectural Upgrades
- **SQLite Database Integration**: Ripped out the fragile in-memory Python list holding incident history and replaced it with a persistent SQLite database (`incidents.db`). Analysis logs now survive server restarts.
- **Motion-Activated Optimization**: Implemented OpenCV Gaussian Blur and Absolute Differencing before the heavy YOLO block. The system calculates a motion score and entirely skips AI processing if the ATM scene is static, saving immense CPU/GPU resources.
- **Strict Interval & Playback Sync**: 
  - AI analysis triggers now strictly respect the user's custom interval timer, preventing API spam during continuous loitering events.
  - Video uploads no longer stream at 100+ FPS. The backend extracts the original framerate and dynamically calculates playback sleep timers, resulting in perfect real-time streaming.

---

# Changelog: Version 3.5

## 1. The Admin Portal & Multi-Provider System
We introduced a brand new model selection system, allowing the application to utilize both local and free open-source cloud models for visual reasoning.

- **Passwordless Security**: A separate Streamlit frontend (`admin.py`) was created. To access it, you simply need the hidden `.admin_access` file in your root directory. This provides robust security without the friction of typing passwords.
- **Multi-Provider Support**: The backend agent (`core/agent.py`) was entirely rewritten. It now dynamically routes image data to the provider you select in the Admin Portal. Supported providers include:
  - Local **Ollama** (e.g., Moondream)
  - **Google Gemini** (Gemini 1.5 Flash/Pro)
  - **Groq** (Llama 3.2 Vision)
  - **Hugging Face** Inference API
- **Unified Launch Script**: `run.bat` was refactored. It now uses the Windows `start` command to cleanly open both the user dashboard and the admin portal in their own dedicated terminal windows simultaneously.
- **Integrated Navigation**: A smart link was added to the main app's sidebar. If you have admin access, you'll see a clickable link to jump straight to the Admin Portal. Additionally, the main app displays a subtle indicator showing which VLM is currently active.

## 2. Webhook & Dashboard Synchronization
Previously, the Twilio webhook server was completely detached from the Streamlit UI.
- **Shared State**: We introduced a `status.json` file to bridge the gap.
- **Remote Stopping**: If an authority figure replies "Stop" to a Twilio alert via WhatsApp or SMS, the `webhook_server.py` writes this command to `status.json`. The Streamlit app polls this file and will safely halt the live video feed automatically.

## 3. UI & UX Refinements
Based on visual feedback and usability testing, several dashboard tweaks were applied:
- **Location Context Removed**: The manual "Location Context" dropdown was removed. The VLM is now trusted to infer the environment entirely from the visual feed, decluttering the sidebar.
- **Initial State**: The dashboard now correctly states it is `"Waiting..."` for input upon launch, rather than falsely displaying `"Analysing..."`.
- **Dynamic Scrollbar**: Custom CSS was injected into the AI Incident Report container (`max-height: 200px; overflow-y: auto;`), ensuring that highly detailed reports generated by advanced cloud models won't break the page layout.

## 4. Performance & Bug Fixes
Several underlying bugs impacting performance and stability were patched:
- **Frame Skipping logic**: The `config.Frame_Skip` parameter was finally integrated into the main `while` loop. The YOLO model now skips processing every single frame, massively reducing CPU/GPU overhead.
- **Prompt Parroting Fix**: Smaller local models (like Moondream) were outputting literal template text. The VLM prompt was entirely re-engineered with explicit negative constraints and a concrete "Example Valid Response" to force authentic reasoning.
- **JSON Parsing Robustness**: Added regex-based fallback logic to `agent.py` to extract JSON from model responses even if the VLM hallucinates markdown formatting.
- **Dynamic Timezones**: Removed the hardcoded `"IST"` strings in incident reports, replacing them with dynamic system timezone fetching.
- **Temp File Error `[WinError 32]`**: When uploading videos, `NamedTemporaryFile` locks the file in Python on Windows. We added an explicit `tfile.close()` command right after the file is copied to disk. This completely resolves the scary red error logs and ensures temporary storage is properly cleaned up after use.

## 5. Continuous Alerting System
We updated the Twilio alert logic (`core/decision.py`) to keep authorities continuously informed rather than only alerting on critical emergencies.
- **Always-On Alerts**: The system now pushes incident reports to WhatsApp or SMS during every analysis interval, regardless of whether the threat level is High, Medium, or Low.
- **Dynamic Message Formatting**: To prevent alert fatigue and clearly communicate urgency, the outgoing messages are now dynamically formatted. The message title and emojis instantly convey the severity (e.g., 🚨 CRITICAL, ⚠️ WARNING, or ℹ️ INFO) so the recipient knows whether immediate action is required or if it's just a routine monitoring update. **[View Twilio Setup Guide](twilio_free_setup_guide.md)**