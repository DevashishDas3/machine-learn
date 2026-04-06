install openai

modifier example.secrets.env into .secrets.env

use rcac_config.py

start_vllm.sh will start a qwen 32b open-ai compatible api endpoint via vLLM 
script run via SLURM job manager on high performance cluster (working env: purdue gautschi)
dummmy api key: bananabobjoe

# usage: 

## curl: 
Here is the exact `curl` command your teammates can use from any external computer to verify the Tailscale Funnel is reachable and routing correctly to the vLLM endpoint. 

This command includes the `bananabobjoe` API key you set up earlier and asks the model for a simple "Pong" response to keep the test lightning-fast.

### Mac / Linux Terminal:
```bash
curl https://<YOUR-MACHINE-NAME>.tailnet-<XXXXX>.ts.net:8443/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer bananabobjoe" \
  -d '{
    "model": "Qwen/Qwen2.5-Coder-32B-Instruct",
    "messages": [{"role": "user", "content": "Ping! Reply with exactly one word: Pong."}],
    "max_tokens": 10
  }'
```

### Windows PowerShell:
*(Remember, Windows PowerShell requires `curl.exe` and specific quote escaping for the JSON payload!)*

```powershell
curl.exe https://<YOUR-MACHINE-NAME>.tailnet-<XXXXX>.ts.net:8443/v1/chat/completions `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer bananabobjoe" `
  -d "{\`"model\`": \`"Qwen/Qwen2.5-Coder-32B-Instruct\`", \`"messages\`": [{\`"role\`": \`"user\`", \`"content\`": \`"Ping! Reply with exactly one word: Pong.\`"}], \`"max_tokens\`": 10}"
```

**What to look for:**
* **If it works:** They will get a JSON block back containing `"content": "Pong"`.
* **If it hangs forever:** The Tailscale Funnel URL is likely typed incorrectly, or the Funnel process crashed on your Nomad Server.
* **If they get `401 Unauthorized`:** The connection is perfect, but the `api-key` in the `curl` command doesn't match the one currently running on the Purdue cluster!


## python 
from openai import OpenAI

# Replace with your actual Tailscale Funnel URL + /v1
client = OpenAI(
    base_url="https://nomad-server.tailnet-xxxxx.ts.net:8443/v1",
    api_key="hackathon-secret-key-123" # Must match the --api-key flag in start_vllm.sh
)

response = client.chat.completions.create(
    model="Qwen/Qwen2.5-Coder-32B-Instruct",
    messages=[
        {"role": "system", "content": "You are a senior code instructor."},
        {"role": "user", "content": "Write a fast inverse square root algorithm in C."}
    ]
)

print(response.choices[0].message.content)