import os
import urllib.request
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

YAMNET_TFLITE_URL = "https://storage.googleapis.com/audioset/yamnet.tflite"
YAMNET_CLASS_MAP_URL = "https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv"

def download_yamnet():
    os.makedirs("models", exist_ok=True)
    tflite_path = os.path.join("models", "yamnet.tflite")
    csv_path = os.path.join("models", "yamnet_class_map.csv")
    
    if not os.path.exists(tflite_path):
        logger.info("Downloading YAMNet TFLite model...")
        urllib.request.urlretrieve(YAMNET_TFLITE_URL, tflite_path)
        logger.info("YAMNet TFLite model downloaded.")
    else:
        logger.info("YAMNet TFLite model already exists.")
        
    if not os.path.exists(csv_path):
        logger.info("Downloading YAMNet class map...")
        urllib.request.urlretrieve(YAMNET_CLASS_MAP_URL, csv_path)
        logger.info("YAMNet class map downloaded.")
    else:
        logger.info("YAMNet class map already exists.")

if __name__ == "__main__":
    download_yamnet()
