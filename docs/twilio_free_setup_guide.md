# Completely Free Twilio Setup Guide for ATM Surveillance Alerts

This guide will walk you through configuring the **Twilio SMS & WhatsApp** alerting system built into this ATM Surveillance Agent. By utilizing Twilio's generous free trial, you can set up the entire notification and two-way control system **financially free of cost**.

> [!NOTE]
> Twilio provides a free trial credit (usually $15) and a free virtual phone number when you sign up. For WhatsApp, Twilio provides a free "Sandbox" environment. These are more than enough for development, testing, and personal use without ever needing to attach a credit card.

---

## Step 1: Create your Free Twilio Account

1. Go to [Twilio's Sign-Up Page](https://www.twilio.com/try-twilio).
2. Fill in your details (Name, Email, Password).
3. Verify your email address.
4. Verify your personal phone number (this is the number you will use to receive alerts during the free trial phase).
5. When asked about your goals, select **SMS** and/or **WhatsApp**, and choose that you are building for **development/testing**.

---

## Step 2: Retrieve your API Credentials

Once logged into your Twilio Console dashboard:
1. Scroll down to the **Account Info** section on the main dashboard page.
2. Note down your **Account SID**.
3. Note down your **Auth Token** (you will need to click 'Show' to reveal it).

> [!IMPORTANT]
> Keep your Auth Token secret. Treat it like a password.

---

## Step 3: Choose Your Alert Method (SMS or WhatsApp)

You can use either SMS or WhatsApp. Follow the sub-step for the one you prefer.

### Option A: Standard SMS Setup
1. On your Twilio Console, click the **Get a trial phone number** button.
2. Twilio will assign you a free virtual phone number (e.g., `+1 234 567 8900`).
3. Note down this **Twilio Phone Number**.

### Option B: WhatsApp Sandbox Setup
To send WhatsApp messages for free, you must use the Twilio WhatsApp Sandbox.
1. In the Twilio Console, go to **Messaging** -> **Try it out** -> **Send a WhatsApp message**.
2. You will see a Twilio Sandbox WhatsApp number and a join code (e.g., `join your-secret-word`).
3. Open WhatsApp on your personal phone (the one receiving alerts).
4. Send the exact message `join your-secret-word` to the Sandbox number provided.
5. You should receive an automated reply confirming you have joined the sandbox.
6. Note down the **Twilio Sandbox Number**.

---

## Step 4: Configure the Project Dashboard

The ATM Surveillance project comes with a built-in admin dashboard that manages these credentials.

1. Ensure your backend and frontend are running.
2. Open your browser and navigate to the **Admin Portal** (e.g., `http://localhost:3000/admin`).
3. Scroll down to the **Communications & Alerts** section.
4. Fill in the fields:
   - **Twilio Account SID**: Paste your Account SID from Step 2.
   - **Auth Token**: Paste your Auth Token from Step 2.
   - **Message Type**: Select either `Standard SMS` or `WhatsApp Message` based on your choice in Step 3.
   - **Sender Number (Twilio)**: Enter the Twilio Virtual Number (for SMS) or Twilio Sandbox Number (for WhatsApp). *Note: Ensure you include the `+` and country code. The system will automatically add the `whatsapp:` prefix for you, so you only need to enter the raw phone number (e.g., `+14155238886`).*
   - **Receiver Authority Number**: Enter your personal, verified phone number (e.g., `+917003292005`).
5. Click **Save Configuration**. The system will save these to `model_config.json`.

---

## Step 5: Enable Two-Way Communication (Webhooks)

Your system supports receiving replies (like texting "Status" or "Stop" to pause monitoring). For Twilio to send these replies to your local computer, you need to securely expose your local backend to the internet. 

We highly recommend using **Tailscale Funnel** (see **[Tailscale Setup Guide]((tailscale_setup_guide.md))**) because it gives you a **permanent**, highly secure URL for free!

1. Generate your permanent public URL using Tailscale Funnel. On your Host PC, open a terminal and run `tailscale funnel 3000`. This will give you a permanent URL (e.g., `https://awarex.tailc61015.ts.net`).
2. **Link it to Twilio:**
   - **For SMS:** Go to **Phone Numbers** -> **Manage** -> **Active Numbers** in Twilio. Click your number. Scroll to **Messaging**, and under "A MESSAGE COMES IN", paste your Tailscale URL followed by `/sms-webhook` (e.g., `https://awarex.tailc61015.ts.net/sms-webhook`).
   - **For WhatsApp:** Go to **Messaging** -> **Settings** -> **WhatsApp Sandbox Settings**. In the "WHEN A MESSAGE COMES IN" field, paste your Tailscale URL followed by `/whatsapp-webhook` (e.g., `https://awarex.tailc61015.ts.net/whatsapp-webhook`).
3. Save the configuration in Twilio.

> [!TIP]
> Unlike other tools like `ngrok` which change your URL every time you restart your computer, your Tailscale Funnel URL is permanent! You will never need to update Twilio again.

## Step 6: Test the System!

1. Start your video feed monitoring.
2. Trigger an alert (e.g., simulating a threat in the camera feed).
3. You should instantly receive an SMS or WhatsApp message on your phone!
4. **Test Two-Way Comms:** Reply to the message with the word `Help`. You should receive a menu of commands. Reply with `Stop` to remotely turn off the local system's monitoring state!
