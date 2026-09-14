import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

# Load environment variables from .env file
load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "ClipMind AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security & Auth
    SECRET_KEY: str = os.getenv("SECRET_KEY", os.getenv("JWT_SECRET_KEY", "clipmind-super-secret-jwt-key-2026-production-grade"))
    ALGORITHM: str = os.getenv("ALGORITHM", os.getenv("JWT_ALGORITHM", "HS256"))
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24 * 7)))
    
    # OAuth & External Video API Credentials
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")

    # AI Models (OpenAI Whisper & Hugging Face Transformers BART/T5 as specified in PDF)
    AI_MODEL_WHISPER: str = os.getenv("AI_MODEL_WHISPER", "openai/whisper-small")
    AI_MODEL_SUMMARIZER: str = os.getenv("AI_MODEL_SUMMARIZER", "facebook/bart-large-cnn")
    WHISPER_MODEL: str = os.getenv("WHISPER_MODEL", "tiny.en")
    SUMMARIZATION_MODEL: str = os.getenv("SUMMARIZATION_MODEL", "sshleifer/distilbart-cnn-12-6")
    DEVICE: str = os.getenv("DEVICE", "auto")
    COMPUTE_TYPE: str = os.getenv("COMPUTE_TYPE", "int8")
    CPU_THREADS: int = int(os.getenv("CPU_THREADS", str(min(os.cpu_count() or 4, 8))))
    WHISPER_CLOUD_ENABLED: bool = os.getenv("WHISPER_CLOUD_ENABLED", "true").lower() in ("true", "1", "yes")
    
    # LLM Service (Groq / Ollama / Grok)
    GROK_API_KEY: str = os.getenv("GROK_API_KEY", os.getenv("GROQ_API_KEY", ""))
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", os.getenv("GROK_API_KEY", ""))
    GROK_MODEL: str = os.getenv("GROK_MODEL", os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"))
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", os.getenv("GROK_MODEL", "openai/gpt-oss-20b"))
    OLLAMA_URL: str = os.getenv("OLLAMA_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3")
    
    # Database — MongoDB (Primary), PostgreSQL (Optional backup), SQLite (Development)
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Analytics Zero-Baseline Initial State (Defaults to 0, switchable to live aggregation)
    ANALYTICS_ZERO_BASELINE: bool = os.getenv("ANALYTICS_ZERO_BASELINE", "true").lower() in ("true", "1", "yes")
    
    # MongoDB Configuration (Primary)
    MONGODB_URL: str = os.getenv(
        "MONGODB_URL",
        "mongodb://localhost:27017"
    )
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "clipmind_db")
    
    # PostgreSQL Configuration (Optional backup)
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "clipmind")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "clipmindpass")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "clipmind_db")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432")
    
    # SQLite (Development fallback)
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(BASE_DIR, 'clipmind.db')}"
    )
    
    # Uploads & Media Storage
    UPLOAD_DIR: str = os.path.join(BASE_DIR, "uploads")
    THUMBNAIL_DIR: str = os.path.join(BASE_DIR, "uploads", "thumbnails")
    EXPORTS_DIR: str = os.path.join(BASE_DIR, "uploads", "exports")

    def model_post_init(self, __context):
        super().model_post_init(__context)
        if not os.path.isabs(self.UPLOAD_DIR):
            self.UPLOAD_DIR = os.path.abspath(os.path.join(self.BASE_DIR, self.UPLOAD_DIR))
        if not os.path.isabs(self.THUMBNAIL_DIR):
            self.THUMBNAIL_DIR = os.path.abspath(os.path.join(self.BASE_DIR, self.THUMBNAIL_DIR))
        if not os.path.isabs(self.EXPORTS_DIR):
            self.EXPORTS_DIR = os.path.abspath(os.path.join(self.BASE_DIR, self.EXPORTS_DIR))
    
    # CORS Origins
    @property
    def CORS_ORIGINS(self) -> list[str]:
        cors_origins_str = os.getenv("CORS_ORIGINS", "")
        if cors_origins_str:
            return [origin.strip() for origin in cors_origins_str.split(",")]
        return [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        ]

settings = Settings()

# Ensure directories exist
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.THUMBNAIL_DIR, exist_ok=True)
os.makedirs(settings.EXPORTS_DIR, exist_ok=True)

def get_ffmpeg_bin() -> str:
    """Returns the verified path to ffmpeg binary (imageio_ffmpeg bundled or system)."""
    import shutil
    # Priority 1: imageio_ffmpeg bundled binary (always available after pip install)
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.exists(exe):
            bin_dir = os.path.dirname(exe)
            if bin_dir not in os.environ.get("PATH", ""):
                os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")
            return exe
    except Exception:
        pass
    # Priority 2: System ffmpeg on PATH
    sys_ffmpeg = shutil.which("ffmpeg")
    if sys_ffmpeg:
        return sys_ffmpeg
    return "ffmpeg"

# Initialize PATH with imageio_ffmpeg if needed
get_ffmpeg_bin()

