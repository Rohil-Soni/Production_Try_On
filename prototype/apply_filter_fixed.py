import cv2
import mediapipe as mp
import numpy as np
from pathlib import Path
import sys

# Add the isolated venv to Python path if available
venv_path = Path('/tmp/mediapipe_env')
if venv_path.exists():
    import site
    site.addsitedirs(str(venv_path / 'lib' / 'python3.14' / 'site-packages'))

# Import MediaPipe Face Mesh using the new API path
from mediapipe.tasks import python as mp_tasks
from mediapipe.tasks.vision import face_mesh

# Load filter configuration
def load_filter(filter_name='glasses'):
    filters_config = {
        'glasses': [{'path': 'filters/glasses.png', 'has_alpha': True}],
        'anime': [{'path': 'filters/anime.png', 'has_alpha': True}],
        'dog': [{'path': 'filters/dog-ears.png', 'has_alpha': True}, {'path': 'filters/dog-nose.png', 'has_alpha': True}],
        'cat': [{'path': 'filters/cat-ears.png', 'has_alpha': True}, {'path': 'filters/cat-nose.png', 'has_alpha': True}],
    }
    return filters_config.get(filter_name, [])

def get_landmarks(frame):
    """Detect face landmarks using MediaPipe Face Mesh"""
    # Convert to RGB for MediaPipe
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    # Create FaceMesh object
    with face_mesh.FaceMesh(
        max_num_faces=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as face_mesh_obj:
        results = face_mesh_obj.process(rgb_frame)
        if not results.multi_face_landmarks:
            return None
        # Get the first face's landmarks
        landmarks = results.multi_face_landmarks[0]
        # Convert to numpy array of shape (468, 3)
        points = np.array([[lm.x, lm.y, lm.z] for lm in landmarks.landmark])
        # Convert normalized coordinates to pixel space
        h, w = frame.shape[:2]
        pixel_points = (points[:, :2] * np.array([w, h])).astype(int)
        return pixel_points

def warp_overlay(frame, overlay_img, alpha_img, landmarks):
    """Warp overlay image onto face using landmarks"""
    if landmarks is None:
        return frame
    # Use key anchor points for transformation
    # nose bridge (landmark 6), left eye outer (33), right eye outer (263)
    anchor_points = [landmarks[6], landmarks[33], landmarks[263]]
    anchor_points = np.array(anchor_points, dtype=np.float32)
    # Load overlay image
    overlay = cv2.imread(overlay_img, cv2.IMREAD_UNCHANGED)
    if overlay is None:
        print(f'Failed to load overlay: {overlay_img}')
        return frame
    # Get overlay dimensions
    h_o, w_o = overlay.shape[:2]
    # Create destination points for affine transform
    # Scale to match overlay aspect ratio
    scale = min(h_o / h, w_o / w)
    # Simple affine transform using three points
    M, _ = cv2.findHomography(anchor_points, np.array([[0, 0], [w_o-1, 0], [w_o-1, h_o-1]], dtype=np.float32))
    # Warp overlay
    warped = cv2.warpPerspective(overlay, M, (frame.shape[1], frame.shape[0]))
    # Blend with alpha channel if available
    if alpha_img is not None:
        # Extract alpha channel
        _, _, _, alpha = cv2.split(warped)
        alpha = cv2.resize(alpha, (frame.shape[1], frame.shape[0]), interpolation=cv2.INTER_LINEAR)
        # Blend using alpha channel
        for c in range(3):
            frame[:, :, c] = alpha * warped[:, :, c] + (255 - alpha) * frame[:, :, c]
        # Apply alpha to alpha channel for visualization
        alpha = cv2.cvtColor(alpha, cv2.COLOR_GRAY2BGR)
        frame = cv2.addWeighted(frame, 0.7, alpha, 0.3, 0)
    else:
        cv2.addWeighted(frame, 0.7, warped, 0.3, 0, frame)
    return frame

def run_demo(filter_name='glasses', max_frames=100):
    """Run the AR filter demo"""
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError('Camera not available')
    print(f'Starting AR demo with filter: {filter_name}')
    filters = load_filter(filter_name)
    if not filters:
        raise ValueError(f'Filter {filter_name} not found')
    overlay_path = filters[0]['path']
    # Read overlay to get alpha channel
    overlay_img, alpha_img = cv2.imread(overlay_path, cv2.IMREAD_UNCHANGED), None
    if overlay_img is None:
        raise ValueError(f'Failed to load overlay: {overlay_path}')
    if overlay_img.shape[2] == 4:
        b, g, r, a = cv2.split(overlay_img)
        overlay_img = cv2.merge((b, g, r))
        alpha_img = a
    print('Press ESC to exit')
    for i in range(max_frames):
        ret, frame = cap.read()
        if not ret:
            break
        landmarks = get_landmarks(frame)
        if landmarks is not None:
            frame = warp_overlay(frame, overlay_img, alpha_img, landmarks)
        cv2.imshow('AR Filter Demo', frame)
        if cv2.waitKey(1) == 27:  # ESC key
            break
    cap.release()
    cv2.destroyAllWindows()
    print('Demo completed')

if __name__ == '__main__':
    # Parse command line arguments
    import argparse
    parser = argparse.ArgumentParser(description='Run MediaPipe AR filter demo')
    parser.add_argument('--filter', default='glasses', help='Filter name (glasses, anime, dog, cat)')
    parser.add_argument('--frames', type=int, default=100, help='Number of frames to process')
    args = parser.parse_args()
    try:
        run_demo(args.filter, args.frames)
    except Exception as e:
        print(f'Error: {e}')
        sys.exit(1)
