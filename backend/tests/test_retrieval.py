import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch
import pytest


def test_embed_query_returns_single_vector():
    mock_result = MagicMock()
    mock_result.embeddings = [[0.1] * 1024]

    with patch("retrieval.voyageai.Client") as mock_cls:
        mock_cls.return_value.embed.return_value = mock_result
        from retrieval import embed_query
        vec = embed_query("what is the main topic?")

    assert len(vec) == 1024
    mock_cls.return_value.embed.assert_called_once_with(
        ["what is the main topic?"], model="voyage-3", input_type="query"
    )


def test_rerank_chunks_returns_top_k_strings():
    doc1 = MagicMock()
    doc1.document = "most relevant chunk"
    doc2 = MagicMock()
    doc2.document = "second chunk"

    mock_result = MagicMock()
    mock_result.results = [doc1, doc2]

    with patch("retrieval.voyageai.Client") as mock_cls:
        mock_cls.return_value.rerank.return_value = mock_result
        from retrieval import rerank_chunks
        results = rerank_chunks("query", ["most relevant chunk", "second chunk", "irrelevant"], top_k=2)

    assert results == ["most relevant chunk", "second chunk"]


def test_retrieve_returns_empty_list_when_no_chunks():
    with patch("retrieval.embed_query", return_value=[0.1] * 1024), \
         patch("retrieval.similarity_search", return_value=[]):
        from retrieval import retrieve
        result = retrieve("any question", "session-xyz")

    assert result == []


def test_retrieve_full_pipeline():
    fake_candidates = [{"content": f"chunk {i}", "id": str(i)} for i in range(3)]
    reranked_doc = MagicMock()
    reranked_doc.document = "chunk 0"
    mock_rerank_result = MagicMock()
    mock_rerank_result.results = [reranked_doc]

    with patch("retrieval.embed_query", return_value=[0.1] * 1024), \
         patch("retrieval.similarity_search", return_value=fake_candidates), \
         patch("retrieval.voyageai.Client") as mock_cls:

        mock_cls.return_value.rerank.return_value = mock_rerank_result
        from retrieval import retrieve
        result = retrieve("question", "session-abc")

    assert result == ["chunk 0"]
