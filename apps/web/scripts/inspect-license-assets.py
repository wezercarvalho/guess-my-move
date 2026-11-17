"""Read-only inventory of built model archives and assets; no extraction or redistribution."""
import hashlib
import io
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
MAX_ENTRY = 64 * 1024 * 1024


def digest(data):
    return hashlib.sha256(data).hexdigest()


def report(label, data, depth=0):
    result = {"path": label, "sha256": digest(data), "bytes": len(data)}
    if not zipfile.is_zipfile(io.BytesIO(data)):
        result["archive"] = False
        print("ASSET-ENTRY " + json.dumps(result, ensure_ascii=False))
        return
    result["archive"] = True
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        result["entries"] = [
            {"name": item.filename, "bytes": item.file_size} for item in entries
        ]
        print("ASSET-ENTRY " + json.dumps(result, ensure_ascii=False))
        for item in entries:
            suffix = Path(item.filename).suffix.lower()
            name = Path(item.filename).name.lower()
            if item.is_dir() or depth >= 3:
                continue
            if suffix in {".task", ".tflite", ".zip"} or name.startswith(
                ("license", "licence", "notice", "copyright", "copying")
            ):
                if item.file_size > MAX_ENTRY:
                    raise ValueError("Entrada de modelo excede limite de inspeção: " + item.filename)
                report(label + "::" + item.filename, archive.read(item), depth + 1)


for name in ("hand_landmarker.task", "gesture_recognizer.task", "face_landmarker.task"):
    original = (ROOT / "public" / "mediapipe" / name).read_bytes()
    built = (DIST / "mediapipe" / name).read_bytes()
    if original != built:
        raise ValueError("Modelo servido difere do preparado: " + name)
    report("mediapipe/" + name, built)

for path in sorted((DIST / "mediapipe" / "wasm").iterdir()):
    if path.is_file():
        report("mediapipe/wasm/" + path.name, path.read_bytes())

for path in sorted(DIST.rglob("*.woff2")):
    report(path.relative_to(DIST).as_posix(), path.read_bytes())

for name in ("midtown.json", "paulista.json", "santa-maria.json", "LICENSE.txt"):
    path = DIST / "swing" / name
    data = path.read_bytes()
    if data != (ROOT / "public" / "swing" / name).read_bytes():
        raise ValueError("Dado ou aviso ODbL difere do original: " + name)
    report("swing/" + name, data)

print("ASSET-INSPECTION: hashes e estrutura ZIP; não interpreta licença embutida em FlatBuffers")
