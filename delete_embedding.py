"""
Delete or manage face embeddings stored in data/embeddings/face_embeddings.pkl.
Usage:
    python delete_embedding.py
    python delete_embedding.py <employee_id>
    python delete_embedding.py --all
"""

import os
import sys
import pickle
import shutil

EMBEDDINGS_FILE = os.path.join("data", "embeddings", "face_embeddings.pkl")
FACES_DIR = os.path.join("data", "faces_v2")


def load_embeddings():
    if not os.path.exists(EMBEDDINGS_FILE):
        return {}
    try:
        with open(EMBEDDINGS_FILE, "rb") as f:
            data = pickle.load(f)
            return data if isinstance(data, dict) else {}
    except Exception as e:
        print(f"Error loading {EMBEDDINGS_FILE}: {e}")
        return {}


def save_embeddings(data):
    os.makedirs(os.path.dirname(EMBEDDINGS_FILE), exist_ok=True)
    # Create backup first
    if os.path.exists(EMBEDDINGS_FILE):
        shutil.copy2(EMBEDDINGS_FILE, EMBEDDINGS_FILE + ".bak")
    with open(EMBEDDINGS_FILE, "wb") as f:
        pickle.dump(data, f)
    print(f"Saved updated embeddings to {EMBEDDINGS_FILE} (backup at .bak)")


def delete_employee_embedding(target_id: str, delete_photos: bool = False):
    target_id = str(target_id).strip()
    data = load_embeddings()

    # Find matching key (case/space-insensitive)
    matched_key = None
    for k in list(data.keys()):
        if str(k).strip() == target_id:
            matched_key = k
            break

    if matched_key is None:
        print(f"Employee ID '{target_id}' not found in {EMBEDDINGS_FILE}.")
        print("Existing IDs:", list(data.keys()))
        return False

    del data[matched_key]
    save_embeddings(data)
    print(f"Successfully deleted face embedding for employee '{target_id}'.")

    if delete_photos:
        photo_dir = os.path.join(FACES_DIR, target_id)
        if os.path.isdir(photo_dir):
            shutil.rmtree(photo_dir)
            print(f"Deleted face photos in {photo_dir}")

    print("Remaining enrolled employees:", list(data.keys()))
    return True


def delete_all_embeddings():
    data = load_embeddings()
    if not data:
        print("No embeddings to delete.")
        return
    confirm = input("Are you sure you want to delete ALL face embeddings? (yes/no): ").strip().lower()
    if confirm in ("yes", "y"):
        save_embeddings({})
        print("All face embeddings cleared.")
    else:
        print("Operation cancelled.")


def main():
    if not os.path.exists(EMBEDDINGS_FILE):
        print(f"Embedding file not found: {EMBEDDINGS_FILE}")
        return

    data = load_embeddings()
    print("==========================================")
    print("      FACE EMBEDDING MANAGEMENT")
    print("==========================================")
    print(f"File: {EMBEDDINGS_FILE}")
    print(f"Currently enrolled IDs ({len(data)}): {list(data.keys())}")
    print("==========================================\n")

    if len(sys.argv) > 1:
        arg = sys.argv[1].strip()
        if arg == "--all":
            delete_all_embeddings()
        else:
            delete_employee_embedding(arg, delete_photos=True)
        return

    # Interactive mode
    target = input("Enter Employee ID to delete (or '--all' to clear all, 'q' to quit): ").strip()
    if not target or target.lower() == "q":
        print("Exiting.")
        return
    if target == "--all":
        delete_all_embeddings()
    else:
        delete_employee_embedding(target, delete_photos=True)


if __name__ == "__main__":
    main()
