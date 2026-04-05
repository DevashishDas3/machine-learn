from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables from .secrets.env in the root directory
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env_file = os.path.join(root_dir, ".secrets.env")
load_dotenv(env_file)

# load the API key from the environment variable
RCAC_API_KEY = os.getenv("RCAC_API_KEY")  
if not RCAC_API_KEY:
    raise ValueError("Please set the RCAC_API_KEY environment variable with your API key.")

# Point the client to your SSH tunnel!
rcac_client = OpenAI(
    base_url="https://rhlione.taileea67a.ts.net:8443/v1",
    api_key=RCAC_API_KEY # vLLM does not require an API key
)

def rcac_health_check():
    try:
        response = rcac_client.chat.completions.create(
            model="Qwen/Qwen2.5-Coder-32B-Instruct",
            messages=[{"role": "system", "content": "Health check."}]
        )
        return response is not None and len(response.choices) > 0
    except Exception as e:
        print(f"Health check failed: {e}")
        return False


def rcac_client_prompt(messages):
    print("Sending request to RCAC endpoint...")
    response = rcac_client.chat.completions.create(
        model="Qwen/Qwen2.5-Coder-32B-Instruct",
        messages=messages
    )
    return response.choices[0].message.content


if __name__ == "__main__":
    if rcac_health_check():
        print("RCAC endpoint is healthy!")
        test_messages = [
            {"role": "system", "content": "You are a helpful coding assistant."},
            {"role": "user", "content": "Write a Python function to calculate the Fibonacci sequence."}
        ]
        ai_response = rcac_client_prompt(test_messages)
        print("\n--- AI Response ---")
        print(ai_response)
    else:
        print("RCAC endpoint is not responding.")