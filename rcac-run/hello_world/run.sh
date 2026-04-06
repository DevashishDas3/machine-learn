#!/bin/bash
#SBATCH --account mlp
#SBATCH --partition=ai
#SBATCH --qos=normal
#SBATCH --ntasks=1 --cpus-per-task=14
#SBATCH --nodes=1 --gpus-per-node=1
#SBATCH --mem=64G
#SBATCH --time=04:00:00
#SBATCH --job-name download_datasets
#SBATCH --output=/scratch/gautschi/li5042/catapult2026/rcac_run/hello_world/hello_world.out
#SBATCH --error=/scratch/gautschi/li5042/catapult2026/rcac_run/hello_world/hello_world.err

echo "hello world"