#!/usr/bin/env python3
"""
Simple MediaPipe Face Mesh test – copy this to your desktop and run it.
"""

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python.vision.face_landmarker import FaceLandmarker, FaceLandmarkerOptions
import sys

# Use the pre‑downloaded model (copy this file next to the .task file)
MODEL_PATH = 'face_landmarker.task'

if not os.path.exists(MODEL_PATH):
    print('❌ Model file not found – copy test_face_mesh_simple.py next to face_landmarker.task')
    sys.exit(1)

# Create detector
base = mp_tasks.BaseOptions(model_asset_path=MODEL_PATH)
options = FaceLandmarkerOptions(
    base_options=base,
    min_face_detection_confidence=0.3,
    min_face_presence_confidence=0.3,
    min_tracking_confidence=0.3,
)
detector = FaceLandmarker.create_from_options(options)
print('✅ MediaPipe detector created')

# Open camera
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print('❌ Camera 0 not available')
    for i in range(5):
        cap2 = cv2.VideoCapture(i)
        if cap2.isOpened():
            print(f'  Camera {i} works')
            cap2.release()
    sys.exit(1)

print('📷 Camera ready – press ESC to start')
while True:
    ret, frame = cap.read()
    if not ret:
        continue
    cv2.imshow('MediaPipe Test', frame)
    if cv2.waitKey(1) == 27:
        break

print('🔍 Starting detection...')
while True:
    ret, frame = cap.read()
    if not ret:
        continue
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = detector.detect_for_video(rgb, int(cap.get(cv2.CAP_PROP_POS_MSEC)))
    if result.face_landmarks:
        h, w = frame.shape[:2]
        # Draw all landmarks as green dots
        for lm in result.face_landmarks[0].landmarks:
            x = int(lm.x * w)
            y = int(lm.y * h)
            cv2.circle(frame, (x, y), 2, (0, 255, 0), -1)
        # Draw eye line
        try:
            le = result.face_landmarks[0].landmarks[33]
            re = result.face_landmarks[0].landmarks[263]
            cv2.line(frame, (int(le.x*w), int(le.y*h)), (int(re.x*w), int(re.y*h)), (255,0,0), 2)
        except:
            pass
    cv2.imshow('MediaPipe Test', frame)
    if cv2.waitKey(1) == 27:
        break

print('✅ Test complete')
cap.release()
cv2.destroyAllWindows()