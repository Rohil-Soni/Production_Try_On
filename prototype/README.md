# Glasses Try‑On Prototype – Quick Start

This folder contains a minimal MediaPipe Face Mesh demo that validates the AR pipeline before moving to the full Three.js implementation.

## Prerequisites
- Python 3.14 (system default) – works with our virtual env
- Virtual environment: `prototype/.venv`
- MediaPipe 0.10.33, OpenCV 4.5.5, NumPy 1.26.4 (installed via pip)
- Face landmark model: `prototype/face_landmarker.task` (3.6 MB download)

## Step 1 – Install dependencies (one‑time)
```bash
# Create and activate the virtual environment
python3 -m venv prototype/.venv
source prototype/.venv/bin/activate

# Install exact package versions
pip install mediapipe==0.10.33 opencv-contrib-python==4.5.5.64 numpy==1.26.4

# Download the face landmark model (run this once)
curl -L -o prototype/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
```

## Step 2 – Test camera access
```bash
# List available cameras
ls -la /dev/video*

# Try opening camera 0
python -c "import cv2; cap=cv2.VideoCapture(0); print('Camera 0:', cap.isOpened()); cap.release()"
```

If the camera fails to open, add yourself to the `video` group:
```bash
sudo usermod -a -G video $USER
# Then log out and back in (or reboot)
```

## Step 3 – Run the face‑mesh test
```bash
cd prototype
./venv/bin/python test_face_mesh.py
```

**What you should see:**
1. Blank window opens
2. Press **ESC** → window shows camera feed
3. Press **ESC** again → detection starts
4. Green dots appear on your face landmarks (468 points)
5. Blue line connects outer eye corners (33 ↔ 263)
6. Press **ESC** to exit

## Troubleshooting
- **No green dots:** Face not detected → improve lighting, move closer, ensure only one face in frame
- **Import errors:** Make sure you're in the `prototype/` directory and the model file exists
- **Camera permission:** Add to `video` group as above

Once this test works, you have a verified MediaPipe Face Mesh pipeline ready for the Three.js AR integration in Phase 2.
