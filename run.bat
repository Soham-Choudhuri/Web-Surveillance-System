@echo off
setlocal

rem Define virtual environment folder name
set VENV_DIR=venv

rem Check if virtual environment exists
if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [INFO] No virtual environment found. Creating one now...
    python -m venv %VENV_DIR%
    if errorlevel 1 (
        echo [ERROR] Failed to create virtual environment. Ensure Python is installed and added to PATH.
        pause
        exit /b 1
    )
    echo [INFO] Virtual environment created successfully.
)

rem Activate the virtual environment
echo [INFO] Activating virtual environment...
call "%VENV_DIR%\Scripts\activate.bat"

rem Install requirements
echo [INFO] Checking and installing requirements from requirements.txt...
"%VENV_DIR%\Scripts\python.exe" -m pip install -r requirements.txt

rem Install frontend dependencies
echo [INFO] Checking and installing frontend dependencies...
if exist "frontend\package.json" (
    cd frontend
    call npm install
    cd ..
)

rem Run the Unified Application
echo.
echo =======================================================
echo [INFO] Starting the AI Surveillance System...
echo [INFO] Launching FastAPI Backend (Port 8000)...
echo [INFO] Launching Next.js Frontend (Port 3000)...
echo [INFO] FastAPI will manage the local Ollama AI Engine...
echo [INFO] Opening Interactive Console...
echo =======================================================
echo.

rem Launch the servers in their own dedicated windows
start "AI Surveillance - Backend API" cmd /k ""%VENV_DIR%\Scripts\python.exe" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000"

rem Wait dynamically for the backend (PyTorch/YOLO) to load into memory
echo [INFO] Waiting dynamically for AI Engine to initialize in memory...
:waitloop
curl -s -f http://127.0.0.1:8000/api/state >nul 2>&1
if %errorlevel% neq 0 (
    timeout /t 1 /nobreak >nul
    goto waitloop
)
echo [INFO] AI Engine is fully loaded and listening on port 8000!

rem Start Tailscale Secure Proxy if available
where tailscale >nul 2>nul
if %errorlevel% equ 0 (
    echo [INFO] Tailscale detected. Clearing previous bindings to prevent port conflicts...
    tailscale serve --https=443 off
    echo [INFO] Binding secure public HTTPS funnel to port 3000...
    start "Tailscale Funnel" cmd /k "tailscale funnel 3000"
) else (
    echo [INFO] Tailscale not detected locally. Skipping public funnel.
)

start "AI Surveillance - Web UI" cmd /k "cd frontend && npm run dev -- -H 0.0.0.0"

rem Launch a fourth window that remains open and empty for your own manual commands
start "AI Surveillance - Interactive Console" cmd /k "echo [READY] This terminal is initialized. You can run manual commands here."

echo [INFO] All services and an interactive console have been launched.
exit