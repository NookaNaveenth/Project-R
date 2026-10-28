import cv2
import time
from insightface.app import FaceAnalysis

print("Loading InsightFace with liveness...")

app = FaceAnalysis(
    name="buffalo_l",
    addons=["liveness"],
    liveness_mode="normal",
    liveness_threshold=0.8
)

app.prepare(
    ctx_id=-1,
    det_size=(320, 320)
)

print("Model loaded.")
import os

os.environ.setdefault("OPENCV_LOG_LEVEL", "ERROR")

print("Starting camera...")

camera_source = os.getenv("FACE_CAMERA_SOURCE", "0")
device = int(camera_source) if camera_source.isdigit() else camera_source

if os.name == "nt" and isinstance(device, int):
    cap = cv2.VideoCapture(device, cv2.CAP_DSHOW)
else:
    cap = cv2.VideoCapture(device)

if not cap.isOpened():
    print(f"ERROR: Could not open camera {camera_source}. Please verify that the webcam is connected and not in use by another application (e.g. Google Chrome, Zoom, or another running script).")
    exit()

time.sleep(2)

for i in range(30):

    ret, frame = cap.read()

    if not ret:
        print("Frame capture failed")
        continue

    faces = app.get(frame)

    print(f"\nFrame {i + 1}: {len(faces)} face(s)")

    for face in faces:

        liveness = getattr(face, "liveness", None)

        print("Liveness object:", liveness)

        if liveness is not None:
            print("Status:", getattr(liveness, "status", None))
            print("Is Live:", getattr(liveness, "is_live", None))
            print("Live Score:", getattr(liveness, "live_score", None))

cap.release()

print("\nTest completed.")