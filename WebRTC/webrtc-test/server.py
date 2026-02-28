"""
AI Face Swap Backend Server
Receives video frames from WebRTC frontend via WebSocket,
processes them with Deep-Live-Cam face swap, and returns processed frames.

Requirements:
    pip install fastapi uvicorn websockets opencv-python numpy pillow python-multipart
    pip install insightface onnxruntime  (or onnxruntime-gpu for NVIDIA GPU)

Run:
    python server.py
"""

import asyncio
import base64
import json
import logging
import os
import time
from io import BytesIO
from typing import Optional

import cv2
import numpy as np
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image

# ─── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ─── App ─────────────────────────────────────────────────────────────────────
app = FastAPI(title="Deep-Live-Cam WebRTC Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Global State ────────────────────────────────────────────────────────────
source_face_image: Optional[np.ndarray] = None   # The "source" face image
face_swapper = None                               # InsightFace model
face_analyser = None                              # InsightFace analyser
model_loaded = False
processing_enabled = False

# ─── Load InsightFace Models ─────────────────────────────────────────────────
def load_models():
    global face_swapper, face_analyser, model_loaded
    try:
        import insightface
        from insightface.app import FaceAnalysis

        log.info("Loading InsightFace models...")
        face_analyser = FaceAnalysis(name="buffalo_l", providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
        face_analyser.prepare(ctx_id=0, det_size=(640, 640))

        model_path = os.path.join("models", "inswapper_128.onnx")
        if not os.path.exists(model_path):
            log.warning(f"⚠️  Face swap model not found at {model_path}")
            log.warning("Download from: https://github.com/facefusion/facefusion-assets/releases")
            log.warning("Running in PASSTHROUGH mode (no face swap)")
            model_loaded = False
            return

        face_swapper = insightface.model_zoo.get_model(model_path, providers=["CUDAExecutionProvider", "CPUExecutionProvider"])
        model_loaded = True
        log.info("✅ InsightFace models loaded successfully")

    except ImportError:
        log.warning("⚠️  InsightFace not installed. Running in PASSTHROUGH mode.")
        log.warning("Install: pip install insightface onnxruntime")
        model_loaded = False
    except Exception as e:
        log.error(f"❌ Failed to load models: {e}")
        model_loaded = False


def get_face(img: np.ndarray):
    """Detect the first face in an image."""
    if face_analyser is None:
        return None
    faces = face_analyser.get(img)
    return sorted(faces, key=lambda x: x.bbox[0])[0] if faces else None


def swap_face(source_img: np.ndarray, target_img: np.ndarray) -> np.ndarray:
    """Swap face from source_img onto target_img."""
    if not model_loaded or face_swapper is None or face_analyser is None:
        return target_img  # passthrough

    try:
        source_face = get_face(source_img)
        if source_face is None:
            log.debug("No face detected in source image")
            return target_img

        target_face = get_face(target_img)
        if target_face is None:
            log.debug("No face detected in target frame")
            return target_img

        result = face_swapper.get(target_img, target_face, source_face, paste_back=True)
        return result
    except Exception as e:
        log.error(f"Face swap error: {e}")
        return target_img


# ─── Frame helpers ────────────────────────────────────────────────────────────
def decode_frame(data_url: str) -> Optional[np.ndarray]:
    """Decode a base64 data URL to a numpy image array."""
    try:
        if "," in data_url:
            data_url = data_url.split(",", 1)[1]
        img_bytes = base64.b64decode(data_url)
        img = Image.open(BytesIO(img_bytes)).convert("RGB")
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    except Exception as e:
        log.error(f"Frame decode error: {e}")
        return None


def encode_frame(frame: np.ndarray, quality: int = 75) -> str:
    """Encode a numpy image array to a base64 JPEG data URL."""
    _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    b64 = base64.b64encode(buf).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"


# ─── REST Endpoints ───────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {
        "status": "ok",
        "model_loaded": model_loaded,
        "processing_enabled": processing_enabled,
        "source_face_set": source_face_image is not None,
    }


@app.post("/api/source-face")
async def upload_source_face(file: UploadFile = File(...)):
    """Upload the source face image for face swapping."""
    global source_face_image
    try:
        contents = await file.read()
        img = Image.open(BytesIO(contents)).convert("RGB")
        source_face_image = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        log.info(f"✅ Source face image set: {file.filename} ({source_face_image.shape})")
        return {"success": True, "message": "Source face uploaded successfully"}
    except Exception as e:
        log.error(f"Failed to upload source face: {e}")
        return {"success": False, "message": str(e)}


@app.post("/api/toggle-processing")
def toggle_processing(body: dict):
    """Enable or disable face swap processing."""
    global processing_enabled
    processing_enabled = body.get("enabled", False)
    log.info(f"Processing {'ENABLED' if processing_enabled else 'DISABLED'}")
    return {"processing_enabled": processing_enabled}


# ─── WebSocket Frame Processing ───────────────────────────────────────────────
@app.websocket("/ws/face-swap")
async def face_swap_ws(websocket: WebSocket):
    """
    WebSocket endpoint for real-time frame processing.

    Client sends: JSON { "frame": "<base64 data url>", "userId": "..." }
    Server sends: JSON { "frame": "<base64 data url>", "userId": "..." }
    """
    await websocket.accept()
    client_ip = websocket.client.host
    log.info(f"🟢 WebSocket connected: {client_ip}")

    frame_count = 0
    start_time = time.time()

    try:
        while True:
            # Receive frame
            raw = await websocket.receive_text()
            data = json.loads(raw)
            frame_data = data.get("frame")
            user_id = data.get("userId", "unknown")

            if not frame_data:
                continue

            # Decode
            frame = decode_frame(frame_data)
            if frame is None:
                continue

            # Process
            if processing_enabled and source_face_image is not None:
                processed = await asyncio.get_event_loop().run_in_executor(
                    None, swap_face, source_face_image, frame
                )
            else:
                processed = frame  # passthrough when disabled

            # Encode and send back
            out_b64 = encode_frame(processed)
            await websocket.send_text(json.dumps({
                "frame": out_b64,
                "userId": user_id
            }))

            # FPS logging
            frame_count += 1
            elapsed = time.time() - start_time
            if elapsed >= 5.0:
                fps = frame_count / elapsed
                log.info(f"📊 Processing FPS: {fps:.1f} | model: {'✅' if model_loaded else '⚠️ passthrough'}")
                frame_count = 0
                start_time = time.time()

    except WebSocketDisconnect:
        log.info(f"🔴 WebSocket disconnected: {client_ip}")
    except Exception as e:
        log.error(f"WebSocket error: {e}")
        await websocket.close()


# ─── Startup ──────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    log.info("🚀 Starting AI Face Swap Backend...")
    os.makedirs("models", exist_ok=True)
    load_models()
    log.info("✅ Server ready on http://0.0.0.0:8000")
    if not model_loaded:
        log.warning("⚠️  Running in PASSTHROUGH mode — frames returned unmodified")
        log.warning("   To enable face swap, download inswapper_128.onnx to ./models/")


# ─── Run ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)