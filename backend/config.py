import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
VOYAGE_API_KEY    = os.getenv("VOYAGE_API_KEY")
SUPABASE_URL      = os.getenv("SUPABASE_URL")
SUPABASE_KEY      = os.getenv("SUPABASE_KEY")

CHUNK_SIZE        = 512
CHUNK_OVERLAP     = 50
TOP_K_RETRIEVE    = 20
TOP_K_RERANK      = 5
STREAM_CHUNK_SIZE = 1
