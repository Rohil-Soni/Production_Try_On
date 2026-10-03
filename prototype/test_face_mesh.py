#!/usr/bin/env python3
"""
MediaPipe Face Mesh Prototype Test - Phase 1 Step 1
Tests face landmark detection and glasses overlay.
Press ESC to exit the window.
"""

import cv2
import numpy as np
from pathlib import Path
import sys

# Import MediaPipe
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python.vision.face_landmarker import FaceLandmarker, FaceLandmarkerOptions
import mediapipe as mp

# Check model file
MODEL_PATH = 'face_landmarker.task'
if not Path(MODEL_PATH).exists():
    print(f'ERROR: {MODEL_PATH} not found in {Path.cwd()}')
    sys.exit(1)

print(f'Model path: {Path(MODEL_PATH).resolve()}')
print(f'Model size: {Path(MODEL_PATH).stat().st_size / 1024 / 1024:.2f} MB')

# Create detector with IMAGE mode (default)
base = mp_tasks.BaseOptions(model_asset_path=MODEL_PATH)
options = FaceLandmarkerOptions(
    base_options=base,
    min_face_detection_confidence=0.3,
    min_face_presence_confidence=0.3,
    min_tracking_confidence=0.3,
)
detector = FaceLandmarker.create_from_options(options)
print('✅ FaceLandmarker created successfully')

# Open webcam
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print('❌ Camera 0 not available')
    for i in range(5):
        cap2 = cv2.VideoCapture(i)
        if cap2.isOpened():
            print(f'  Camera {i} is available')
            cap2.release()
    sys.exit(1)

print('✅ Camera opened successfully')
print('Starting detection - you should see green dots on face landmarks')
print('Press ESC to quit')

# Key landmark indices for glasses placement
NOSE_BRIDGE = 1      # Nose tip
LEFT_EYE_OUTER = 33  # Left eye outer corner
RIGHT_EYE_OUTER = 263  # Right eye outer corner

frame_count = 0
while True:
    ret, frame = cap.read()
    if not ret:
        print('⚠️ Frame read failed')
        break

    # Convert BGR to RGB for MediaPipe
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    # Detect landmarks
    result = detector.detect(image)

    # Draw landmarks if detected
    if result.face_landmarks and len(result.face_landmarks) > 0:
        landmarks = result.face_landmarks[0]
        h, w = frame.shape[:2]

        # Draw all landmarks as small green dots
        for idx, lm in enumerate(landmarks):
            x = int(lm.x * w)
            y = int(lm.y * h)
            cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)

        # Highlight key anchor points
        for idx, name, color in [
            (NOSE_BRIDGE, 'nose', (0, 0, 255)),
            (LEFT_EYE_OUTER, 'left_eye', (255, 0, 0)),
            (RIGHT_EYE_OUTER, 'right_eye', (0, 0, 255))
        ]:
            if idx < len(landmarks):
                lm = landmarks[idx]
                x = int(lm.x * w)
                y = int(lm.y * h)
                cv2.circle(frame, (x, y), 5, color, -1)
                cv2.putText(frame, f'{idx}', (x + 5, y - 5),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)

        # Draw connection line between eyes
        if len(landmarks) > max(LEFT_EYE_OUTER, RIGHT_EYE_OUTER):
            le = landmarks[LEFT_EYE_OUTER]
            re = landmarks[RIGHT_EYE_OUTER]
            lx, ly = int(le.x * w), int(le.y * h)
            rx, ry = int(re.x * w), int(re.y * h)
            cv2.line(frame, (lx, ly), (rx, ry), (255, 255, 0), 2)

        # Print landmark positions for debugging
        if frame_count % 30 == 0:
            nose = landmarks[NOSE_BRIDGE]
            left = landmarks[LEFT_EYE_OUTER]
            right = landmarks[RIGHT_EYE_OUTER]
            print(f'Frame {frame_count}: nose({nose.x:.3f},{nose.y:.3f}) left_eye({left.x:.3f},{left.y:.3f}) right_eye({right.x:.3f},{right.y:.3f})')

    # Show frame
    cv2.imshow('MediaPipe Face Mesh - Prototype', frame)
    frame_count += 1

    # ESC key to quit
    if cv2.waitKey(1) & 0xFF == 27:
        break

# Cleanup
cap.release()
cv2.destroyAllWindows()
print(f'Demo completed after {frame_count} frames')
