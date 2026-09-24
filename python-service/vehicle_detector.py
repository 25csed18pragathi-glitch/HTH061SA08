"""
vehicle_detector.py — Real YOLO-based vehicle detection using OpenCV + NumPy.

Uses YOLOv8n (nano) via the ultralytics library for lightweight local inference.

COCO class mapping to FlowSync vehicle categories:
  COCO class 1  (bicycle)      → cycle
  COCO class 3  (motorbike)    → bike
  COCO class 2  (car)          → car
  COCO class 5  (bus)          → heavy
  COCO class 7  (truck)        → heavy

IMPORTANT — "auto" (auto-rickshaw) is NOT a standard COCO class.
YOLOv8 trained on COCO cannot directly detect auto-rickshaws.
Autos are NOT fabricated. The "auto" count will always be 0 unless:
  1. A custom-trained model with an auto-rickshaw class is provided, OR
  2. Post-processing heuristics are added (not implemented here).

This is clearly documented so no false claims are made.

Vehicle weights (from FlowSync trafficConfig.js):
  cycle = 0.1, bike = 0.2, auto = 0.3, car = 0.4, heavy = 1.0
"""

import os
import time
import numpy as np
import cv2

# Lazy-load ultralytics to provide a clean error if missing
_model = None
_model_name = None


def _get_model(model_path="yolov8n.pt"):
    """Load the YOLO model lazily. Returns (model, error_string)."""
    global _model, _model_name
    if _model is not None and _model_name == model_path:
        return _model, None
    try:
        from ultralytics import YOLO
        _model = YOLO(model_path)
        _model_name = model_path
        return _model, None
    except Exception as e:
        return None, f"Failed to load YOLO model '{model_path}': {e}"


# ---------------------------------------------------------------------------
# COCO class IDs → FlowSync category
# ---------------------------------------------------------------------------
COCO_TO_FLOWSYNC = {
    1: "cycle",      # bicycle
    3: "bike",       # motorbike
    2: "car",        # car
    5: "heavy",      # bus
    7: "heavy",      # truck
}

# All COCO vehicle-related class IDs we care about
VEHICLE_CLASS_IDS = set(COCO_TO_FLOWSYNC.keys())

# FlowSync density weights
DENSITY_WEIGHTS = {
    "cycle": 0.1,
    "bike":  0.2,
    "auto":  0.3,
    "car":   0.4,
    "heavy": 1.0,
}


def classify_traffic(density, total_vehicles):
    """Classify traffic using the same rules as the frontend."""
    if density > 15 or total_vehicles > 40:
        return "RUSH"
    if density > 6 or total_vehicles > 15:
        return "MODERATE"
    return "LOW"


def estimate_queue_length(boxes_in_queue_region, total_vehicles):
    """
    Estimate queue length from vehicles detected in the queue/stop region.

    This is an ESTIMATION, not an exact physical measurement.
    Queue region = lower 40% of the frame (near the stop line).
    Vehicles whose bounding-box center-Y falls in the queue region
    are counted as queued.
    """
    return int(boxes_in_queue_region)


def detect_vehicles(
    video_path,
    model_path="yolov8n.pt",
    confidence_threshold=0.35,
    frame_sample_interval=10,
    road="north",
    queue_region_fraction=0.4,
):
    """
    Run real YOLO vehicle detection on a video file.

    Returns a structured dict with actual detection results.
    Never fabricates counts — all values come from real inference.
    """
    start_time = time.time()

    # --- Load model ---
    model, model_error = _get_model(model_path)
    if model is None:
        return {
            "success": False,
            "error": model_error,
            "source": "video",
            "detectionModel": None,
        }

    # --- Open video with OpenCV ---
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return {
            "success": False,
            "error": f"Could not open video: {video_path}",
            "source": "video",
            "detectionModel": "YOLO",
        }

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration_seconds = round(total_frames / fps, 2) if fps > 0 else 0

    # Queue region: bottom portion of the frame
    queue_y_threshold = frame_height * (1.0 - queue_region_fraction)

    # --- Per-frame detection with deduplication ---
    # We track unique vehicles using a simple spatial tracking approach:
    # For each frame, we check if a detection's center is close to a
    # previously seen detection. If so, it's the same vehicle.
    # This prevents counting the same vehicle multiple times across frames.
    unique_vehicles = []  # list of (center_x, center_y, category)
    PROXIMITY_THRESHOLD = max(30, frame_width * 0.05)  # 5% of frame width

    frames_processed = 0
    frame_index = 0
    all_confidences = []
    queue_count = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Frame sampling — only process every Nth frame
        if frame_index % frame_sample_interval != 0:
            frame_index += 1
            continue

        frame_index += 1
        frames_processed += 1

        # Resize for faster inference if frame is very large
        inference_frame = frame
        scale = 1.0
        if frame_width > 1280:
            scale = 1280.0 / frame_width
            inference_frame = cv2.resize(
                frame,
                (1280, int(frame_height * scale)),
                interpolation=cv2.INTER_LINEAR,
            )

        # --- YOLO inference ---
        results = model(inference_frame, verbose=False, conf=confidence_threshold)

        for result in results:
            if result.boxes is None or len(result.boxes) == 0:
                continue

            # NumPy arrays from YOLO results
            boxes_xyxy = result.boxes.xyxy.cpu().numpy()      # (N, 4)
            confs = result.boxes.conf.cpu().numpy()            # (N,)
            class_ids = result.boxes.cls.cpu().numpy().astype(int)  # (N,)

            for i in range(len(class_ids)):
                cls_id = int(class_ids[i])
                if cls_id not in VEHICLE_CLASS_IDS:
                    continue

                conf = float(confs[i])
                if conf < confidence_threshold:
                    continue

                # Bounding box center (scale back to original coords)
                x1, y1, x2, y2 = boxes_xyxy[i]
                cx = float((x1 + x2) / 2.0) / scale
                cy = float((y1 + y2) / 2.0) / scale
                category = COCO_TO_FLOWSYNC[cls_id]

                all_confidences.append(conf)

                # Check queue region
                if cy >= queue_y_threshold:
                    queue_count += 1

                # Deduplication: check proximity to existing unique vehicles
                is_duplicate = False
                for ux, uy, ucat in unique_vehicles:
                    dist = np.sqrt((cx - ux) ** 2 + (cy - uy) ** 2)
                    if dist < PROXIMITY_THRESHOLD and ucat == category:
                        is_duplicate = True
                        break

                if not is_duplicate:
                    unique_vehicles.append((cx, cy, category))

    cap.release()

    # --- Aggregate counts using NumPy ---
    counts = {"cycle": 0, "bike": 0, "auto": 0, "car": 0, "heavy": 0}
    for _, _, cat in unique_vehicles:
        counts[cat] += 1

    total_vehicles = sum(counts.values())

    # Weighted density using NumPy
    count_array = np.array([counts[k] for k in DENSITY_WEIGHTS.keys()])
    weight_array = np.array([DENSITY_WEIGHTS[k] for k in DENSITY_WEIGHTS.keys()])
    density = float(np.dot(count_array, weight_array))

    traffic_status = classify_traffic(density, total_vehicles)

    # Deduplicated queue estimate (unique vehicles in queue region / frames)
    # Use ratio of queue detections to total detections as a scaling factor
    total_detections = len(all_confidences)
    if total_detections > 0 and frames_processed > 0:
        queue_ratio = queue_count / total_detections
        estimated_queue = int(round(total_vehicles * queue_ratio))
    else:
        estimated_queue = 0

    avg_confidence = float(np.mean(all_confidences)) if all_confidences else 0.0
    elapsed = round(time.time() - start_time, 2)

    return {
        "success": True,
        "source": "video",
        "detectionModel": "YOLO",
        "modelFile": model_path,
        "road": road,
        "counts": counts,
        "totalVehicles": total_vehicles,
        "density": round(density, 2),
        "trafficStatus": traffic_status,
        "queueLength": estimated_queue,
        "confidence": round(avg_confidence, 4),
        "framesProcessed": frames_processed,
        "totalFrames": total_frames,
        "fps": round(fps, 2),
        "durationSeconds": duration_seconds,
        "processingTime": elapsed,
        "frameSampleInterval": frame_sample_interval,
        "confidenceThreshold": confidence_threshold,
        "queueRegionFraction": queue_region_fraction,
        "classMapping": {
            "directlyDetected": ["cycle (bicycle)", "bike (motorbike)", "car", "heavy (bus+truck)"],
            "notDetected": ["auto (auto-rickshaw) — not in COCO dataset, always 0"],
        },
    }
