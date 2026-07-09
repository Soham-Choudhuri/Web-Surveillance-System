# Use Your Mobile Phone as a Wireless Security Camera

You don't need to buy expensive IP cameras to use AwareX. You can use your spare Android or iOS device as a high-quality, wireless security camera!

Even better, by using **Tailscale**, you can leave your phone running at a completely different location (like your college dorm or office), and securely connect it to your home PC running AwareX—**with zero port forwarding or router configuration.**

---

## Step 1: Install Tailscale on Your Phone

To connect your phone securely to your home PC over the internet, we will put both devices on the same Virtual Private Network using Tailscale.

1. Download **Tailscale** from the Google Play Store (Android) or Apple App Store (iOS).
2. Open the app and log in with the **same account** you used to set up Tailscale on your PC.
3. Toggle the VPN switch to **Active**.
4. Tap on your device's name to view its **Tailscale IP address** (it usually starts with `100.x.x.x`). Write this IP address down; you will need it later.

---

## Step 2: Install an IP Camera App

We need an app to broadcast your phone's camera feed over the network. 

### For Android Users (Recommended: "IP Webcam")
1. Download **IP Webcam** by Pavel Khlebovich from the Google Play Store.
2. Open the app. Scroll down and tap **Start server**.
3. The camera will open, and an IP address will appear at the bottom of the screen. Ignore the IP address shown on the screen (since it's your local Wi-Fi IP), and instead, use your Tailscale IP.
4. Your video stream URL will be: `http://<YOUR_TAILSCALE_IP>:8080/video`
   *(Example: `http://100.123.45.67:8080/video`)*

### For iOS Users (Recommended: "DroidCam")
1. Download **DroidCam Wireless Webcam** from the Apple App Store.
2. Open the app and grant it camera permissions.
3. Your video stream URL will be: `http://<YOUR_TAILSCALE_IP>:4747/video`
   *(Example: `http://100.123.45.67:4747/video`)*

---

## Step 3: Connect AwareX to Your Phone

Now that your phone is broadcasting its camera over the secure Tailscale network, it's time to connect the AI!

1. Open your AwareX web dashboard.
2. Under the **Control Panel**, click the small **MANAGE CAMERAS** button next to "Input Source".
3. Click **Add New Camera**.
4. Enter a name (e.g., "College Dorm Phone").
5. In the URL field, carefully paste the full stream URL from Step 2 (e.g., `http://100.123.45.67:8080/video`).
6. Click **Save**.
7. In the "Input Source" dropdown, select your new camera and click **Start Stream**.

The AI is now actively monitoring the video feed coming directly from your mobile phone, anywhere in the world!

> [!TIP]
> Keep your phone plugged into a charger if you plan to run it for long periods, as streaming video over a VPN consumes battery.
