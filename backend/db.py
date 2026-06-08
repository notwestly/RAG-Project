from supabase import create_client, Client
from config import SUPABASE_URL, SUPABASE_KEY


def get_client() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def store_chunks(chunks: list[dict]) -> None:
    client = get_client()
    client.table("documents").insert(chunks).execute()


def similarity_search(embedding: list[float], session_id: str, top_k: int) -> list[dict]:
    client = get_client()
    result = client.rpc(
        "match_documents",
        {
            "query_embedding": embedding,
            "match_session_id": session_id,
            "match_count": top_k,
        },
    ).execute()
    return result.data


def delete_session(session_id: str) -> None:
    client = get_client()
    client.table("documents").delete().eq("session_id", session_id).execute()
