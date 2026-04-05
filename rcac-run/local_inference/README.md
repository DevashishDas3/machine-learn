run start_vllm.sh


# Local: 
ssh -N -L 8123:<COMPUTE_NODE_IP>:8123 li5042@gilbreth.rcac.purdue.edu
ssh -N -L 8123:172.18.49.213:8123 li5042@gilbreth.rcac.purdue.edu

## linux: 
curl http://localhost:8123/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "messages": [
      {"role": "user", "content": "Write a Python function to calculate the Fibonacci sequence."}
    ]
  }'

## windows: 
curl.exe http://localhost:8123/v1/chat/completions `
  -H "Content-Type: application/json" `
  -d "{\`"model\`": \`"Qwen/Qwen2.5-Coder-32B-Instruct\`", \`"messages\`": [{\`"role\`": \`"user\`", \`"content\`": \`"Write a Python function to calculate the Fibonacci sequence.\`"}]}"


