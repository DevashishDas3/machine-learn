from __future__ import annotations

from pathlib import Path

import pandas as pd

from agents.explorer_agent import ExplorerAgent


def test_explorer_reads_tabular_metadata(tmp_path: Path) -> None:
    data = pd.DataFrame(
        {
            "f1": [1, 2, 3],
            "f2": [10, 11, 12],
            "label": [0, 1, 0],
        }
    )
    csv_path = tmp_path / "train.csv"
    data.to_csv(csv_path, index=False)

    agent = ExplorerAgent(llm_server=None)
    metadata = agent._run_sync(str(tmp_path))

    assert metadata.suggested_label_column == "label"
    assert metadata.task_type_hint == "classification"
    assert metadata.num_samples == 3
    assert metadata.files[0].format == "csv"
    assert "train.csv" in metadata.file_tree


def test_explorer_tree_truncates_large_directories(tmp_path: Path) -> None:
    for i in range(7):
        (tmp_path / f"f{i}.csv").write_text("a,label\n1,0\n", encoding="utf-8")

    agent = ExplorerAgent(llm_server=None)
    metadata = agent._run_sync(str(tmp_path))
    assert "... (2 more)" in metadata.file_tree


def test_explorer_detects_image_classification_dir(tmp_path: Path) -> None:
    (tmp_path / "cats").mkdir()
    (tmp_path / "dogs").mkdir()
    (tmp_path / "cats" / "a.jpg").write_bytes(b"\x89PNG")
    (tmp_path / "dogs" / "b.png").write_bytes(b"\x89PNG")

    agent = ExplorerAgent(llm_server=None)
    metadata = agent._run_sync(str(tmp_path))

    assert metadata.task_type_hint == "image_classification"
    assert metadata.suggested_label_column is None


def test_explorer_raises_when_no_label_for_tabular(tmp_path: Path) -> None:
    data = pd.DataFrame(
        {
            "f1": [1, 2, 3],
        }
    )
    csv_path = tmp_path / "train.csv"
    data.to_csv(csv_path, index=False)

    agent = ExplorerAgent(llm_server=None)
    try:
        agent._run_sync(str(tmp_path))
    except ValueError as exc:
        assert "Could not auto-detect label column" in str(exc)
    else:
        raise AssertionError("expected ValueError")
