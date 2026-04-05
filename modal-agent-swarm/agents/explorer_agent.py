from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

from schemas import DatasetMetadata, FileInfo
from utils.data_loader import detect_format

_LABEL_HINTS = (
    "label",
    "target",
    "y",
    "class",
    "class_",
    "passed",
    "outcome",
    "result",
)


def _truncate_dir_entries(entries: List[Path], cap: int = 5) -> List[Path]:
    return entries[:cap]


def _is_tabular(fmt: str) -> bool:
    return fmt in {"csv", "json", "parquet"}


def _norm(value: str) -> str:
    return value.strip().lower().replace(" ", "_")


def _safe_preview(series: pd.Series, max_items: int = 3) -> List[str]:
    vals = []
    for item in series.dropna().head(max_items).tolist():
        vals.append(str(item)[:80])
    return vals


def _read_tabular(path: Path, fmt: str) -> pd.DataFrame:
    if fmt == "csv":
        sep = "\t" if path.suffix.lower() == ".tsv" else ","
        return pd.read_csv(path, sep=sep)
    if fmt == "json":
        return pd.read_json(path)
    if fmt == "parquet":
        return pd.read_parquet(path)
    raise ValueError(f"Unsupported tabular format: {fmt}")


def _detect_label_column(df: pd.DataFrame) -> str | None:
    cols = [str(c) for c in df.columns]
    if not cols:
        return None

    if len(cols) == 1:
        only = cols[0]
        return only if _norm(only) in _LABEL_HINTS else None

    exact = [c for c in cols if _norm(c) in _LABEL_HINTS]
    if exact:
        return exact[0]

    fuzzy = [c for c in cols if any(token in _norm(c) for token in _LABEL_HINTS)]
    if fuzzy:
        return fuzzy[0]

    last_col = cols[-1]
    if df[last_col].nunique(dropna=True) < 20:
        return last_col

    low_cardinality = [c for c in cols if df[c].nunique(dropna=True) < 20]
    if low_cardinality:
        return low_cardinality[0]
    return last_col if len(cols) > 1 else None


def _infer_task_type(df: pd.DataFrame, label_col: str | None) -> str | None:
    if not label_col:
        return None
    y = df[label_col]
    unique = y.nunique(dropna=True)
    if unique < 20:
        return "classification"
    if pd.api.types.is_numeric_dtype(y):
        return "regression"
    return "classification"


def _render_file_tree(base: Path) -> str:
    lines: List[str] = [f"{base.name}/"]

    def walk(node: Path, prefix: str = "") -> None:
        children = sorted(
            list(node.iterdir()), key=lambda p: (not p.is_dir(), p.name.lower())
        )
        if len(children) > 5:
            shown = _truncate_dir_entries(children, cap=5)
            hidden = len(children) - len(shown)
        else:
            shown = children
            hidden = 0

        for child in shown:
            suffix = "/" if child.is_dir() else ""
            lines.append(f"{prefix}{child.name}{suffix}")
            if child.is_dir():
                walk(child, prefix=prefix + "  ")
        if hidden > 0:
            lines.append(f"{prefix}... ({hidden} more)")

    walk(base, prefix="  ")
    return "\n".join(lines)


def _is_image_classification_dir(base: Path) -> bool:
    class_dirs = [d for d in base.iterdir() if d.is_dir()]
    if not class_dirs:
        return False
    for class_dir in class_dirs:
        if any(
            f.suffix.lower() in {".jpg", ".jpeg", ".png"} for f in class_dir.rglob("*")
        ):
            return True
    return False


class ExplorerAgent:
    def __init__(self, llm_server: Any) -> None:
        self.llm_server = llm_server

    async def run(
        self, dataset_base_path: str, task_description: str = ""
    ) -> DatasetMetadata:
        return await asyncio.to_thread(
            self._run_sync, dataset_base_path, task_description
        )

    def _run_sync(
        self, dataset_base_path: str, task_description: str = ""
    ) -> DatasetMetadata:
        del task_description
        base = Path(dataset_base_path)
        if not base.exists() or not base.is_dir():
            raise ValueError(f"Dataset directory not found: {dataset_base_path}")

        all_files = sorted([p for p in base.rglob("*") if p.is_file()])
        if not all_files:
            raise ValueError("Dataset zip is empty")

        file_infos: List[FileInfo] = []
        suggested_label: str | None = None
        task_hint: str | None = None
        max_samples: int | None = None

        if _is_image_classification_dir(base):
            task_hint = "image_classification"

        for fp in all_files:
            fmt = detect_format(str(fp))
            rel = str(fp.relative_to(base)).replace("\\", "/")
            exts = [s for s in fp.suffixes if s]
            info = FileInfo(path=rel, format=fmt, file_extensions=exts)

            if _is_tabular(fmt):
                try:
                    df = _read_tabular(fp, fmt)
                except Exception as exc:  # noqa: BLE001
                    raise ValueError(f"Corrupt file {fp}: {exc}") from exc

                info.num_rows = int(df.shape[0])
                info.columns = [str(col) for col in df.columns]

                label = _detect_label_column(df)
                if label and suggested_label is None:
                    suggested_label = label

                inferred = _infer_task_type(df, label)
                if inferred and task_hint is None:
                    task_hint = inferred

                if max_samples is None:
                    max_samples = int(df.shape[0])
                else:
                    max_samples = max(max_samples, int(df.shape[0]))

            file_infos.append(info)

        if suggested_label is None and task_hint != "image_classification":
            raise ValueError(
                "Could not auto-detect label column. Please ensure labels are in a column named 'label' or 'target', or in a separate file."
            )

        metadata = DatasetMetadata(
            file_tree=_render_file_tree(base),
            files=file_infos,
            suggested_label_column=suggested_label,
            task_type_hint=task_hint,
            num_samples=max_samples,
        )
        return DatasetMetadata.model_validate(metadata.model_dump())
