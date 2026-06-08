import anthropic
from typing import Generator
from config import ANTHROPIC_API_KEY

_SYSTEM_TEMPLATE = """You are a helpful assistant that answers questions based on the provided document context.

Context from the document:
{context}

Answer questions based on this context. If the answer is not found in the context, say so clearly."""


def build_system_prompt(chunks: list[str]) -> str:
    context = "\n\n---\n\n".join(chunks)
    return _SYSTEM_TEMPLATE.format(context=context)


def stream_response(chunks: list[str], messages: list[dict]) -> Generator[str, None, None]:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    system_prompt = build_system_prompt(chunks)

    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
