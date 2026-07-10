# Custom YOLO Weights Guide

The Evolved Gating Architecture currently uses standard COCO classes (`knife`, `baseball bat`, `scissors`) as proxy triggers for weapons. To implement true, robust firearm and weapon detection, you must swap out the default `yolov8n.pt` weights with a custom-trained `.pt` model.

## 1. Obtaining a Custom Model
You have two options for acquiring a custom YOLOv8 model trained to detect weapons (guns, rifles, etc.):

### Option A: Download a Pre-trained Model (Easiest)
Roboflow Universe has thousands of community-trained YOLOv8 models.
1. Go to [Roboflow Universe (Weapon Detection)](https://universe.roboflow.com/search?q=weapon).
2. Find a high-quality dataset/model labeled for YOLOv8 (ensure the format is PyTorch `.pt`).
3. Download the weights file (usually named `best.pt`).

### Option B: Train Your Own (Google Colab / GPU)
1. Find a dataset on Roboflow (or merge multiple datasets into your own Roboflow Project).
2. Open a new [Google Colab Notebook](https://colab.research.google.com/) and ensure you set the hardware accelerator to GPU (Runtime > Change runtime type > T4 GPU).
3. On Roboflow, click **Download Dataset**, select **YOLOv8** format, and choose the **"Show download code"** option.
4. Run the following code block in Colab to download your dataset and train the model:
```python
!pip install ultralytics roboflow

# 1. Download Dataset (Paste your Roboflow snippet here)
from roboflow import Roboflow
rf = Roboflow(api_key="YOUR_API_KEY")
project = rf.workspace("workspace-name").project("project-name")
version = project.version(1)
dataset = version.download("yolov8")

# 2. Train Model
from ultralytics import YOLO
model = YOLO('yolov8n.pt') # Start with a pre-trained model
results = model.train(data=f"{dataset.location}/data.yaml", epochs=50, imgsz=640)
```
5. Once complete, download the `best.pt` file from the `runs/detect/train/weights/` directory on the left file explorer.

## 2. Integrating into the System

Once you have your custom `.pt` file:
1. Rename your file to `yolov8_weapons.pt` and place it inside the `models/` directory in the root of this project.
2. Open `config.py` in the root directory and modify the model path:
   ```python
   # Change this:
   MODEL_PATH = os.path.join(BASE_DIR, "models", "yolov8n.pt")
   
   # To this:
   MODEL_PATH = os.path.join(BASE_DIR, "models", "yolov8_weapons.pt")
   ```
3. Open `backend/main.py` and update the combinatorial tracking logic to match your new class names. For example, if your custom model outputs the class `firearm`, update the code:
   ```python
   # Around line 450 in backend/main.py
   weapon_classes = ["firearm", "knife"] # Update this array!
   ```

## 3. Testing
After restarting the backend, the system will use your new weights. Ensure you pass a test video containing a firearm to verify that the `combinatorial_context` correctly triggers the > 3.0s duration rule and wakes up the VLM.
