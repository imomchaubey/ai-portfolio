import asyncio
import json
import math
import os
import re
from collections import Counter
from pathlib import Path
from typing import Dict, List

import groq
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.retrievers import BaseRetriever
from langchain_groq import ChatGroq
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
MODEL_NAME = "openai/gpt-oss-120b"
LLM_TIMEOUT_S = 30          # per-request timeout to Groq
FIRST_TOKEN_TIMEOUT_S = 25  # max wait for the first token
CHUNK_TIMEOUT_S = 20        # max stall between tokens
MAX_HISTORY_MESSAGES = 12

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# 1. Knowledge base (profile.json + deep technical notes)
# ---------------------------------------------------------------------------
with open(BASE_DIR / "profile.json", "r", encoding="utf-8") as f:
    candidate_profile = json.load(f)

# Technical deep-dive notes. Only facts from the profile / owner-provided
# project descriptions belong here -- the model is told not to go beyond them.
TECHNICAL_NOTES = [
    (
        "anomaly_detection_deep_dive",
        "Anomaly Detection in Network Traffic -- technical deep dive. "
        "Dataset: UNSW-NB15 (network intrusion benchmark). "
        "Architecture: hybrid classifier. Isolation Forest decision-function scores "
        "(unsupervised anomaly signal) are used as an extra feature that is fed, "
        "together with the original features, into a Random Forest classifier. "
        "Class imbalance is handled with SMOTE oversampling: synthetic minority-class "
        "samples are interpolated between nearest neighbours so the classifier is not "
        "dominated by the majority (normal) class. "
        "Results: 95% accuracy and 1.00 precision, meaning no benign flow was flagged "
        "as an attack on the evaluation split (zero false positives).",
    ),
    (
        "de_insure_iot",
        "De-Insure -- IoT system. Hardware: ESP32 microcontroller with a DHT22 "
        "temperature and humidity sensor streaming telemetry. "
        "Part of Om's embedded/IoT and applied-ML work.",
    ),
    (
        "brainova_platform",
        "Brainova -- a platform project built by Om Prakash Chaubey. "
        "Detailed internals are not documented in this knowledge base.",
    ),
    (
        "topsis_pypi_package",
        "TOPSIS PyPI package -- Python package implementing the TOPSIS multi-criteria "
        "decision algorithm (published on PyPI). It grew out of the TOPSIS Ranking "
        "Framework for NLP Models project, which ranks BERT, RoBERTa and DistilBERT "
        "using NumPy and Pandas.",
    ),
    (
        "ecommerce_xgboost",
        "E-Commerce Data Analysis & Prediction Dashboard: XGBoost model with 90% accuracy "
        "plus a Streamlit dashboard visualising KPIs such as Average Order Value and "
        "delivery delays.",
    ),
    (
        "emotion_recognition",
        "Emotion Recognition with Deep Learning: convolutional model with 85.75% accuracy, "
        "improved through data augmentation (noise addition and pitch shifting).",
    ),
]


def build_documents() -> List[Document]:
    p = candidate_profile
    docs = [
        Document(
            page_content=(
                f"Name: {p['name']}. Education: {p['education']}. "
                f"Roll number: {p.get('roll_number', 'n/a')}."
            ),
            metadata={"source": "profile.education"},
        ),
        Document(
            page_content=f"Contact: {json.dumps(p['contact'])}. Links: {json.dumps(p['links'])}.",
            metadata={"source": "profile.contact"},
        ),
        Document(
            page_content="Skills: " + ", ".join(p["skills"]),
            metadata={"source": "profile.skills"},
        ),
        Document(
            page_content="Certifications: " + "; ".join(p["certifications"]),
            metadata={"source": "profile.certifications"},
        ),
    ]
    for proj in p["projects"]:
        docs.append(
            Document(
                page_content=f"Project: {proj['name']}. {proj['description']}",
                metadata={"source": f"profile.project:{proj['name']}"},
            )
        )
    for key, text in TECHNICAL_NOTES:
        docs.append(Document(page_content=text, metadata={"source": f"notes.{key}"}))

    splitter = RecursiveCharacterTextSplitter(chunk_size=700, chunk_overlap=80)
    return splitter.split_documents(docs)


# ---------------------------------------------------------------------------
# 2. Lightweight BM25 retriever (no embedding model / extra downloads needed)
# ---------------------------------------------------------------------------
_TOKEN_RE = re.compile(r"[a-z0-9\.\+#%]+")


def _tokenize(text: str) -> List[str]:
    return _TOKEN_RE.findall(text.lower())


class BM25Retriever(BaseRetriever):
    docs: List[Document]
    k: int = 4
    k1: float = 1.5
    b: float = 0.75

    def _scores(self, query: str) -> List[float]:
        tokenized = [_tokenize(d.page_content) for d in self.docs]
        n = len(tokenized)
        avg_len = sum(len(t) for t in tokenized) / max(n, 1)
        df: Counter = Counter()
        for t in tokenized:
            df.update(set(t))
        scores = []
        q_terms = _tokenize(query)
        for toks in tokenized:
            tf = Counter(toks)
            s = 0.0
            for term in q_terms:
                if term not in tf:
                    continue
                idf = math.log(1 + (n - df[term] + 0.5) / (df[term] + 0.5))
                num = tf[term] * (self.k1 + 1)
                den = tf[term] + self.k1 * (1 - self.b + self.b * len(toks) / avg_len)
                s += idf * num / den
            scores.append(s)
        return scores

    def _get_relevant_documents(self, query: str, *, run_manager=None) -> List[Document]:
        scores = self._scores(query)
        ranked = sorted(zip(scores, self.docs), key=lambda x: x[0], reverse=True)
        hits = [d for s, d in ranked[: self.k] if s > 0]
        # Always keep the fundamentals available as a fallback.
        return hits or self.docs[: self.k]


documents = build_documents()
retriever = BM25Retriever(docs=documents, k=4)

# ---------------------------------------------------------------------------
# 3. LangChain RAG chain (prompt | ChatGroq | parser)
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = """You are the AI representative of Om Prakash Chaubey, running inside a
developer-terminal portfolio. Answer recruiter and engineer questions using ONLY the
retrieved context below.

Rules:
1. If the information is not in the context, politely say you do not have that information.
2. Never invent or hallucinate skills, experiences, metrics or projects.
3. When asked about technical depth, be precise: cite exact metrics (e.g. 95% accuracy,
   1.00 precision), datasets, algorithms and techniques (e.g. SMOTE, Isolation Forest +
   Random Forest) exactly as given in the context, and explain *why* they were used.
4. Keep answers professional and concise. Use short Markdown (lists, `inline code`).

Retrieved context:
{context}
"""

prompt = ChatPromptTemplate.from_messages(
    [
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder("history"),
        ("human", "{question}"),
    ]
)

class MissingKeyError(RuntimeError):
    pass


_chain = None


def get_chain():
    """Build the chain lazily. ChatGroq reads GROQ_API_KEY from the environment."""
    global _chain
    if _chain is None:
        if not os.environ.get("GROQ_API_KEY"):
            raise MissingKeyError("GROQ_API_KEY missing")
        llm = ChatGroq(
            model=MODEL_NAME,
            temperature=0.2,
            timeout=LLM_TIMEOUT_S,
            max_retries=1,
            streaming=True,
        )
        _chain = prompt | llm | StrOutputParser()
    return _chain

# Per-session memory
sessions: Dict[str, List[BaseMessage]] = {}


def format_context(docs: List[Document]) -> str:
    return "\n\n".join(f"[{d.metadata.get('source', 'doc')}]\n{d.page_content}" for d in docs)


# ---------------------------------------------------------------------------
# 4. Error formatting -> terminal-style logs
# ---------------------------------------------------------------------------
def to_terminal_error(exc: Exception) -> str:
    if isinstance(exc, (asyncio.TimeoutError, groq.APITimeoutError)):
        return "[ERROR] 504 Gateway Timeout: upstream LLM did not respond in time"
    if isinstance(exc, groq.APIConnectionError):
        return "[ERROR] Connection refused: unable to reach LLM provider"
    if isinstance(exc, groq.RateLimitError):
        return "[ERROR] 429 Too Many Requests: rate limit exceeded, retry shortly"
    if isinstance(exc, (groq.AuthenticationError, MissingKeyError)):
        return "[ERROR] 401 Unauthorized: invalid or missing GROQ_API_KEY"
    if isinstance(exc, groq.APIStatusError):
        return f"[ERROR] {exc.status_code} upstream error: {exc.__class__.__name__}"
    return f"[ERROR] Internal fault: {exc.__class__.__name__}: {exc}"


def sse(event: str, payload: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


@app.get("/health")
async def health():
    return {"status": "ok", "chunks": len(documents), "model": MODEL_NAME}


@app.post("/chat")
async def chat_endpoint(request: ChatRequest):
    history = sessions.setdefault(request.session_id, [])

    async def generate_stream():
        full_response = ""
        try:
            docs = retriever.invoke(request.message)
            yield sse("sources", {"sources": [d.metadata.get("source") for d in docs]})

            stream = get_chain().astream(
                {
                    "context": format_context(docs),
                    "history": history[-MAX_HISTORY_MESSAGES:],
                    "question": request.message,
                }
            )
            iterator = stream.__aiter__()
            first = True
            while True:
                wait = FIRST_TOKEN_TIMEOUT_S if first else CHUNK_TIMEOUT_S
                try:
                    token = await asyncio.wait_for(iterator.__anext__(), timeout=wait)
                except StopAsyncIteration:
                    break
                first = False
                full_response += token
                yield sse("token", {"token": token})

            history.extend([HumanMessage(request.message), AIMessage(full_response)])
            yield sse("done", {})
        except Exception as e:  # noqa: BLE001 - surface every failure to the terminal
            yield sse("error", {"message": to_terminal_error(e)})
            yield sse("done", {})

    return StreamingResponse(generate_stream(), media_type="text/event-stream")