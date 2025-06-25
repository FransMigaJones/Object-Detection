from fastapi import FastAPI, Request, File, UploadFile
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
from ultralytics import YOLO
import threading
import time
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = YOLO("yolov8n.pt")

# Warm-up with dummy image
dummy_image = np.zeros((640, 480, 3), dtype=np.uint8)
model(dummy_image)

cap = cv2.VideoCapture(0)
lock = threading.Lock()

# Store unique object names from all sources
detected_objects_log = set()

@app.on_event("shutdown")
def shutdown_event():
    cap.release()

# ----------------------------
# Webcam Frame Generator
# ----------------------------
def generate_frames(width: int, height: int):
    try:
        while True:
            with lock:
                success, frame = cap.read()
            if not success:
                time.sleep(0.1)
                continue

            frame = cv2.resize(frame, (width, height))
            results = model(frame, verbose=False)
            annotated_frame = frame.copy()

            current_frame_objects = []

            for box, score, cls in zip(
                results[0].boxes.xyxy.cpu().numpy(),
                results[0].boxes.conf.cpu().numpy(),
                results[0].boxes.cls.cpu().numpy()
            ):
                x1, y1, x2, y2 = map(int, box)
                label_name = model.names[int(cls)]
                label = f"{label_name} {score:.2f}"
                color = (0, 255, 0)

                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                (tw, th), bl = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                cv2.rectangle(annotated_frame, (x1, y1 - th - bl), (x1 + tw, y1), color, -1)
                cv2.putText(annotated_frame, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

                current_frame_objects.append(label_name)

            for obj in set(current_frame_objects):
                detected_objects_log.add(obj)

            ret, buffer = cv2.imencode('.jpg', annotated_frame)
            frame_bytes = buffer.tobytes()

            yield (
                b'--frame\r\n'
                b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n'
            )
    except GeneratorExit:
        pass
    except Exception as e:
        print(f"Error in frame generator: {e}")

# ----------------------------
# Routes
# ----------------------------
@app.get("/")
def index():
    return {"message": "Go to /video?width=640&height=480 for stream"}

@app.get("/video")
def video_feed(request: Request):
    try:
        width = int(request.query_params.get("width", 640))
        height = int(request.query_params.get("height", 480))
    except ValueError:
        width, height = 640, 480

    return StreamingResponse(generate_frames(width, height), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/detections")
def get_detections():
    return JSONResponse(content={"detected_objects": list(detected_objects_log)})

# ----------------------------
# Image Upload Detection
# ----------------------------
@app.post("/upload/")
async def upload_image(file: UploadFile = File(...)):
    contents = await file.read()
    np_image = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(np_image, cv2.IMREAD_COLOR)

    if image is None:
        return JSONResponse(content={"error": "Invalid image"}, status_code=400)

    results = model(image, verbose=False)
    detected = set()

    if results and results[0].boxes:
        for cls in results[0].boxes.cls.cpu().numpy():
            label = model.names[int(cls)]
            detected.add(label)
            detected_objects_log.add(label)

    return JSONResponse(content={"detected": list(detected)})
