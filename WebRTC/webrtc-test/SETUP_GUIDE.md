# Quick Setup Guide: Two Users on Different Laptops

## Visual Explanation

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR NETWORK                                │
│                                                                      │
│   ┌──────────────┐          ┌──────────────────────────┐          │
│   │   LAPTOP 1   │          │       LAPTOP 2           │          │
│   │  (User A)    │◄────────►│       (User B)           │          │
│   │              │   INTERNET/WIFI                     │          │
│   │ Browser:     │          │ Browser:                 │          │
│   │ localhost:3000          │ localhost:3000           │          │
│   └──────┬───────┘          └──────────┬─────────────┘          │
│          │                               │                        │
│          │        NEEDS THIS:            │                        │
│          └───────────┬───────────────────┘                        │
│                      │                                            │
│              ┌───────▼───────┐                                    │
│              │    SERVER     │                                    │
│              │  (Can be      │                                    │
│              │  Laptop 1     │                                    │
│              │  or Laptop 2  │                                    │
│              │  or Cloud)    │                                    │
│              │               │                                    │
│              │ Port 3001     │                                    │
│              │ Port 8080     │                                    │
│              └───────────────┘                                    │
└─────────────────────────────────────────────────────────────────────┘
```

## SIMPLE STEPS (No Docker Needed)

### STEP 1: Choose ONE computer as the SERVER
- This can be either laptop
- Or you can use a cloud server (AWS, DigitalOcean, etc.)

### STEP 2: Start the SERVER (on the chosen computer)

Open Terminal/Command Prompt and run:

```
bash
# 1. Go to the project folder
cd webrtc-test

# 2. Install and start the signaling server
cd server
npm install
node https-server.js
```

Keep this terminal open! You should see:
```
🚀 HTTPS Signaling server running on https://0.0.0.0:3001
```

### STEP 3: Get your SERVER IP address

**On Windows:**
- Open Command Prompt
- Type: `ipconfig`
- Look for "IPv4 Address" (e.g., `192.168.1.100`)

**On Mac/Linux:**
- Open Terminal
- Type: `ifconfig`
- Look for "inet" (e.g., `192.168.1.100`)

**On Cloud Server:**
- Your public IP address from your cloud provider

### STEP 4: Configure BOTH laptops

On EACH laptop, edit this file:
`webrtc-test/client/src/App.js`

Change this line:
```
javascript
// OLD (only works on same computer):
const SERVER_URL = 'https://172.16.0.125:3001';

// NEW (use YOUR server's IP):
const SERVER_URL = 'https://192.168.1.100:3001';  // Use YOUR IP!
```

### STEP 5: Run the frontend on BOTH laptops

```
bash
# Go to client folder
cd webrtc-test/client

# Install dependencies (first time only)
npm install

# Start the app
npm start
```

### STEP 6: Use the app!

1. **User A:** 
   - Open http://localhost:3000 in browser
   - Click "Create Room"
   - Copy the Room ID (e.g., `abc12345`)

2. **User B:**
   - Open http://localhost:3000 in browser
   - Enter the Room ID: `abc12345`
   - Click "Join Room"

## TROUBLESHOOTING

### "Cannot connect to server" error?
- Make sure the server is running (STEP 2)
- Make sure you entered the correct IP in STEP 4
- Check防火墙 (firewall) allows ports 3001 and 8080

### "Camera not working"?
- Click the camera icon in browser address bar
- Select "Allow"

### "WebRTC connection failed"?
- Both laptops need HTTPS (or use localhost)
- If using local network, it should work with the IP

## Important Notes

1. **The server must stay running** while using the app
2. **Both users must use the SAME server IP** (STEP 4)
3. **You need the AI backend too** for face swap (optional for basic video call):
   
```
bash
   cd webrtc-test/backend
   ./mvnw spring-boot:run
   
```

## Quick Test (Same Laptop)
To test if it works, just open TWO browser tabs:
- Tab 1: http://localhost:3000 → Create Room
- Tab 2: http://localhost:3000 → Join with Room ID

This tests the video call without needing two laptops!
