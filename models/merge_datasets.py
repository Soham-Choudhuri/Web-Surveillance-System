import os
import shutil
import yaml
from pathlib import Path

def merge_datasets():
    print("Starting dataset merge...")
    base_dir = Path("f:/Development/Projects/AI/Web-Surveillance-System/models")
    
    # Dataset paths
    dataset1 = base_dir / "weapon.v9i.yolov8"
    dataset2 = base_dir / "bank_robbery.v1i.yolov8"
    out_dir = base_dir / "combined_dataset"
    
    # Clean output dir if exists
    if out_dir.exists():
        shutil.rmtree(out_dir)
    
    out_dir.mkdir(parents=True)
    
    splits = ["train", "valid", "test"]
    for split in splits:
        (out_dir / split / "images").mkdir(parents=True, exist_ok=True)
        (out_dir / split / "labels").mkdir(parents=True, exist_ok=True)
        
    # Read yaml files
    with open(dataset1 / "data.yaml", 'r') as f:
        d1_yaml = yaml.safe_load(f)
    with open(dataset2 / "data.yaml", 'r') as f:
        d2_yaml = yaml.safe_load(f)
        
    names1 = d1_yaml.get("names", [])
    names2 = d2_yaml.get("names", [])
    
    print("Dataset 1 classes:", names1)
    print("Dataset 2 classes:", names2)
    
    # Create unified classes
    unified_names = []
    
    def get_unified_id(name):
        lower_name = name.lower()
        for i, u_name in enumerate(unified_names):
            if u_name.lower() == lower_name:
                return i
        unified_names.append(lower_name)
        return len(unified_names) - 1
        
    # Build maps
    map1 = {i: get_unified_id(name) for i, name in enumerate(names1)}
    map2 = {i: get_unified_id(name) for i, name in enumerate(names2)}
    
    print("Unified classes:", unified_names)
    
    def process_dataset(ds_path, class_map, prefix):
        for split in splits:
            images_dir = ds_path / split / "images"
            labels_dir = ds_path / split / "labels"
            
            if not images_dir.exists():
                continue
                
            for img_file in images_dir.glob("*.*"):
                # Copy image
                new_img_name = f"{prefix}_{img_file.name}"
                shutil.copy2(img_file, out_dir / split / "images" / new_img_name)
                
                # Copy and rewrite label
                label_file = labels_dir / f"{img_file.stem}.txt"
                new_label_file = out_dir / split / "labels" / f"{prefix}_{img_file.stem}.txt"
                
                if label_file.exists():
                    with open(label_file, "r") as lf, open(new_label_file, "w") as nlf:
                        for line in lf:
                            parts = line.strip().split()
                            if parts:
                                old_id = int(parts[0])
                                new_id = class_map.get(old_id, -1)
                                if new_id != -1:
                                    parts[0] = str(new_id)
                                    nlf.write(" ".join(parts) + "\n")
                                    
    # Process both
    print("Processing Dataset 1...")
    process_dataset(dataset1, map1, "ds1")
    print("Processing Dataset 2...")
    process_dataset(dataset2, map2, "ds2")
    
    # Create new data.yaml
    combined_yaml = {
        "train": "../train/images",
        "val": "../valid/images",
        "test": "../test/images",
        "nc": len(unified_names),
        "names": unified_names
    }
    
    with open(out_dir / "data.yaml", "w") as f:
        yaml.dump(combined_yaml, f, sort_keys=False)
        
    print("Zipping up combined dataset...")
    shutil.make_archive(str(base_dir / "combined_dataset"), 'zip', str(out_dir))
    print("Done! Created models/combined_dataset.zip")

if __name__ == "__main__":
    merge_datasets()
