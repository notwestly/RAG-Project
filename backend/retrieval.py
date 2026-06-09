import voyageai
from config import VOYAGE_API_KEY, TOP_K_RETRIEVE, TOP_K_RERANK
from db import similarity_search


def embed_query(query: str) -> list[float]:
    client = voyageai.Client(api_key=VOYAGE_API_KEY)
    result = client.embed([query], model="voyage-3", input_type="query")
    return result.embeddings[0]


def rerank_chunks(query: str, chunks: list[str], top_k: int = TOP_K_RERANK) -> list[str]:
    if not chunks:
        return []
    client = voyageai.Client(api_key=VOYAGE_API_KEY)
    effective_top_k = min(top_k, len(chunks))
    result = client.rerank(query, chunks, model="rerank-2", top_k=effective_top_k)
    return [r.document for r in result.results]


def retrieve(query: str, session_id: str) -> list[str]:
    embedding = embed_query(query)
    candidates = similarity_search(embedding, session_id, TOP_K_RETRIEVE)

    if not candidates:
        return []

    texts = [c["content"] for c in candidates]
    return rerank_chunks(query, texts, TOP_K_RERANK)
