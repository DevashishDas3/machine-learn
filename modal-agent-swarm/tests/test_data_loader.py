from __future__ import annotations

import struct
from pathlib import Path

import numpy as np
import pandas as pd

from utils.data_loader import detect_format, load_dataset


def _write_idx3(path: Path, n: int, rows: int, cols: int, pixels: bytes) -> None:
    header = struct.pack(">IIII", 2051, n, rows, cols)
    path.write_bytes(header + pixels)


def _write_idx1(path: Path, n: int, labels: bytes) -> None:
    header = struct.pack(">II", 2049, n)
    path.write_bytes(header + labels)


def test_detect_format_by_extension(tmp_path: Path) -> None:
    csv_path = tmp_path / "train.csv"
    csv_path.write_text("a,b,label\n1,2,0\n", encoding="utf-8")
    assert detect_format(str(csv_path)) == "csv"

    json_path = tmp_path / "data.json"
    json_path.write_text('[{"x":1,"label":0}]', encoding="utf-8")
    assert detect_format(str(json_path)) == "json"


def test_detect_idx_magic_bytes(tmp_path: Path) -> None:
    idx3 = tmp_path / "images.bin"
    idx1 = tmp_path / "labels.bin"
    _write_idx3(idx3, 1, 2, 2, bytes([1, 2, 3, 4]))
    _write_idx1(idx1, 1, bytes([7]))

    assert detect_format(str(idx3)) == "idx3"
    assert detect_format(str(idx1)) == "idx1"


def test_load_csv_dataset(tmp_path: Path) -> None:
    path = tmp_path / "train.csv"
    path.write_text("f1,f2,label\n1,2,0\n3,4,1\n", encoding="utf-8")
    x, y = load_dataset(str(path))
    assert x.shape == (2, 2)
    assert y.shape == (2,)


def test_load_json_dataset(tmp_path: Path) -> None:
    path = tmp_path / "train.json"
    path.write_text(
        '[{"f1":1,"f2":2,"target":0},{"f1":3,"f2":4,"target":1}]', encoding="utf-8"
    )
    x, y = load_dataset(str(path))
    assert x.shape == (2, 2)
    assert y.shape == (2,)


def test_load_parquet_dataset(tmp_path: Path) -> None:
    path = tmp_path / "train.parquet"
    df = pd.DataFrame({"f1": [1, 2], "f2": [3, 4], "label": [0, 1]})
    df.to_parquet(path)
    x, y = load_dataset(str(path))
    assert x.shape == (2, 2)
    assert y.tolist() == [0, 1]


def test_load_npy_dataset(tmp_path: Path) -> None:
    path = tmp_path / "arr.npy"
    arr = np.array([[1.0, 2.0, 0.0], [3.0, 4.0, 1.0]], dtype=np.float32)
    np.save(path, arr)
    x, y = load_dataset(str(path))
    assert x.shape == (2, 2)
    assert y.shape == (2,)


def test_load_npz_dataset(tmp_path: Path) -> None:
    path = tmp_path / "arr.npz"
    np.savez(path, X=np.array([[1, 2], [3, 4]]), y=np.array([0, 1]))
    x, y = load_dataset(str(path))
    assert x.shape == (2, 2)
    assert y.tolist() == [0, 1]


def test_load_idx_pair_dataset(tmp_path: Path) -> None:
    img_path = tmp_path / "images.idx3-ubyte"
    lbl_path = tmp_path / "labels.idx1-ubyte"
    _write_idx3(img_path, 2, 2, 2, bytes([0, 1, 2, 3, 4, 5, 6, 7]))
    _write_idx1(lbl_path, 2, bytes([5, 6]))

    x, y = load_dataset(str(img_path))
    assert x.shape == (2, 2, 2)
    assert y.tolist() == [5, 6]


def test_load_directory_picks_supported_file(tmp_path: Path) -> None:
    d = tmp_path / "dataset"
    d.mkdir(parents=True)
    (d / "train.csv").write_text("a,b,label\n1,2,0\n", encoding="utf-8")
    x, y = load_dataset(str(d))
    assert x.shape == (1, 2)
    assert y.tolist() == [0]


def test_empty_directory_fails(tmp_path: Path) -> None:
    d = tmp_path / "empty"
    d.mkdir(parents=True)
    try:
        load_dataset(str(d))
    except ValueError as exc:
        assert "Dataset zip is empty" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_unknown_format_fails(tmp_path: Path) -> None:
    p = tmp_path / "unknown.xyz"
    p.write_text("x", encoding="utf-8")
    try:
        detect_format(str(p))
    except ValueError as exc:
        assert "Cannot detect format" in str(exc)
    else:
        raise AssertionError("expected ValueError")
