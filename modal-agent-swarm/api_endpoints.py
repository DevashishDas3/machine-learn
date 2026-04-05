"""
Modal API Endpoints for machine(learn);

This module exposes web endpoints that the Next.js frontend can call to:
1. Upload datasets and trigger ML pipeline runs
2. Check run status
3. Cancel running jobs

The endpoints use FastAPI wrapped in Modal's @app.asgi_app() for easy handling
of multipart/form-data uploads.
"""

from __future__ import annotations

import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Optional

import modal
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import SETTINGS
from modal_app import app, api_image, base_image, data_volume, supabase_secret

# Create FastAPI app
web_app = FastAPI(
    title="machine(learn); API",
    description="API endpoints for ML Agent Swarm pipeline",
    version="1.0.0",
)

# Configure CORS for Next.js frontend
web_app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app",  # For production deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@web_app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@web_app.post("/api/runs/create")
async def create_run(
    task_description: str = Form(...),
    user_id: str = Form(...),
    run_id: str = Form(...),
    dataset_file: Optional[UploadFile] = File(None),
    dataset_path: Optional[str] = Form(None),
):
    """
    Create a new ML pipeline run.
    
    This endpoint:
    1. Accepts an optional file upload and saves it to Modal Volume
    2. Spawns the orchestrator asynchronously (fire-and-forget)
    3. Returns immediately with the run_id
    
    Args:
        task_description: Natural language description of the ML task
        user_id: Supabase user ID
        run_id: Pre-created Supabase swarm_runs.id
        dataset_file: Optional uploaded dataset file
        dataset_path: Optional existing path on Modal Volume (e.g., /vol/datasets/mnist)
    """
    try:
        final_dataset_path: Optional[str] = None
        
        # Handle file upload if provided
        if dataset_file and dataset_file.filename:
            # Generate unique filename to avoid collisions
            file_ext = Path(dataset_file.filename).suffix
            unique_filename = f"{uuid.uuid4().hex[:8]}_{dataset_file.filename}"
            volume_path = f"/vol/datasets/uploads/{unique_filename}"
            
            # Save file to Modal Volume
            await save_uploaded_file.remote.aio(
                file_content=await dataset_file.read(),
                volume_path=volume_path,
            )
            final_dataset_path = volume_path
            
        elif dataset_path:
            # Use provided existing path
            final_dataset_path = dataset_path
        else:
            # Default to MNIST for demo purposes
            final_dataset_path = "/vol/datasets/mnist"
        
        # Spawn the orchestrator asynchronously (fire-and-forget)
        # This returns immediately while the pipeline runs in the background
        run_pipeline_async.spawn(
            dataset_path=final_dataset_path,
            task_description=task_description,
            swarm_run_id=run_id,
            user_id=user_id,
        )
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "run_id": run_id,
                "dataset_path": final_dataset_path,
                "message": "Pipeline started successfully. Check dashboard for progress.",
            },
        )
        
    except Exception as e:
        # Log the error and return a proper error response
        print(f"Error creating run: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to start pipeline: {str(e)}",
        )


@web_app.get("/api/runs/{run_id}/status")
async def get_run_status(run_id: str):
    """
    Get the status of a pipeline run.
    
    Note: Most status updates come through Supabase realtime subscriptions,
    but this endpoint can be used for polling fallback.
    """
    try:
        # Import here to avoid circular imports
        from supabase_helpers import get_supabase_client
        
        supabase = get_supabase_client()
        result = supabase.table("swarm_runs").select("*").eq("id", run_id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="Run not found")
        
        return JSONResponse(
            status_code=200,
            content={
                "success": True,
                "run": result.data,
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get run status: {str(e)}",
        )


# ============================================
# Modal Functions
# ============================================

@app.function(
    image=base_image,
    volumes={"/vol": data_volume},
    timeout=60,
)
async def save_uploaded_file(file_content: bytes, volume_path: str) -> str:
    """
    Save an uploaded file to the Modal Volume.
    
    Args:
        file_content: Raw bytes of the uploaded file
        volume_path: Destination path on the volume (e.g., /vol/datasets/uploads/file.csv)
    
    Returns:
        The volume path where the file was saved
    """
    path = Path(volume_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(path, "wb") as f:
        f.write(file_content)
    
    # Commit the volume to persist changes
    data_volume.commit()
    
    return volume_path


@app.function(
    image=base_image,
    secrets=[supabase_secret],
    volumes={"/vol": data_volume},
    timeout=3600,  # 1 hour max
)
async def run_pipeline_async(
    dataset_path: str,
    task_description: str,
    swarm_run_id: str,
    user_id: str,
) -> None:
    """
    Run the ML pipeline asynchronously.
    
    This function is spawned in the background and updates Supabase
    as it progresses through the pipeline stages.
    """
    import asyncio
    from schemas import RunConfig
    from utils.logging_utils import configure_logging
    from supabase_helpers import update_flowchart_stage, add_chat_message, fail_run
    
    configure_logging()
    
    current_stage = "prepare_dataset"
    
    try:
        # Update status to running
        update_flowchart_stage(swarm_run_id, "prepare_dataset", "active")
        add_chat_message(
            swarm_run_id, 
            "system", 
            f"Pipeline started for user {user_id[:8]}...", 
            "prepare_dataset"
        )
        
        # Import orchestrator here to avoid circular imports at module level
        from orchestrator import _run_pipeline
        
        run_cfg = RunConfig(
            dataset_path=dataset_path,
            task_description=task_description,
            labels_path=None,
            max_approaches=SETTINGS.max_approaches,
            max_tuning_iterations=SETTINGS.max_tuning_iterations,
            max_parallel_agents=SETTINGS.max_parallel_agents,
            max_train_fix_attempts=SETTINGS.max_train_fix_attempts,
            primary_metric=SETTINGS.default_primary_metric,
            maximize_metric=True,
            run_budget_usd=SETTINGS.max_run_budget_usd,
        )
        
        # Run the actual pipeline
        summary = await _run_pipeline(run_cfg, swarm_run_id=swarm_run_id)
        
        print(f"Pipeline completed successfully: {summary.run_id}")
        
    except Exception as e:
        print(f"Pipeline failed: {e}")
        try:
            fail_run(swarm_run_id, str(e), current_stage)
            add_chat_message(
                swarm_run_id,
                "system",
                f"❌ Pipeline failed: {str(e)}",
                "error"
            )
        except Exception as update_err:
            print(f"Failed to update error status: {update_err}")
        raise


# ============================================
# Mount FastAPI to Modal
# ============================================

@app.function(
    image=api_image,
    secrets=[supabase_secret],
    volumes={"/vol": data_volume},
    scaledown_window=300,  # Keep warm for 5 minutes
)
@modal.concurrent(max_inputs=100)
@modal.asgi_app()
def api():
    """
    Main ASGI endpoint that serves the FastAPI application.
    
    Deploy with: modal deploy api_endpoints.py
    Access at: https://<your-modal-workspace>--ml-agent-swarm-api.modal.run
    """
    return web_app


# ============================================
# Local Development
# ============================================

if __name__ == "__main__":
    # For local testing, you can run this file directly
    import uvicorn
    uvicorn.run(web_app, host="0.0.0.0", port=8000)
