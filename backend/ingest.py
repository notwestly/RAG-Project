import fitz  # PyMuPDF
import voyageai
from config import VOYAGE_API_KEY, CHUNK_SIZE, CHUNK_OVERLAP
from db import store_chunks


def extract_text(file_path: str) -> tuple[str, int]:
    with fitz.open(file_path) as doc:
        text = "".join(page.get_text() for page in doc)
        page_count = len(doc)
    return text, page_count


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    i = 0
    while i < len(words):
        chunks.append(" ".join(words[i : i + chunk_size]))
        i += chunk_size - overlap
    return chunks


def embed_chunks(chunks: list[str]) -> list[list[float]]:
    client = voyageai.Client(api_key=VOYAGE_API_KEY)
    result = client.embed(chunks, model="voyage-3", input_type="document")
    return result.embeddings


def ingest_pdf(file_path: str, session_id: str, filename: str) -> tuple[int, int]:
    text, page_count = extract_text(file_path)
    if not text.strip():
        raise ValueError("No extractable text found in PDF")

    chunks = chunk_text(text)
    embeddings = embed_chunks(chunks)

    records = [
        {
            "session_id": session_id,
            "content": chunk,
            "embedding": embedding,
            "metadata": {"filename": filename, "chunk_index": i},
        }
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings))
    ]

    store_chunks(records)
    return len(records), page_count
