"""Load MNIST-style IDX ubyte files (images + labels) from local paths (e.g. Modal /vol/...)."""

from __future__ import annotations

from pathlib import Path
from typing import Tuple

import numpy as np

IDX3_MAGIC = 2051
IDX1_MAGIC = 2049


def load_idx3_ubyte(path: str | Path) -> np.ndarray:
    """Load IDX3-ubyte images. Returns uint8 array shaped (N, rows, cols)."""
    p = Path(path)
    data = p.read_bytes()
    magic = int.from_bytes(data[0:4], "big")
    if magic != IDX3_MAGIC:
        raise ValueError(f"Expected IDX3 magic {IDX3_MAGIC}, got {magic} for {p}")
    n = int.from_bytes(data[4:8], "big")
    rows = int.from_bytes(data[8:12], "big")
    cols = int.from_bytes(data[12:16], "big")
    payload = data[16:]
    expected = n * rows * cols
    if len(payload) < expected:
        raise ValueError(f"Truncated IDX3: need {expected} bytes, have {len(payload)}")
    return np.frombuffer(memoryview(payload)[:expected], dtype=np.uint8).reshape(n, rows, cols)


def load_idx1_ubyte(path: str | Path) -> np.ndarray:
    """Load IDX1-ubyte labels. Returns uint8 array shaped (N,)."""
    p = Path(path)
    data = p.read_bytes()
    magic = int.from_bytes(data[0:4], "big")
    if magic != IDX1_MAGIC:
        raise ValueError(f"Expected IDX1 magic {IDX1_MAGIC}, got {magic} for {p}")
    n = int.from_bytes(data[4:8], "big")
    payload = data[8:]
    if len(payload) < n:
        raise ValueError(f"Truncated IDX1: need {n} bytes, have {len(payload)}")
    return np.frombuffer(memoryview(payload)[:n], dtype=np.uint8)


def load_mnist_images_labels(images_path: str, labels_path: str) -> Tuple[np.ndarray, np.ndarray]:
    """Load paired MNIST train/test files from disk (no network)."""
    x = load_idx3_ubyte(images_path)
    y = load_idx1_ubyte(labels_path)
    if x.shape[0] != y.shape[0]:
        raise ValueError(f"Image count {x.shape[0]} != label count {y.shape[0]}")
    return x, y
