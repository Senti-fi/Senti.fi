import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from pydantic_settings import BaseSettings, SettingsConfigDict
import os

# --- Configuration Loading ---
class Settings(BaseSettings):
    """Loads environment variables from the system environment."""
    model_config = SettingsConfigDict(extra='ignore') # Ignore extra env vars

    # FastAPI/Uvicorn
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = os.getenv("LUCY_RELOAD", "false").lower() == "true" # Read from env

    # Lucy AI Config
    MAX_MVP_RISK_SCORE: int = 3

    # LLM Config (Matching personality.py)
    OPENAI_API_KEY: str | None = None # Default to None
    GOOGLE_API_KEY: str | None = None # Default to None
    LLM_MODEL_NAME_OPENAI: str = "gpt-4o-mini" # Default model
    LLM_MODEL_NAME_GEMINI: str = "gemini-1.5-flash-latest" # Default model

    # External Service URLs
    # Correct default for Docker Compose network
    SENTI_BACKEND_API_URL: str = "http://senti-backend:5000/api"
    # Default to devnet, can be overridden by .env
    SOLANA_RPC_URL: str = "https://api.devnet.solana.com"

    # CORS Configuration
    # Accept either a comma-separated list or a single origin
    CORS_ORIGINS: str = "http://localhost:3002"
    CORS_CREDENTIALS: bool = True
    CORS_METHODS: str = "*"
    CORS_HEADERS: str = "*"

# Instantiate settings early so they are available globally
settings = Settings()

# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(message)s')
logger = logging.getLogger(__name__)

# --- Application Lifespan (Handles Startup Logic) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # --- On Startup ---
    logger.info("🚀 Lucy AI Service starting up...")
    
    # Import personality HERE to ensure settings are loaded BEFORE LLM init
    from .core import personality
    llm_info = personality.get_llm_info() # Get info about which LLM *actually* loaded
    
    logger.info(f"🧠 LLM: {llm_info}")
    logger.info(f"🛡️  Risk Score: Max {settings.MAX_MVP_RISK_SCORE}")
    
    yield # --- Application is now running ---
    
    # --- On Shutdown ---
    logger.info("Lucy AI Service shutting down...")

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Lucy AI Service for Senti",
    description="Provides AI-driven yield suggestions and conversational interactions.",
    version="0.1.0",
    lifespan=lifespan # Use the new lifespan manager
)

# --- CORS middleware (IMPORTANT: before routers are included) ---
# Parse origins
if isinstance(settings.CORS_ORIGINS, str) and settings.CORS_ORIGINS.strip() != "":
    if settings.CORS_ORIGINS.strip() == "*":
        parsed_origins = ["*"]
    else:
        parsed_origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
else:
    parsed_origins = []

# If credentials are enabled, wildcard origin is not allowed in browsers.
if settings.CORS_CREDENTIALS and parsed_origins == ["*"]:
    # Replace wildcard with explicit localhost dev origin
    logger.warning("CORS credentials requested but origins was '*'. Replacing with http://localhost:3002 for development.")
    parsed_origins = ["http://localhost:3002"]

# parse methods/headers
allow_methods = ["*"] if settings.CORS_METHODS == "*" else [m.strip() for m in settings.CORS_METHODS.split(",")]
allow_headers = ["*"] if settings.CORS_HEADERS == "*" else [h.strip() for h in settings.CORS_HEADERS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=parsed_origins or ["*"],
    allow_credentials=bool(settings.CORS_CREDENTIALS),
    allow_methods=allow_methods,
    allow_headers=allow_headers,
)

# --- Include API Router ---
# Import router here, after app is defined and middleware added
from .api.endpoints import router as api_router
app.include_router(api_router, prefix="/api/v1")

# --- Root Endpoint ---
@app.get("/", tags=["Health"])
async def read_root():
    """Simple health check endpoint."""
    logger.debug("Root endpoint '/' accessed.")

    return {"status": "ok", "message": "Lucy AI Service is running!"}

# --- Uvicorn Runner (for direct execution `python src/lucy_ai/main.py`) ---
if __name__ == "__main__":
    import uvicorn
    run_host = settings.HOST
    run_port = settings.PORT
    run_reload = settings.RELOAD

    logger.info(f"Starting Uvicorn server directly on {run_host}:{run_port} with reload={run_reload}")
    uvicorn.run(
        "src.lucy_ai.main:app", # Point to the app object
        host=run_host,
        port=run_port,
        reload=run_reload,
        log_level="info",
        reload_dirs=["src/lucy_ai"] if run_reload else None
    )