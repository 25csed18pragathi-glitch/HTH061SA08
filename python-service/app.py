"""
FlowSync Python Detection Service — Flask REST API.

Endpoints:
  GET  /health         — service health + model status
  POST /detect         — upload video → run YOLO → return structured JSON

Configuration via .env or environment variables:
  FLASK_PORT             (default: 8000)
  YOLO_MODEL             (default: yolov8n.pt)
  CONFIDENCE_THRESHOLD   (default: 0.35)
  FRAME_SAMPLE_INTERVAL  (default: 10)
  MAX_UPLOAD_MB          (default: 500)
"""

import os
import sys
import tempfile
import traceback
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS

# Load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from vehicle_detector import detect_vehicles, _get_model

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
FLASK_PORT = int(os.getenv("FLASK_PORT", "8000"))
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8n.pt")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.35"))
FRAME_SAMPLE_INTERVAL = int(os.getenv("FRAME_SAMPLE_INTERVAL", "10"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "500"))

ALLOWED_EXTENSIONS = {".mp4", ".webm", ".mov", ".avi", ".mkv"}

app = Flask(__name__)
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_MB * 1024 * 1024

# Pre-load model on startup so the first request doesn't pay the cost
print(f"[FlowSync Python] Loading YOLO model: {YOLO_MODEL}")
_startup_model, _startup_error = _get_model(YOLO_MODEL)
if _startup_error:
    print(f"[FlowSync Python] WARNING: {_startup_error}")
    print("[FlowSync Python] Detection requests will fail until model is available.")
else:
    print(f"[FlowSync Python] YOLO model loaded successfully: {YOLO_MODEL}")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/health", methods=["GET"])
def health():
    """Health check — reports model availability."""
    model, error = _get_model(YOLO_MODEL)
    return jsonify({
        "status": "ok",
        "service": "flowsync-python-detection",
        "modelLoaded": model is not None,
        "modelFile": YOLO_MODEL,
        "modelError": error,
        "confidenceThreshold": CONFIDENCE_THRESHOLD,
        "frameSampleInterval": FRAME_SAMPLE_INTERVAL,
    })


@app.route("/detect", methods=["POST"])
def detect():
    """
    Accept a video upload, run YOLO detection, return structured JSON.

    Form fields:
      video  — the video file (required)
      road   — road name: north | south | east | west (default: north)
      confidence_threshold  — override (optional)
      frame_sample_interval — override (optional)
    """
    # --- Validate file upload ---
    if "video" not in request.files:
        return jsonify({"success": False, "error": "No video file uploaded. Use form field 'video'."}), 400

    video_file = request.files["video"]
    if not video_file.filename:
        return jsonify({"success": False, "error": "Empty filename."}), 400

    ext = Path(video_file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return jsonify({
            "success": False,
            "error": f"Unsupported format: {ext}. Supported: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        }), 400

    # --- Parse optional parameters ---
    road = request.form.get("road", "north").lower()
    if road not in ("north", "south", "east", "west"):
        road = "north"

    conf_thresh = float(request.form.get("confidence_threshold", str(CONFIDENCE_THRESHOLD)))
    sample_interval = int(request.form.get("frame_sample_interval", str(FRAME_SAMPLE_INTERVAL)))
    sample_interval = max(1, sample_interval)

    # --- Save to temp file ---
    tmp = None
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        video_file.save(tmp)
        tmp.close()

        # --- Run detection ---
        result = detect_vehicles(
            video_path=tmp.name,
            model_path=YOLO_MODEL,
            confidence_threshold=conf_thresh,
            frame_sample_interval=sample_interval,
            road=road,
        )

        status_code = 200 if result.get("success") else 500
        return jsonify(result), status_code

    except MemoryError:
        return jsonify({"success": False, "error": "Insufficient memory to process video."}), 507
    except Exception as e:
        traceback.print_exc()
        return jsonify({"success": False, "error": f"Detection failed: {str(e)}"}), 500
    finally:
        # Cleanup temp file
        if tmp and os.path.exists(tmp.name):
            try:
                os.unlink(tmp.name)
            except OSError:
                pass


@app.errorhandler(413)
def too_large(e):
    return jsonify({
        "success": False,
        "error": f"File too large. Maximum upload size is {MAX_UPLOAD_MB} MB.",
    }), 413


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"[FlowSync Python] Starting detection service on port {FLASK_PORT}")
    app.run(host="0.0.0.0", port=FLASK_PORT, debug=False)
