from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable, Sequence

import numpy as np
import pandas as pd

from utils.mnist_idx import load_mnist_images_labels

_LABEL_NAME_HINTS = {
    "label",
    "target",
    "y",
    "class",
    "class_",
    "passed",
    "outcome",
    "result",
}
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}


def _is_idx3_magic(raw: bytes) -> bool:
    return raw[:4] == b"\x00\x00\x08\x03"


def _is_idx1_magic(raw: bytes) -> bool:
    return raw[:4] == b"\x00\x00\x08\x01"


def _read_magic_bytes(path: Path, size: int = 4) -> bytes:
    try:
        with path.open("rb") as fp:
            return fp.read(size)
    except OSError as exc:
        raise ValueError(f"Failed reading file {path}: {exc}") from exc


def detect_format(path: str) -> str:
    p = Path(path)
    if p.is_dir():
        children = [c for c in p.iterdir() if c.is_dir()]
        if children:
            image_children = [
                child
                for child in children
                if any(f.suffix.lower() in _IMAGE_EXTENSIONS for f in child.rglob("*"))
            ]
            if image_children:
                return "image_dir"
        raise ValueError(f"Cannot detect format for file {p}")

    suffix = p.suffix.lower()
    if suffix in {".csv", ".tsv"}:
        return "csv"
    if suffix == ".json":
        return "json"
    if suffix == ".parquet":
        return "parquet"
    if suffix in {".npy", ".npz"}:
        return "numpy"
    if suffix in _IMAGE_EXTENSIONS:
        return "image"

    magic = _read_magic_bytes(p)
    if _is_idx3_magic(magic):
        return "idx3"
    if _is_idx1_magic(magic):
        return "idx1"

    raise ValueError(f"Cannot detect format for file {p}")


def _detect_format_or_none(path: Path) -> str | None:
    try:
        return detect_format(str(path))
    except ValueError:
        return None


def _normalize_label_name(name: str) -> str:
    return str(name).strip().lower().replace(" ", "_")


def _guess_label_column(df: pd.DataFrame) -> str | None:
    if df.empty or not list(df.columns):
        return None

    exact_match = [
        col for col in df.columns if _normalize_label_name(col) in _LABEL_NAME_HINTS
    ]
    if exact_match:
        return str(exact_match[0])

    candidate_cols: list[str] = []
    for col in df.columns:
        norm = _normalize_label_name(col)
        if any(token in norm for token in _LABEL_NAME_HINTS):
            candidate_cols.append(str(col))
    if candidate_cols:
        return candidate_cols[0]

    last_col = str(df.columns[-1])
    if df[last_col].nunique(dropna=True) < 20:
        return last_col

    for col in df.columns:
        if df[col].nunique(dropna=True) < 20:
            return str(col)

    return last_col if len(df.columns) > 1 else None


def _split_tabular_xy(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    label_col = _guess_label_column(df)
    if not label_col:
        raise ValueError(
            "Could not auto-detect label column. Please ensure labels are in a column named 'label' or 'target', or in a separate file."
        )

    y = df[label_col].to_numpy()
    x = df.drop(columns=[label_col]).to_numpy()
    return x, y


def _load_csv(path: Path) -> tuple[np.ndarray, np.ndarray]:
    sep = "\t" if path.suffix.lower() == ".tsv" else ","
    try:
        df = pd.read_csv(path, sep=sep)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Failed to load CSV/TSV file {path}: {exc}") from exc
    return _split_tabular_xy(df)


def _read_tabular_file(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix in {".csv", ".tsv"}:
        sep = "\t" if suffix == ".tsv" else ","
        return pd.read_csv(path, sep=sep)
    if suffix == ".json":
        return pd.read_json(path)
    if suffix == ".parquet":
        return pd.read_parquet(path)
    raise ValueError(f"Unsupported tabular file: {path}")


def _load_json(path: Path) -> tuple[np.ndarray, np.ndarray]:
    try:
        df = pd.read_json(path)
    except ValueError:
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            df = pd.DataFrame(payload)
        except Exception as exc:  # noqa: BLE001
            raise ValueError(f"Failed to load JSON file {path}: {exc}") from exc
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Failed to load JSON file {path}: {exc}") from exc
    return _split_tabular_xy(df)


def _load_parquet(path: Path) -> tuple[np.ndarray, np.ndarray]:
    try:
        df = pd.read_parquet(path)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Failed to load Parquet file {path}: {exc}") from exc
    return _split_tabular_xy(df)


def _load_npy_array(path: Path) -> tuple[np.ndarray, np.ndarray]:
    try:
        arr = np.load(path, allow_pickle=False)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Failed to load NumPy file {path}: {exc}") from exc

    if arr.ndim < 2 or arr.shape[1] < 2:
        raise ValueError(
            f"Cannot infer labels from NumPy array {path}. Expected shape (N, M) with M >= 2."
        )
    x = arr[:, :-1]
    y = arr[:, -1]
    return x, y


def _load_npz_file(path: Path) -> tuple[np.ndarray, np.ndarray]:
    try:
        npz = np.load(path, allow_pickle=False)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"Failed to load NumPy archive {path}: {exc}") from exc

    keys = list(npz.keys())
    key_map = {k.lower(): k for k in keys}

    x_key = key_map.get("x") or key_map.get("features")
    y_key = key_map.get("y") or key_map.get("labels") or key_map.get("target")
    if x_key and y_key:
        return np.asarray(npz[x_key]), np.asarray(npz[y_key])

    if len(keys) >= 2:
        return np.asarray(npz[keys[0]]), np.asarray(npz[keys[1]])

    raise ValueError(
        f"Cannot infer X and y from NumPy archive {path}. Provide keys like X/y or features/labels."
    )


def _pair_idx_files(paths: Sequence[Path]) -> tuple[Path, Path] | None:
    idx3_files = [p for p in paths if _detect_format_or_none(p) == "idx3"]
    idx1_files = [p for p in paths if _detect_format_or_none(p) == "idx1"]
    if idx3_files and idx1_files:
        return idx3_files[0], idx1_files[0]
    return None


def _first(paths: Iterable[Path], exts: set[str]) -> Path | None:
    for p in paths:
        if p.suffix.lower() in exts:
            return p
    return None


def _load_from_directory(path: Path) -> tuple[np.ndarray, np.ndarray]:
    files = [p for p in path.rglob("*") if p.is_file()]
    if not files:
        raise ValueError("Dataset zip is empty")

    idx_pair = _pair_idx_files(files)
    if idx_pair:
        return load_mnist_images_labels(str(idx_pair[0]), str(idx_pair[1]))

    tabular_files = [
        p for p in files if p.suffix.lower() in {".csv", ".tsv", ".json", ".parquet"}
    ]
    if tabular_files:
        for tabular in tabular_files:
            try:
                return load_dataset(str(tabular), format=detect_format(str(tabular)))
            except ValueError:
                continue

        # Two-file tabular pattern fallback (features + labels separate files).
        if len(tabular_files) >= 2:
            for candidate_y in tabular_files:
                y_df = _read_tabular_file(candidate_y)
                if y_df.shape[1] < 1:
                    continue

                y_col = str(y_df.columns[0])
                y_norm = _normalize_label_name(y_col)
                looks_like_labels = (
                    y_norm in _LABEL_NAME_HINTS
                    or y_df.shape[1] == 1
                    or y_df[y_col].nunique(dropna=True) < 20
                )
                if not looks_like_labels:
                    continue

                for candidate_x in tabular_files:
                    if candidate_x == candidate_y:
                        continue
                    x_df = _read_tabular_file(candidate_x)
                    if x_df.shape[0] != y_df.shape[0]:
                        continue
                    return x_df.to_numpy(), y_df[y_col].to_numpy()

    npz = _first(files, {".npz"})
    if npz is not None:
        return _load_npz_file(npz)

    if len([p for p in files if p.suffix.lower() == ".npy"]) >= 2:
        npy_files = [p for p in files if p.suffix.lower() == ".npy"]
        x_file = next(
            (
                p
                for p in npy_files
                if "x" in p.stem.lower() or "feature" in p.stem.lower()
            ),
            None,
        )
        y_file = next(
            (
                p
                for p in npy_files
                if "y" in p.stem.lower() or "label" in p.stem.lower()
            ),
            None,
        )
        if x_file is not None and y_file is not None:
            return np.load(x_file, allow_pickle=False), np.load(
                y_file, allow_pickle=False
            )

    npy = _first(files, {".npy"})
    if npy is not None:
        return _load_npy_array(npy)

    raise ValueError(f"Cannot detect format for file {files[0]}")


def load_dataset(path: str, format: str | None = None) -> tuple[np.ndarray, np.ndarray]:
    p = Path(path)
    if p.is_dir():
        return _load_from_directory(p)

    fmt = format or detect_format(path)
    if fmt == "csv":
        return _load_csv(p)
    if fmt == "json":
        return _load_json(p)
    if fmt == "parquet":
        return _load_parquet(p)
    if fmt == "numpy":
        if p.suffix.lower() == ".npz":
            return _load_npz_file(p)
        return _load_npy_array(p)
    if fmt == "idx3":
        siblings = [f for f in p.parent.iterdir() if f.is_file()]
        idx1 = next((f for f in siblings if _detect_format_or_none(f) == "idx1"), None)
        if not idx1:
            raise ValueError(f"Could not find matching IDX1 labels file for {p}")
        return load_mnist_images_labels(str(p), str(idx1))
    if fmt == "idx1":
        siblings = [f for f in p.parent.iterdir() if f.is_file()]
        idx3 = next((f for f in siblings if _detect_format_or_none(f) == "idx3"), None)
        if not idx3:
            raise ValueError(f"Could not find matching IDX3 images file for {p}")
        return load_mnist_images_labels(str(idx3), str(p))

    raise ValueError(f"Cannot detect format for file {p}")
