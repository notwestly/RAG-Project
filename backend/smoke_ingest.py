"""
Manual integration smoke test. Run once after db_setup.sql to confirm
the full ingest pipeline works end to end before building retrieval.

Usage:
    python smoke_ingest.py path\\to\\small.pdf
"""
import sys
import uuid
from ingest import ingest_pdf
from db import get_client


def main():
    if len(sys.argv) < 2:
        print("Usage: python smoke_ingest.py <path_to_pdf>")
        sys.exit(1)

    path = sys.argv[1]
    session_id = f"smoke-{uuid.uuid4()}"
    print(f"Ingesting: {path}")
    print(f"Session:   {session_id}")

    count = ingest_pdf(path, session_id, "smoke_test.pdf")
    print(f"Stored {count} chunks via Voyage + Supabase.")

    client = get_client()
    rows = client.table("documents").select("id, content, metadata").eq("session_id", session_id).execute()

    if len(rows.data) != count:
        print(f"MISMATCH — ingest returned {count} but Supabase has {len(rows.data)} rows.")
        sys.exit(1)

    preview = rows.data[0]["content"][:120].replace("\n", " ")
    print(f"First chunk preview: {preview}")

    client.table("documents").delete().eq("session_id", session_id).execute()
    print("Rows cleaned up.")
    print("Smoke test PASSED.")


if __name__ == "__main__":
    main()
