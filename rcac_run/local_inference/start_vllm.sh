#!/bin/bash
#SBATCH --account mlp
#SBATCH --partition=ai
#SBATCH --qos=normal
#SBATCH --ntasks=1 --cpus-per-task=14
#SBATCH --nodes=1 --gpus-per-node=1
#SBATCH --mem=256G
#SBATCH --time=12:00:00
#SBATCH --job-name qwen_api
#SBATCH --output=/scratch/gautschi/li5042/catapult2026/rcac_run/local_inference/start_vllm.out
#SBATCH --error=/scratch/gautschi/li5042/catapult2026/rcac_run/local_inference/start_vllm.err

#command: 
#sbatch /scratch/gautschi/li5042/catapult2026/rcac_run/local_inference/start_vllm.sh

# Clear any loaded modules to ensure a clean environment
# module purge

echo "Initializing vLLM via Conda in Scratch Space..."

# 1. Reroute ALL massive downloads to your scratch space
export PIP_CACHE_DIR=$RCAC_SCRATCH/pip_cache
export HF_HOME=$RCAC_SCRATCH/huggingface_cache

# Load the RCAC Conda module
module load conda

# Automatically accept the Anaconda Terms of Service to prevent the CondaToS error
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r

# 2. Create the environment IN SCRATCH using the -p (prefix) flag instead of -n
conda create -p $RCAC_SCRATCH/vllm_env python=3.10 -y

# 3. Activate the environment using the absolute path
source activate $RCAC_SCRATCH/vllm_env

# Install vLLM
pip install vllm

# Print the compute node's IP and custom port (8123) to avoid Errno 98 (Port in use)
echo "vLLM API Endpoint hosted on: $(hostname -I | awk '{print $1}'):8123"

# Start the OpenAI-compatible server
# python -m vllm.entrypoints.openai.api_server \
#     --model Qwen/Qwen2.5-Coder-32B-Instruct \
#     --tensor-parallel-size 1 \
#     --max-model-len 8192 \
#     --port 8123

python -m vllm.entrypoints.openai.api_server \
    --model Qwen/Qwen2.5-Coder-32B-Instruct \
    --tensor-parallel-size 1 \
    --max-model-len 8192 \
    --port 8123 \
    --api-key "bananabobjoe" \
    --enable-log-requests # Log incoming requests for debugging and monitoring
