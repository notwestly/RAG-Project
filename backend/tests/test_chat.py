import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import MagicMock, patch


def test_build_system_prompt_includes_all_chunks():
    from chat import build_system_prompt
    chunks = ["chunk one content", "chunk two content"]
    prompt = build_system_prompt(chunks)
    assert "chunk one content" in prompt
    assert "chunk two content" in prompt


def test_build_system_prompt_separates_chunks():
    from chat import build_system_prompt
    chunks = ["first", "second"]
    prompt = build_system_prompt(chunks)
    assert prompt.index("first") < prompt.index("second")


def test_stream_response_yields_tokens():
    mock_stream = MagicMock()
    mock_stream.__enter__ = MagicMock(return_value=mock_stream)
    mock_stream.__exit__ = MagicMock(return_value=False)
    mock_stream.text_stream = iter(["Hello", " world", "!"])

    with patch("chat.anthropic.Anthropic") as mock_cls:
        mock_cls.return_value.messages.stream.return_value = mock_stream
        from chat import stream_response
        tokens = list(stream_response(["context chunk"], [{"role": "user", "content": "hi"}]))

    assert tokens == ["Hello", " world", "!"]


def test_stream_response_uses_correct_model():
    mock_stream = MagicMock()
    mock_stream.__enter__ = MagicMock(return_value=mock_stream)
    mock_stream.__exit__ = MagicMock(return_value=False)
    mock_stream.text_stream = iter([])

    with patch("chat.anthropic.Anthropic") as mock_cls:
        mock_cls.return_value.messages.stream.return_value = mock_stream
        from chat import stream_response
        list(stream_response([], [{"role": "user", "content": "hi"}]))

    call_kwargs = mock_cls.return_value.messages.stream.call_args[1]
    assert call_kwargs["model"] == "claude-haiku-4-5-20251001"
