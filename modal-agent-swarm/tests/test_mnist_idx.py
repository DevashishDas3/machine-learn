"""Minimal IDX fixtures: magic + counts + tiny payload."""

import struct
from pathlib import Path

import numpy as np

from utils.mnist_idx import IDX1_MAGIC, IDX3_MAGIC, load_idx1_ubyte, load_idx3_ubyte, load_mnist_images_labels


def _write_idx3(path: Path, n: int, rows: int, cols: int, pixels: bytes) -> None:
    header = struct.pack(">IIII", IDX3_MAGIC, n, rows, cols)
    path.write_bytes(header + pixels)


def _write_idx1(path: Path, n: int, labels: bytes) -> None:
    header = struct.pack(">II", IDX1_MAGIC, n)
    path.write_bytes(header + labels)


def test_load_idx3_and_idx1_roundtrip(tmp_path: Path) -> None:
    img_path = tmp_path / "i.idx3"
    lbl_path = tmp_path / "l.idx1"
    # 2 images of 2x2
    pix = bytes([0, 1, 2, 3, 4, 5, 6, 7])
    _write_idx3(img_path, 2, 2, 2, pix)
    _write_idx1(lbl_path, 2, bytes([7, 8]))

    x = load_idx3_ubyte(img_path)
    y = load_idx1_ubyte(lbl_path)
    assert x.shape == (2, 2, 2)
    assert np.array_equal(x[0], np.arange(4, dtype=np.uint8).reshape(2, 2))
    assert np.array_equal(y, np.array([7, 8], dtype=np.uint8))

    x2, y2 = load_mnist_images_labels(str(img_path), str(lbl_path))
    assert np.array_equal(x, x2) and np.array_equal(y, y2)


def test_mismatched_counts_raise(tmp_path: Path) -> None:
    img_path = tmp_path / "i.idx3"
    lbl_path = tmp_path / "l.idx1"
    _write_idx3(img_path, 2, 1, 1, bytes([1, 2]))
    _write_idx1(lbl_path, 1, bytes([0]))
    try:
        load_mnist_images_labels(str(img_path), str(lbl_path))
    except ValueError as e:
        assert "count" in str(e).lower() or "!=" in str(e)
    else:
        raise AssertionError("expected ValueError")
