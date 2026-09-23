from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import os
from groq import Groq

app = FastAPI()

# Allow the React frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
# We will set the API key in the terminal shortly
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Load your profile data
with open("profile.json", "r") as f:
    candidate_profile = json.load(f)

# The System Prompt acts as the ultimate rulebook for the AI
SYSTEM_PROMPT = f"""
You are the AI representative of Om Prakash Chaubey. Your goal is to answer recruiter questions based ONLY on the provided profile.
Profile Data: {json.dumps(candidate_profile)}

Rules:
1. If the information is not in the JSON, politely state that you do not have that information.
2. Never invent or hallucinate skills, experiences, or projects.
3. Keep answers professional, concise, and conversational.
"""

# Global memory to remember context during a conversation
chat_memory = [{"role": "system", "content": SYSTEM_PROMPT}]

# Validate incoming data format
class ChatRequest(BaseModel):
    message: str

@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    # Save the user's message to memory
    chat_memory.append({"role": "user", "content": request.message})
    
    async def generate_stream():
        try:
            # Request a streaming response from Groq
            stream = client.chat.completions.create(
                model="openai/gpt-oss-120b", 
                messages=chat_memory,
                stream=True
            )
            
            full_response = ""
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    word = chunk.choices[0].delta.content
                    full_response += word
                    # Server-Sent Events (SSE) require this specific formatting
                    yield f"data: {word}\n\n"
            
            # Save the AI's complete answer to memory
            chat_memory.append({"role": "assistant", "content": full_response})
            
        except Exception as e:
            yield f"data: Error connecting to LLM: {str(e)}\n\n"
            
    return StreamingResponse(generate_stream(), media_type="text/event-stream")