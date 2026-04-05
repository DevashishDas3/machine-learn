from openai import OpenAI
client = OpenAI(
    #172.18.49.213:8000
    base_url="http://172.18.49.213:8000/v1", # "http://<COMPUTE_NODE_IP>:8000/v1"
    api_key="EMPTY" # vLLM doesn't require a key by default
)