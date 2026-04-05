"""
Test script to simulate a pipeline run and verify dashboard updates.

Usage:
1. First, sign up/login at http://localhost:3000/login
2. Copy your user_id from Supabase Dashboard -> Authentication -> Users
3. Run: python test_dashboard.py <your_user_id>

This will create a fake run and simulate stage updates so you can 
watch the dashboard update in realtime.
"""

import os
import sys
import time
from dotenv import load_dotenv

load_dotenv()

from supabase_helpers import (
    create_run,
    update_flowchart_stage,
    add_chat_message,
    complete_run,
)

def simulate_pipeline(user_id: str):
    print("=" * 50)
    print("SIMULATING ML PIPELINE")
    print("=" * 50)
    print(f"User ID: {user_id}")
    print()
    print("Open your dashboard at http://localhost:3000/dashboard")
    print("Watch the flowchart and chat update in realtime!")
    print()
    
    # Create a new run
    print("[1/8] Creating new run...")
    run_id = create_run(
        user_id=user_id,
        name="MNIST Classification Test",
        initial_message="Starting automated ML pipeline for MNIST digit classification"
    )
    print(f"      Created run: {run_id}")
    time.sleep(2)
    
    # Stage 1: Prepare Dataset
    print("[2/8] Preparing dataset...")
    update_flowchart_stage(run_id, "prepare_dataset", "active")
    add_chat_message(run_id, "agent", "Loading MNIST dataset (60,000 training images)...", "prepare_dataset")
    time.sleep(2)
    add_chat_message(run_id, "agent", "Dataset validated: 28x28 grayscale images, 10 classes", "prepare_dataset")
    update_flowchart_stage(run_id, "prepare_dataset", "complete")
    time.sleep(1)
    
    # Stage 2: Load to Modal
    print("[3/8] Uploading to Modal volume...")
    update_flowchart_stage(run_id, "load_modal", "active")
    add_chat_message(run_id, "agent", "Uploading dataset to Modal volume...", "load_modal")
    time.sleep(2)
    add_chat_message(run_id, "agent", "Upload complete: /vol/datasets/mnist", "load_modal")
    update_flowchart_stage(run_id, "load_modal", "complete")
    time.sleep(1)
    
    # Stage 3: Plan Agent
    print("[4/8] Running PlanAgent...")
    update_flowchart_stage(run_id, "plan_agent", "active")
    add_chat_message(run_id, "agent", "Analyzing task requirements...", "plan_agent")
    time.sleep(2)
    add_chat_message(run_id, "agent", "Generated 3 approaches: CNN, ResNet-18, MLP", "plan_agent")
    add_chat_message(run_id, "agent", "Estimated cost: $0.45 USD", "plan_agent")
    update_flowchart_stage(run_id, "plan_agent", "complete")
    time.sleep(1)
    
    # Stage 4: Implementation Agent
    print("[5/8] Running ImplementationAgent (code generation)...")
    update_flowchart_stage(run_id, "implement_agent", "active")
    add_chat_message(run_id, "agent", "Generating training code for CNN approach...", "implement_agent")
    time.sleep(2)
    add_chat_message(run_id, "agent", "Generated training scripts for CNN, ResNet-18, and MLP", "implement_agent")
    update_flowchart_stage(run_id, "implement_agent", "complete")
    time.sleep(1)

    # Stage 5: Initial Train
    print("[6/8] Running InitialTrainAgent...")
    update_flowchart_stage(run_id, "initial_train", "active")
    add_chat_message(run_id, "agent", "Training CNN on A100 GPU...", "initial_train")
    time.sleep(3)
    add_chat_message(run_id, "agent", "CNN training complete: accuracy=0.9823", "initial_train")
    add_chat_message(run_id, "agent", "Training ResNet-18...", "initial_train")
    time.sleep(2)
    add_chat_message(run_id, "agent", "ResNet-18 complete: accuracy=0.9912", "initial_train")
    update_flowchart_stage(run_id, "initial_train", "complete", metrics={"successful_runs": 3})
    time.sleep(1)
    
    # Stage 5: Tuning Agent
    print("[7/8] Running TuningAgent...")
    update_flowchart_stage(run_id, "tune_agent", "active")
    add_chat_message(run_id, "agent", "Starting hyperparameter optimization...", "tune_agent")
    time.sleep(2)
    add_chat_message(run_id, "agent", "Iteration 1: lr=0.001, batch=64 → accuracy=0.9934", "tune_agent")
    time.sleep(2)
    add_chat_message(run_id, "agent", "Iteration 2: lr=0.0005, batch=128 → accuracy=0.9951", "tune_agent")
    time.sleep(2)
    add_chat_message(run_id, "agent", "Best configuration found!", "tune_agent")
    update_flowchart_stage(run_id, "tune_agent", "complete")
    time.sleep(1)
    
    # Stage 6: Report Agent
    print("[8/8] Generating final report...")
    update_flowchart_stage(run_id, "report_agent", "active")
    add_chat_message(run_id, "agent", "Compiling results and generating report...", "report_agent")
    time.sleep(2)
    
    # Complete the run
    complete_run(
        run_id,
        accuracy=0.9951,
        loss=0.0156,
        total_time_gpu=127.3,
        best_hyperparameters={
            "learning_rate": 0.0005,
            "batch_size": 128,
            "epochs": 20,
            "optimizer": "AdamW",
        },
        recommendation="ResNet-18 with AdamW optimizer achieved best results (99.51% accuracy)",
        report="""# MNIST Classification Report

## Summary
Successfully trained and optimized models for MNIST digit classification.

## Best Model: ResNet-18
- **Final Accuracy**: 99.51%
- **Training Loss**: 0.0156
- **GPU Time**: 127.3 seconds

## Hyperparameters
- Learning Rate: 0.0005
- Batch Size: 128
- Epochs: 20
- Optimizer: AdamW

## Approaches Tested
1. CNN (Simple) - 98.23% accuracy
2. ResNet-18 - 99.51% accuracy ✓ Best
3. MLP - 97.12% accuracy

## Recommendation
Use ResNet-18 with the tuned hyperparameters for production deployment.
"""
    )
    add_chat_message(run_id, "system", "✅ Pipeline completed successfully!", "complete")
    
    print()
    print("=" * 50)
    print("SIMULATION COMPLETE!")
    print("=" * 50)
    print(f"Run ID: {run_id}")
    print("Check your dashboard to see the results!")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python test_dashboard.py <user_id>")
        print()
        print("To get your user_id:")
        print("1. Sign up at http://localhost:3000/signup")
        print("2. Go to Supabase Dashboard -> Authentication -> Users")
        print("3. Copy the 'User UID' value")
        sys.exit(1)
    
    user_id = sys.argv[1]
    simulate_pipeline(user_id)
