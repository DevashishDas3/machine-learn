from __future__ import annotations

from pathlib import Path

import modal

from config import SETTINGS

app = modal.App(SETTINGS.modal_app_name)

# Supabase secret for dashboard updates
supabase_secret = modal.Secret.from_name("supabase-secrets")

# Project root — must be on the image so remote containers can import config, agents, schemas, etc.
# (pip_install alone does not ship local .py files; without this, workers raise ModuleNotFoundError.)
_ROOT = Path(__file__).resolve().parent

def _ignore_dev_artifacts(path: Path) -> bool:
    parts = path.parts
    return (
        ".venv" in parts
        or "__pycache__" in parts
        or ".git" in parts
        or "dashboard-next" in parts  # Next.js app — not needed by Modal workers
    )


def _project_image(
    extra_pip: tuple[str, ...] = (),
    extra_env: dict[str, str] | None = None,
    *,
    include_torch_cuda: bool = False,
) -> modal.Image:
    img = modal.Image.debian_slim(python_version="3.11").pip_install(
        "pydantic>=2",
        "numpy",
        "pandas",
        "scikit-learn",
        "python-dotenv",
        "supabase",  # For dashboard updates
        *extra_pip,
    )
    if include_torch_cuda:
        img = img.pip_install(
            "torch",
            "torchvision",
            extra_options="--index-url https://download.pytorch.org/whl/cu124",
        )
    if extra_env:
        img = img.env(extra_env)
    return img.add_local_dir(_ROOT, remote_path="/root", copy=False, ignore=_ignore_dev_artifacts)


base_image = _project_image()

train_image = _project_image(
    include_torch_cuda=True,
    extra_env={"PYTHONPATH": "/root"},
)

llm_image = _project_image(
    ("vllm",),
    extra_env={"PYTORCH_ALLOC_CONF": "expandable_segments:True"},
)

data_volume = modal.Volume.from_name(SETTINGS.modal_volume_name, create_if_missing=True)
