# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. "
        "Please configure it in your .env file before starting the application. "
        "Example: DATABASE_URL=postgresql://user:password@db:5432/grocery_management"
    )

engine = create_engine(
    DATABASE_URL,
    pool_size=10,          # Max persistent connections per worker
    max_overflow=20,       # Extra connections allowed under burst load
    pool_timeout=30,       # Seconds to wait for a connection before raising
    pool_pre_ping=True,    # Detect and discard stale connections automatically
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()