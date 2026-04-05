#!/bin/bash
#SBATCH --account mlp
#SBATCH --partition=ai
#SBATCH --qos=normal
#SBATCH --ntasks=1 --cpus-per-task=14
#SBATCH --nodes=1 --gpus-per-node=1
#SBATCH --mem=64G
#SBATCH --time=12:00:00
#SBATCH --job-name download_datasets
#SBATCH --output=/scratch/gautschi/li5042/catapult2026/rcac_run/local_inference/start_ollama.out
#SBATCH --error=/scratch/gautschi/li5042/catapult2026/rcac_run/local_inference/start_ollama.err

# Load Apptainer
# module load apptainer

# Set Apptainer cache directory to scratch space (important, models are large!)
export APPTAINER_CACHEDIR=$RCAC_SCRATCH/apptainer_cache
export OLLAMA_MODELS=$RCAC_SCRATCH/ollama_models

# Pull the lightweight Ollama image
apptainer pull docker://ollama/ollama:latest

echo "Ollama API Endpoint hosted on: $(hostname -I | awk '{print $1}'):11434"

# Start the Ollama server in the background using the Apptainer image
apptainer run --nv ollama_latest.sif serve &

# Wait a few seconds for the server to spin up
sleep 10

# Download and run the quantized 32b coder model
apptainer exec --nv ollama_latest.sif ollama run qwen2.5-coder:32b