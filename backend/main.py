import uuid
import tempfile
import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from ingest import ingest_pdf
from retrieval import retrieve
from chat import stream_response
from db import delete_session

app = FastAPI(title="RAG Document Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://rag.jhestly.com",
        "https://rag-project-mc9csqeli-westly-s-projects.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    session_id: str
    messages: list[dict]


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    session_id = str(uuid.uuid4())

    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        chunk_count, page_count = ingest_pdf(tmp_path, session_id, file.filename)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")
    finally:
        os.unlink(tmp_path)

    return {"session_id": session_id, "chunk_count": chunk_count, "page_count": page_count}


@app.post("/chat")
async def chat(request: ChatRequest):
    if not request.messages:
        raise HTTPException(status_code=400, detail="messages array is empty")

    last_message = request.messages[-1]["content"]

    try:
        chunks = retrieve(last_message, request.session_id)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Retrieval failed: {str(e)}")

    def generate():
        try:
            for token in stream_response(chunks, request.messages):
                yield f"data: {token}\n\n"
        except Exception:
            yield "data: [ERROR]\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.delete("/session/{session_id}")
async def delete_session_route(session_id: str):
    try:
        delete_session(session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"status": "deleted", "session_id": session_id}
