# Custom YOLO Weights Guide

The Evolved Gating Architecture currently uses standard COCO classes (`knife`, `baseball bat`, `scissors`) as proxy triggers for weapons. To implement true, robust firearm and weapon detection, you must swap out the default `yolov8n.pt` weights with a custom-trained `.pt` model.

## 1. Obtaining a Custom Model
You have two options for acquiring a custom YOLOv8 model trained to detect weapons (guns, rifles, etc.):

### Option A: Download a Pre-trained Model (Easiest)
Roboflow Universe has thousands of community-trained YOLOv8 models.
1. Go to [Roboflow Universe (Weapon Detection)](https://universe.roboflow.com/search?q=weapon).
2. Find a high-quality dataset/model labeled for YOLOv8 (ensure the format is PyTorch `.pt`).
3. Download the weights file (usually named `best.pt`).

### Option B: Train Your Own
1. Gather a dataset of weapons and label them using tools like Roboflow or CVAT.
2. Export the dataset in YOLOv8 format.
3. Train using Ultralytics locally or in Google Colab:
```python
from ultralytics import YOLO
model = YOLO('yolov8n.yaml') # Build from scratch
results = model.train(data='your_dataset.yaml', epochs=100, imgsz=640)
```
4. Retrieve the `best.pt` file from the `runs/detect/train/weights/` directory.

## 2. Integrating into the System

Once you have your custom `.pt` file:
1. Rename your file to `yolov8_weapons.pt` and place it inside the `backend/` directory of this project.
2. Open `backend/core/vision.py` and modify the model loading line:
   ```python
   # Change this:
   self.model = YOLO("yolov8n.pt")
   
   # To this:
   self.model = YOLO("yolov8_weapons.pt")
   ```
3. Open `backend/main.py` and update the combinatorial tracking logic to match your new class names. For example, if your custom model outputs the class `firearm`, update the code:
   ```python
   # Around line 450 in backend/main.py
   weapon_classes = ["firearm", "knife"] # Update this array!
   ```

## 3. Testing
After restarting the backend, the system will use your new weights. Ensure you pass a test video containing a firearm to verify that the `combinatorial_context` correctly triggers the > 3.0s duration rule and wakes up the VLM.
