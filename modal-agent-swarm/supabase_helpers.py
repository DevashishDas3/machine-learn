"""
Supabase Helper Functions for Modal Agent Swarm

This module provides helper functions to update the Supabase `swarm_runs` table
from within Modal containers. Use these functions to push intermediate agent
state and final results to the dashboard.

Environment Variables Required:
- SUPABASE_URL: Your Supabase project URL
- SUPABASE_SERVICE_ROLE_KEY: Service role key for backend access

Usage:
    from supabase_helpers import update_flowchart_stage, complete_run, add_chat_message

    # Update current stage
    update_flowchart_stage(run_id, "plan_agent", "active")

    # Add chat message
    add_chat_message(run_id, "agent", "Planning optimal architecture...")

    # Complete run with final report
    complete_run(run_id, accuracy=0.95, loss=0.05, ...)
"""

import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
from supabase import create_client, Client


def get_supabase_client() -> Client:
    """Create Supabase client using service role key."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables required"
        )

    return create_client(url, key)


def create_run(
    user_id: str,
    name: str,
    initial_message: Optional[str] = None,
    run_data: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Create a new swarm run record.

    Args:
        user_id: The authenticated user's ID
        name: Display name for the run (e.g., "MNIST Classification")
        initial_message: Optional initial chat message
        run_data: Optional metadata about the run request

    Returns:
        The created run ID
    """
    supabase = get_supabase_client()

    # Initialize flowchart data structure
    flowchart_data = {
        "stages": [
            {"id": "prepare_dataset", "label": "Prepare Dataset", "status": "pending"},
            {"id": "load_modal", "label": "Load to Modal Volume", "status": "pending"},
            {"id": "explorer_agent", "label": "ExplorerAgent", "status": "pending"},
            {"id": "plan_agent", "label": "PlanAgent", "status": "pending"},
            {
                "id": "implement_agent",
                "label": "ImplementationAgent",
                "status": "pending",
            },
            {"id": "tune_agent", "label": "TuningAgent", "status": "pending"},
            {"id": "report_agent", "label": "ReportAgent", "status": "pending"},
        ],
        "connections": [
            {"from": "prepare_dataset", "to": "load_modal", "active": False},
            {"from": "load_modal", "to": "explorer_agent", "active": False},
            {"from": "explorer_agent", "to": "plan_agent", "active": False},
            {"from": "plan_agent", "to": "implement_agent", "active": False},
            {"from": "implement_agent", "to": "tune_agent", "active": False},
            {"from": "tune_agent", "to": "report_agent", "active": False},
        ],
    }

    chat_messages = []
    if initial_message:
        chat_messages.append(
            {
                "id": f"msg_{datetime.utcnow().timestamp()}",
                "role": "system",
                "content": initial_message,
                "timestamp": datetime.utcnow().isoformat(),
                "stage": "init",
            }
        )

    data = {
        "user_id": user_id,
        "name": name,
        "status": "pending",
        "current_phase": "prepare_dataset",
        "flowchart_data": flowchart_data,
        "final_report": None,
        "chat_messages": chat_messages,
        "run_data": run_data or {},
    }

    result = supabase.table("swarm_runs").insert(data).execute()
    return result.data[0]["id"]


def update_flowchart_stage(
    run_id: str,
    stage_id: str,
    status: str,
    details: Optional[str] = None,
    metrics: Optional[Dict[str, float]] = None,
) -> None:
    """
    Update a specific stage in the flowchart.

    Args:
        run_id: The swarm run ID
        stage_id: Stage identifier (e.g., "plan_agent", "implement_agent")
        status: New status ("pending", "active", "complete", "error")
        details: Optional status details
        metrics: Optional metrics dict for the stage
    """
    supabase = get_supabase_client()

    # Fetch current flowchart data
    result = (
        supabase.table("swarm_runs")
        .select("flowchart_data")
        .eq("id", run_id)
        .single()
        .execute()
    )
    flowchart_data = result.data["flowchart_data"] or {}

    # Update the specific stage
    stages = flowchart_data.get("stages", [])
    for stage in stages:
        if stage["id"] == stage_id:
            stage["status"] = status
            if details:
                stage["details"] = details
            if metrics:
                stage["metrics"] = metrics
            if status == "active":
                stage["startedAt"] = datetime.utcnow().isoformat()
            elif status in ("complete", "error"):
                stage["completedAt"] = datetime.utcnow().isoformat()
            break

    # Update connections based on stage status
    connections = flowchart_data.get("connections", [])
    for conn in connections:
        # Activate connection if source stage is complete
        source_stage = next((s for s in stages if s["id"] == conn["from"]), None)
        if source_stage and source_stage.get("status") == "complete":
            conn["active"] = True

    flowchart_data["stages"] = stages
    flowchart_data["connections"] = connections

    # Update database
    supabase.table("swarm_runs").update(
        {
            "flowchart_data": flowchart_data,
            "current_phase": stage_id,
            "status": "running"
            if status == "active"
            else ("error" if status == "error" else "running"),
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("id", run_id).execute()


def add_chat_message(
    run_id: str,
    role: str,
    content: str,
    stage: Optional[str] = None,
) -> None:
    """
    Add a chat message to the run's message history.

    Args:
        run_id: The swarm run ID
        role: Message role ("system", "agent", "user")
        content: Message content
        stage: Optional stage identifier
    """
    supabase = get_supabase_client()

    # Fetch current messages
    result = (
        supabase.table("swarm_runs")
        .select("chat_messages")
        .eq("id", run_id)
        .single()
        .execute()
    )
    messages = result.data["chat_messages"] or []

    # Add new message
    messages.append(
        {
            "id": f"msg_{datetime.utcnow().timestamp()}",
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "stage": stage,
        }
    )

    # Update database
    supabase.table("swarm_runs").update(
        {
            "chat_messages": messages,
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("id", run_id).execute()


def complete_run(
    run_id: str,
    accuracy: Optional[float] = None,
    loss: Optional[float] = None,
    total_time_gpu: Optional[float] = None,
    best_hyperparameters: Optional[Dict[str, Any]] = None,
    recommendation: Optional[str] = None,
    report: Optional[str] = None,
) -> None:
    """
    Mark the run as complete and set the final report.

    Args:
        run_id: The swarm run ID
        accuracy: Final model accuracy (0-1)
        loss: Final training loss
        total_time_gpu: Total GPU time in seconds
        best_hyperparameters: Dict of optimal hyperparameters
        recommendation: Summary recommendation text
        report: Full markdown report
    """
    supabase = get_supabase_client()

    # Build final report
    final_report = {
        "accuracy": accuracy,
        "loss": loss,
        "totalTimeGpu": total_time_gpu,
        "bestHyperparameters": best_hyperparameters,
        "recommendation": recommendation,
        "report": report,
    }

    # Update all stages to complete
    result = (
        supabase.table("swarm_runs")
        .select("flowchart_data")
        .eq("id", run_id)
        .single()
        .execute()
    )
    flowchart_data = result.data["flowchart_data"] or {}

    for stage in flowchart_data.get("stages", []):
        if stage["status"] != "error":
            stage["status"] = "complete"
            if not stage.get("completedAt"):
                stage["completedAt"] = datetime.utcnow().isoformat()

    for conn in flowchart_data.get("connections", []):
        conn["active"] = True

    # Update database
    supabase.table("swarm_runs").update(
        {
            "status": "complete",
            "current_phase": "complete",
            "flowchart_data": flowchart_data,
            "final_report": final_report,
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("id", run_id).execute()


def fail_run(run_id: str, error_message: str, failed_stage: str) -> None:
    """
    Mark the run as failed.

    Args:
        run_id: The swarm run ID
        error_message: Error description
        failed_stage: The stage that failed
    """
    supabase = get_supabase_client()

    # Update the failed stage
    update_flowchart_stage(run_id, failed_stage, "error", details=error_message)

    # Add error message to chat
    add_chat_message(
        run_id,
        "system",
        f"❌ Error in {failed_stage}: {error_message}",
        stage=failed_stage,
    )

    # Update run status
    supabase.table("swarm_runs").update(
        {
            "status": "error",
            "updated_at": datetime.utcnow().isoformat(),
        }
    ).eq("id", run_id).execute()


# ============================================
# Example Usage in Modal Function
# ============================================

"""
Example integration with a Modal function:

```python
import modal
from supabase_helpers import (
    create_run,
    update_flowchart_stage,
    add_chat_message,
    complete_run,
)

app = modal.App("ml-agent-swarm")

@app.cls(gpu="A100")
class AgentSwarm:
    def __init__(self, run_id: str):
        self.run_id = run_id
    
    @modal.method()
    def run_pipeline(self, dataset_path: str, task_description: str):
        try:
            # Stage 1: Prepare Dataset
            update_flowchart_stage(self.run_id, "prepare_dataset", "active")
            add_chat_message(self.run_id, "agent", f"Loading dataset from {dataset_path}...")
            # ... preparation logic ...
            update_flowchart_stage(self.run_id, "prepare_dataset", "complete")
            
            # Stage 2: Load to Modal Volume
            update_flowchart_stage(self.run_id, "load_modal", "active")
            add_chat_message(self.run_id, "agent", "Uploading to Modal volume...")
            # ... upload logic ...
            update_flowchart_stage(self.run_id, "load_modal", "complete")
            
            # Stage 3: Plan Agent
            update_flowchart_stage(self.run_id, "plan_agent", "active")
            add_chat_message(self.run_id, "agent", "Analyzing task and generating approach plan...")
            # ... planning logic ...
            add_chat_message(self.run_id, "agent", "Plan: Using ResNet-18 with data augmentation")
            update_flowchart_stage(self.run_id, "plan_agent", "complete")
            
            # Stage 4: Implementation Agent
            update_flowchart_stage(self.run_id, "implement_agent", "active")
            add_chat_message(self.run_id, "agent", "Generating training code for A100 cluster...")
            # ... code generation and training ...
            update_flowchart_stage(
                self.run_id, 
                "implement_agent", 
                "complete",
                metrics={"initial_accuracy": 0.85}
            )
            
            # Stage 5: Tuning Agent
            update_flowchart_stage(self.run_id, "tune_agent", "active")
            add_chat_message(self.run_id, "agent", "Running hyperparameter optimization...")
            # ... tuning logic ...
            update_flowchart_stage(
                self.run_id,
                "tune_agent",
                "complete",
                metrics={"tuned_accuracy": 0.95}
            )
            
            # Stage 6: Report Agent
            update_flowchart_stage(self.run_id, "report_agent", "active")
            add_chat_message(self.run_id, "agent", "Generating final report...")
            # ... report generation ...
            
            # Complete the run
            complete_run(
                self.run_id,
                accuracy=0.95,
                loss=0.0512,
                total_time_gpu=342.5,
                best_hyperparameters={
                    "learning_rate": 0.001,
                    "batch_size": 64,
                    "epochs": 50,
                },
                recommendation="ResNet-18 with cosine annealing achieved optimal results",
                report="# Training Report\\n\\n## Summary\\n..."
            )
            add_chat_message(self.run_id, "system", "✅ Pipeline completed successfully!")
            
        except Exception as e:
            fail_run(self.run_id, str(e), "implement_agent")
            raise
```
"""
