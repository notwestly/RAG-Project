import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
import pytest


# ── db layer ─────────────────────────────────────────────────────────────────

def test_store_chunks_calls_supabase_insert():
    mock_client = MagicMock()
    mock_client.table.return_value.insert.return_value.execute.return_value = MagicMock()

    with patch("db.get_client", return_value=mock_client):
        import db
        db.store_chunks([{"session_id": "s1", "content": "hello", "embedding": [0.1] * 1024}])

    mock_client.table.assert_called_once_with("documents")
    mock_client.table.return_value.insert.assert_called_once()


def test_delete_session_calls_supabase_delete():
    mock_client = MagicMock()
    mock_client.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()

    with patch("db.get_client", return_value=mock_client):
        import db
        db.delete_session("session-abc")

    mock_client.table.assert_called_once_with("documents")
    mock_client.table.return_value.delete.return_value.eq.assert_called_once_with("session_id", "session-abc")


# ── ingest ────────────────────────────────────────────────────────────────────

def test_chunk_text_produces_overlapping_windows():
    from ingest import chunk_text
    words = ["word"] * 600
    text = " ".join(words)
    chunks = chunk_text(text, chunk_size=512, overlap=50)
    assert len(chunks) >= 2
    for chunk in chunks:
        assert len(chunk.split()) <= 512


def test_chunk_text_short_text_gives_one_chunk():
    from ingest import chunk_text
    text = "hello world this is a short text"
    chunks = chunk_text(text)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_ingest_pdf_raises_on_empty_text():
    with patch("ingest.extract_text", return_value=("   ", 1)):
        with patch("ingest.store_chunks"):
            from ingest import ingest_pdf
            with pytest.raises(ValueError, match="No extractable text"):
                ingest_pdf("/fake/path.pdf", "session-1", "fake.pdf")


def test_ingest_pdf_returns_chunk_count():
    fake_text = " ".join(["word"] * 100)
    fake_embedding = [0.1] * 1024

    mock_voyage_result = MagicMock()
    mock_voyage_result.embeddings = [fake_embedding]

    with patch("ingest.extract_text", return_value=(fake_text, 3)), \
         patch("ingest.voyageai.Client") as mock_voyage_cls, \
         patch("ingest.store_chunks") as mock_store:

        mock_voyage_cls.return_value.embed.return_value = mock_voyage_result
        from ingest import ingest_pdf
        chunk_count, page_count = ingest_pdf("/fake/path.pdf", "session-1", "fake.pdf")

    assert chunk_count >= 1
    assert page_count == 3
    mock_store.assert_called_once()
