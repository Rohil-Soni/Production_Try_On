import cv2
import mediapipe as mp
import numpy as np
from pathlib import Path
import sys
import os

# Use the isolated venv environment if available
venv_path = Path('/tmp/mediapipe_env')
if venv_path.exists():
    # Add venv site-packages to path
    import site
    site.addsitedirs(str(venv_path / 'lib' / 'python3.14' / 'site-packages'))
    # Also try the bin/python path
    sys.path.insert(0, str(venv_path / 'bin'))

print('Python version:', sys.version)
print('Checking MediaPipe version:')
try:
    import mediapipe as mp
    print('mediapipe version:', mp.__version__)
except Exception as e:
    print('Failed to import mediapipe:', e)
    sys.exit(1)

print('Checking OpenCV version:')
try:
    import cv2
    print('opencv version:', cv2.__version__)
except Exception as e:
    print('Failed to import opencv:', e)
    sys.exit(1)

print('Checking numpy version:')
try:
    import numpy as np
    print('numpy version:', np.__version__)
except Exception as e:
    print('Failed to import numpy:', e)
    sys.exit(1)

print('Testing camera access:')
cap = cv2.VideoCapture(0)
if not cap.isOpened():
    print('ERROR: Camera not available')
    # List available devices
    for i in range(5):
        cap2 = cv2.VideoCapture(i)
        if cap2.isOpened():
            print(f'Camera {i} is available')
            cap2.release()
    sys.exit(1)
else:
    ret, frame = cap.read()
    if ret:
        print(f'Camera 0 works, frame shape: {frame.shape}')
    else:
        print('Camera 0 not providing frames')
    cap.release()

print('Testing MediaPipe Face Mesh API:')
# Import face mesh using the new API path
from mediapipe.tasks import python as mp_tasks
# Try to import face mesh module
try:
    # New API path for face mesh
    from mediapipe.tasks.vision import face_mesh
    print('Successfully imported mediapipe.tasks.vision.face_mesh')
    # Create a simple face mesh instance
    face_mesh_obj = face_mesh.FaceMesh(
        max_num_faces=1,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )
    print('FaceMesh instance created successfully')
except Exception as e:
    print('Failed to import face_mesh:', e)
    sys.exit(1)

print('All tests passed!')
print('Prototype environment is ready for development')
