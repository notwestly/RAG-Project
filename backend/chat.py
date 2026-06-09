import anthropic
from typing import Generator
from config import ANTHROPIC_API_KEY

_SYSTEM_TEMPLATE = """You are a precise document assistant. Answer questions using only the document context provided below.

Rules:
- Base every answer strictly on the context. Do not use outside knowledge.
- When you quote or reference specific information, indicate where in the document it appears (e.g. "According to the document..." or "In the section on X...").
- If the context doesn't contain enough information to answer, say so clearly and suggest a more specific question the user could ask.
- Be concise. For simple factual questions, answer in 1-3 sentences. For complex questions, use bullet points or short paragraphs.

Context from the document:
{context}"""


def build_system_prompt(chunks: list[str]) -> str:
    context = "\n\n---\n\n".join(chunks)
    return _SYSTEM_TEMPLATE.format(context=context)


def stream_response(chunks: list[str], messages: list[dict]) -> Generator[str, None, None]:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    system_prompt = build_system_prompt(chunks)

    with client.messages.stream(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=system_prompt,
        messages=messages,
    ) as stream:
        for text in stream.text_stream:
            yield text
