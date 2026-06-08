-- Enable pgvector extension (may already be enabled on your Supabase project)
CREATE EXTENSION IF NOT EXISTS vector;

-- One row per chunk from an uploaded PDF
CREATE TABLE IF NOT EXISTS documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text NOT NULL,
  content     text NOT NULL,
  embedding   vector(1024),
  metadata    jsonb,           -- filename, chunk_index
  created_at  timestamptz DEFAULT now()
);

-- RPC function called by the Python backend for similarity search.
-- Scoped to a single session so searches never bleed across uploads.
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding  vector(1024),
  match_session_id text,
  match_count      int
)
RETURNS TABLE (
  id         uuid,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    id,
    content,
    metadata,
    1 - (embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE session_id = match_session_id
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;
