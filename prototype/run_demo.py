import cv2
import mediapipe as mp
import numpy as np
from pathlib import Path

# Import helper functions from apply_filter.py (adjust path)
import sys, os
sys.path.append(str(Path(__file__).parent))
import apply_filter as af

# Choose a filter to test – glasses.png exists in filters folder
def run_demo(frames=30, output_path='outputs/demo_frame.png'):
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError('Camera not available')
    # Load filter data
    filter_name = 'glasses'
    filters, runtime = af.load_filter(filter_name)
    # Expect one filter entry
    filt = runtime[0]
    img_overlay, alpha = filt['img'], filt['img_a']
    points = filt['points']
    # Process frames
    for i in range(frames):
        ret, frame = cap.read()
        if not ret:
            break
        # Get landmarks
        landmarks = af.getLandmarks(frame)
        if not landmarks:
            continue
        # Use faceBlendCommon to warp overlay onto face
        # We reuse the same logic as apply_filter's main loop (simplified)
        # Compute Delaunay triangles if needed
        if 'dt' in filt:
            dt = filt['dt']
            output = af.fbc.warpAndBlend(frame, img_overlay, alpha, points, filt['hull'], filt['hullIndex'], dt)
        else:
            output = af.fbc.warpAndBlend(frame, img_overlay, alpha, points, filt['hull'], filt['hullIndex'], [] )
        # Save the last frame
        if i == frames - 1:
            cv2.imwrite(output_path, output)
    cap.release()
    print('Demo completed, saved', output_path)

if __name__ == '__main__':
    run_demo()
