#!/usr/bin/env python3
"""
Glasses Try-On Prototype - Phase 1 Complete (Interactive Version)
MediaPipe Face Mesh + Glasses Overlay Demo - Supports command line filter selection.
Press ESC to exit the window.
"""

import cv2
import numpy as np
from pathlib import Path
import sys
import time
import argparse

# Import MediaPipe
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.python.vision.face_landmarker import FaceLandmarker, FaceLandmarkerOptions
import mediapipe as mp

MODEL_PATH = 'face_landmarker.task'
FILTERS_DIR = 'filters'

def load_filter(filter_name: str):
    """Load glasses filter image with alpha channel"""
    filter_path = Path(FILTERS_DIR) / f'{filter_name}.png'
    if not filter_path.exists():
        raise FileNotFoundError(f'Filter not found: {filter_path}')

    img = cv2.imread(str(filter_path), cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError(f'Failed to load {filter_path}')

    if img.shape[2] == 4:
        b, g, r, a = cv2.split(img)
        return r, g, b, a
    else:
        b, g, r = cv2.split(img)
        a = np.ones(r.shape, dtype=np.uint8) * 255
        return r, g, b, a

def transform_glasses(img_r, img_g, img_b, img_a, landmarks, frame_h, frame_w):
    """
    Transform and overlay glasses onto frame
    Using simple scaling and translation based on eye distance
    """
    if len(landmarks) < 264:
        return None, None

    left_eye = landmarks[33]
    right_eye = landmarks[263]
    nose = landmarks[1]

    if not nose or not left_eye or not right_eye: # Basic check for valid landmarks
        return None, None

    p_left = np.array([left_eye.x * frame_w, left_eye.y * frame_h], dtype=np.float32)
    p_right = np.array([right_eye.x * frame_w, right_eye.y * frame_h], dtype=np.float32)
    p_nose = np.array([nose.x * frame_w, nose.y * frame_h], dtype=np.float32)

    eye_dist = np.linalg.norm(p_right - p_left)
    img_h, img_w = img_r.shape[:2]

    scale = (eye_dist * 1.2) / img_w if img_w > 0 else 1.0
    scale = np.clip(scale, 0.3, 2.0)

    new_w = int(img_w * scale)
    new_h = int(img_h * scale)

    img_r_resized = cv2.resize(img_r, (new_w, new_h))
    img_g_resized = cv2.resize(img_g, (new_w, new_h))
    img_b_resized = cv2.resize(img_b, (new_w, new_h))
    img_a_resized = cv2.resize(img_a, (new_w, new_h))

    center_x = int((p_left[0] + p_right[0]) / 2)
    center_y = int((p_left[1] + p_right[1]) / 2) - int(new_h * 0.1)

    x_start = center_x - new_w // 2
    y_start = center_y - new_h // 2

    overlay = np.zeros((frame_h, frame_w, 3), dtype=np.uint8)
    overlay_alpha = np.zeros((frame_h, frame_w), dtype=np.uint8)

    x1 = max(0, x_start)
    y1 = max(0, y_start)
    x2 = min(frame_w, x_start + new_w)
    y2 = min(frame_h, y_start + new_h)

    sx1 = max(0, -x_start)
    sy1 = max(0, -y_start)
    sx2 = sx1 + (x2 - x1)
    sy2 = sy1 + (y2 - y1)

    overlay[y1:y2, x1:x2, 0] = img_r_resized[sy1:sy2, sx1:sx2]
    overlay[y1:y2, x1:x2, 1] = img_g_resized[sy1:sy2, sx1:sx2]
    overlay[y1:y2, x1:x2, 2] = img_b_resized[sy1:sy2, sx1:sx2]
    overlay_alpha[y1:y2, x1:x2] = img_a_resized[sy1:sy2, sx1:sx2]

    return overlay, overlay_alpha

def blend_overlay(frame, overlay_img, overlay_alpha):
    """Blend overlay onto frame using alpha channel"""
    if overlay_alpha.ndim == 2:
        overlay_alpha = np.stack([overlay_alpha] * 3, axis=-1)

    frame_f = frame.astype(np.float32) / 255.0
    overlay_f = overlay_img.astype(np.float32) / 255.0
    alpha_f = overlay_alpha.astype(np.float32) / 255.0

    blended = frame_f * (1 - alpha_f) + overlay_f * alpha_f
    blended = np.clip(blended * 255, 0, 255).astype(np.uint8)

    return blended

def main():
    parser = argparse.ArgumentParser(description='Interactive MediaPipe AR filter demo.')
    parser.add_argument('--filter', type=str, default='glasses', help='Name of the filter to apply (e.g., glasses, cat, dog).')
    args = parser.parse_args()

    if not Path(MODEL_PATH).exists():
        print(f'ERROR: {MODEL_PATH} not found')
        sys.exit(1)

    print(f'Loading {args.filter} filter...')
    try:
        img_r, img_g, img_b, img_a = load_filter(args.filter)
        print(f'Filter loaded: {img_r.shape}')
    except Exception as e:
        print(f'Failed to load filter '{args.filter}': {e}')
        sys.exit(1)

    base = mp_tasks.BaseOptions(model_asset_path=MODEL_PATH)
    options = FaceLandmarkerOptions(
        base_options=base,
        min_face_detection_confidence=0.3,
        min_face_presence_confidence=0.3,
        min_tracking_confidence=0.3,
    )
    detector = FaceLandmarker.create_from_options(options)
    print('FaceLandmarker created successfully')

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print('Camera not available')
        sys.exit(1)
    print('Camera opened')

    print('\n=== Interactive Glasses Try-On Prototype ===')
    print(f'   - Current filter: {args.filter}')
    print('   - Green dots: all landmarks')
    print('   - Red dot: nose bridge (landmark 1)')
    print('   - Blue line: between eyes')
    print('   - Glasses overlay: follows face')
    print('   Press ESC to quit\n')

    while True:
        ret, frame = cap.read()
        if not ret:
            print('Frame read failed')
            break

        frame_h, frame_w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

        result = detector.detect(image)

        if result.face_landmarks and len(result.face_landmarks) > 0:
            landmarks = result.face_landmarks[0]

            for idx, lm in enumerate(landmarks):
                x = int(lm.x * frame_w)
                y = int(lm.y * frame_h)
                cv2.circle(frame, (x, y), 1, (0, 255, 0), -1)

            key_points = [
                (1, 'nose', (0, 0, 255)),
                (33, 'left_eye', (255, 0, 0)),
                (263, 'right_eye', (0, 0, 255))
            ]
            for idx, name, color in key_points:
                if idx < len(landmarks):
                    lm = landmarks[idx]
                    x = int(lm.x * frame_w)
                    y = int(lm.y * frame_h)
                    cv2.circle(frame, (x, y), 4, color, -1)
                    cv2.putText(frame, name, (x + 5, y - 5),
                               cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

            if len(landmarks) > 263:
                le = landmarks[33]
                re = landmarks[263]
                lx, ly = int(le.x * frame_w), int(le.y * frame_h)
                rx, ry = int(re.x * frame_w), int(re.y * frame_h)
                cv2.line(frame, (lx, ly), (rx, ry), (255, 255, 0), 2)

            try:
                overlay_img, overlay_alpha = transform_glasses(
                    img_r, img_g, img_b, img_a, landmarks, frame_h, frame_w
                )
                if overlay_img is not None:
                    frame = blend_overlay(frame, overlay_img, overlay_alpha)
            except Exception as e:
                print(f'Error transforming glasses: {e}')

        cv2.imshow(f'Glasses Try-On Prototype - Filter: {args.filter}', frame)

        if cv2.waitKey(1) & 0xFF == 27:
            break

    cap.release()
    cv2.destroyAllWindows()
    print('\nDemo completed.')

if __name__ == '__main__':
    main()
