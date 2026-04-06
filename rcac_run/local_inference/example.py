from openai import OpenAI

# Drop the ngrok URL here (make sure to append /v1)
client = OpenAI(
    base_url="https://1a2b-3c4d.ngrok-free.app/v1", 
    api_key="EMPTY"
)

response = client.chat.completions.create(
    model="Qwen/Qwen2.5-Coder-32B-Instruct",
    messages=[
        {"role": "user", "content": "Write a Python script to reverse a linked list."}
    ]
)

print(response.choices[0].message.content)


