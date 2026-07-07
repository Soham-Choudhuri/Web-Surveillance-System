# 📱 Mobile Phone Camera Setup Guide

Most desktop PCs don't come with built-in webcams, or they have poor viewing angles for a security system. Fortunately, AwareX is fully compatible with IP (Internet Protocol) cameras, meaning you can easily turn an old smartphone (Android or iOS) into a high-quality, wireless surveillance camera!

## How it Works
By installing a free "IP Camera" app on your phone, your phone broadcasts its camera feed over your local Wi-Fi network. AwareX can connect to this network stream and process it exactly as if it were a USB webcam plugged directly into your computer.

---

## Step 1: Install an IP Camera App

### For Android Users (Highly Recommended)
We recommend **IP Webcam** because it is free, reliable, and streams directly in MJPEG format without requiring desktop drivers.
1. Download **IP Webcam** from the Google Play Store.
2. Open the app and scroll down to the bottom.
3. Tap **Start server**.
4. The app will open your camera. Look at the bottom of the screen; it will display a local IP address (e.g., `http://192.168.1.15:8080`). 

### For iOS Users
We recommend **DroidCam** or **EpocCam**. 
1. Download **DroidCam** from the Apple App Store.
2. Ensure your phone and your PC are on the **exact same Wi-Fi network**.
3. Open the app. It will display a "WiFi IP" and "DroidCam Port" (e.g., `http://192.168.1.15:4747`).

---

## Step 2: Formulate your Camera URL

AwareX needs the direct video stream URL, not just the base IP address. 

- If you used **IP Webcam (Android)**, your video URL is your IP address with `/video` at the end.
  - *Example:* `http://192.168.1.15:8080/video`
- If you used **DroidCam (iOS/Android)**, your video URL is your IP address with `/video` at the end.
  - *Example:* `http://192.168.1.15:4747/video`

*(Test it! If you paste that full URL into your PC's web browser, you should see a live video feed from your phone.)*

---

## Step 3: Add the Camera to AwareX

1. Open your AwareX Dashboard (`http://localhost:3000`).
2. Under the **Control Panel**, look for the "Input Source" dropdown.
3. Click the small **MANAGE CAMERAS** button just above the dropdown.
4. A popup will appear. 
   - **Camera Name**: Give it a friendly name (e.g., "Living Room Phone")
   - **Stream URL/Index**: Paste the full video URL from Step 2 (e.g., `http://192.168.1.15:8080/video`).
5. Click **Save Camera**.

## Step 4: Start Monitoring!

1. Close the popup.
2. Click the "Input Source" dropdown. Your new "Living Room Phone" camera will now appear in the list!
3. Select it, set your Analysis Interval, and click **Start Stream**.

AwareX will connect wirelessly to your phone, bringing the live feed right into your dashboard and beginning its AI threat analysis!

> [!TIP]
> Keep your phone plugged into a charger if you plan to monitor for long periods, as broadcasting video over Wi-Fi consumes battery!
