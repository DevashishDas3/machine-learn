from schemas.types import Approach, RunConfig, TrainingResult


def test_approach_framework_normalization() -> None:
    approach = Approach(
        name="ResNet baseline",
        framework="scikit-learn",
        rationale="A simple baseline for feature-driven datasets.",
        hyperparameters={"max_depth": 4},
        modal_gpu="A10G",
    )
    assert approach.framework == "sklearn"


def test_training_result_metrics_normalized_to_float() -> None:
    result = TrainingResult(
        approach_name="xgboost-ish",
        metrics={"Accuracy": "0.91", "loss": 0.12, "bad": "x"},
    )
    assert result.metrics["accuracy"] == 0.91
    assert result.metrics["loss"] == 0.12
    assert "bad" not in result.metrics


def test_run_config_metric_normalization() -> None:
    cfg = RunConfig(dataset_path="/vol/data.csv", task_description="classify", primary_metric="  F1 ")
    assert cfg.primary_metric == "f1"


def test_run_config_labels_path_optional() -> None:
    cfg = RunConfig(
        dataset_path="/vol/mnist/train-images.idx3-ubyte",
        task_description="MNIST",
        labels_path="/vol/mnist/train-labels.idx1-ubyte",
    )
    assert cfg.labels_path.endswith("idx1-ubyte")
