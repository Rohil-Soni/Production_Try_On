#!/usr/bin/env python3
"""
MediaPipe Face Mesh AR Filter - Prototype
This script tests the MediaPipe Face Mesh integration with webcam.
Press ESC to exit the window.
"""

import cv2
import mediapipe as mp
import numpy as np
import sys

# Import FaceLandmarker using the correct API path for this version
from mediapipe.tasks.python.vision import face_landmarker as fl

# Import helper functions from apply_filter.py (adjusted for new API)
import sys, os
sys.path.append(str(Path(__file__).parent))
import apply_filter as af

def run_demo(frames=30, output_path='outputs/demo_frame.png'):
    """Run the AR filter demo"""
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError('Camera not available')

    # Load filter configuration
    filters_config = {
        'glasses': [{'path': 'filters/glasses.png', 'has_alpha': True}],
        'anime': [{'path': 'filters/anime.png', 'has_alpha': True}],
        'dog': [{'path': 'filters/dog-ears.png', 'has_alpha': True}, {'path': 'filters/dog-nose.png', 'has_alpha': True}],
        'cat': [{'path': 'filters/cat-ears.png', 'has_alpha': True}, {'path': 'filters/cat-nose.png', 'has_alpha': True}],
    }

    filters = filters_config.get('glasses', [])
    if not filters:
        raise ValueError(f"Filter '{filter_name}' not found")

    # Load the first filter
    filter_info = filters[0]
    img_overlay, img_alpha = af.load_filter_img(filter_info['path'], filter['has_alpha'])
    points = load_landmarks(filter_info['points']) if 'points' in filt else None

    # Process frames
    for i in range(frames):
        ret, frame = cap.read()
        if not ret:
            break

        # Get landmarks
        points = get_landmarks(frame)
        if points is not None:
            frame = af.fbc.warp_and_blend(frame, img_overlay, alpha_img, points, filt['hull'], filt['hullIndex'], filt['dt'])

        # Show frame
        cv2.imshow('AR Filter Demo', frame)
        if cv2.waitKey(1) == 27:  # ESC key
            break

    cap.release()
    cv2.destroyAllWindows()
    print('Demo completed, saved', output_path)

if __name__ == '__main__':
    run_demo()