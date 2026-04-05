from schemas import TuningHistoryRecord
import utils.run_events as run_events


def test_history_append_and_load_roundtrip(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(run_events, "RUNS_LOCAL_DIR", tmp_path / "runs_local")
    monkeypatch.setattr(
        run_events, "HISTORY_DIR", run_events.RUNS_LOCAL_DIR / "history"
    )

    rec = TuningHistoryRecord(
        run_id="run-123",
        approach_name="CNN Baseline",
        iteration=2,
        primary_metric="accuracy",
        maximize_metric=True,
        primary_metric_value=0.91,
        hyperparameters={"lr": 0.0005, "batch_size": 64},
        metrics={"accuracy": 0.91, "loss": 0.15},
        error=None,
    )

    path = run_events.append_tuning_history_record(rec)
    assert path.exists()

    loaded = run_events.load_tuning_history("CNN Baseline")
    assert len(loaded) == 1
    assert loaded[0].run_id == "run-123"
    assert loaded[0].hyperparameters["batch_size"] == 64


def test_history_load_skips_corrupt_lines(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(run_events, "RUNS_LOCAL_DIR", tmp_path / "runs_local")
    monkeypatch.setattr(
        run_events, "HISTORY_DIR", run_events.RUNS_LOCAL_DIR / "history"
    )

    path = run_events.approach_history_path("Transformer Small")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("{not-json}\n\n", encoding="utf-8")

    rec = TuningHistoryRecord(
        run_id="run-456",
        approach_name="Transformer Small",
        iteration=1,
        primary_metric="accuracy",
        maximize_metric=True,
        primary_metric_value=0.77,
        hyperparameters={"heads": 4},
        metrics={"accuracy": 0.77},
    )
    with path.open("a", encoding="utf-8") as f:
        f.write(rec.model_dump_json() + "\n")

    loaded = run_events.load_tuning_history("Transformer Small")
    assert len(loaded) == 1
    assert loaded[0].run_id == "run-456"


def test_history_partitioned_by_approach_name(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(run_events, "RUNS_LOCAL_DIR", tmp_path / "runs_local")
    monkeypatch.setattr(
        run_events, "HISTORY_DIR", run_events.RUNS_LOCAL_DIR / "history"
    )

    rec_a = TuningHistoryRecord(
        run_id="run-a",
        approach_name="MLP Small",
        iteration=1,
        primary_metric="accuracy",
        maximize_metric=True,
        primary_metric_value=0.8,
        hyperparameters={"hidden_dim": 128},
        metrics={"accuracy": 0.8},
    )
    rec_b = TuningHistoryRecord(
        run_id="run-b",
        approach_name="CNN Small",
        iteration=1,
        primary_metric="accuracy",
        maximize_metric=True,
        primary_metric_value=0.82,
        hyperparameters={"channels": 32},
        metrics={"accuracy": 0.82},
    )

    run_events.append_tuning_history_record(rec_a)
    run_events.append_tuning_history_record(rec_b)

    mlp_loaded = run_events.load_tuning_history("MLP Small")
    cnn_loaded = run_events.load_tuning_history("CNN Small")

    assert len(mlp_loaded) == 1
    assert len(cnn_loaded) == 1
    assert mlp_loaded[0].approach_name == "MLP Small"
    assert cnn_loaded[0].approach_name == "CNN Small"
