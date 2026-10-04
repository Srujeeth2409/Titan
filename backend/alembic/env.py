
import os
import sys
from pathlib import Path
from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import make_url
from dotenv import load_dotenv

# --------------------------------------------------
# Project paths
# --------------------------------------------------

BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parent
ENV_FILE = PROJECT_ROOT / ".env"

sys.path.insert(0, str(BACKEND_DIR))

# --------------------------------------------------
# Load environment variables from Titan/.env
# --------------------------------------------------

load_dotenv(ENV_FILE, override=False)

from app.core.config import Settings
from app.db.models import Base

# --------------------------------------------------
# Alembic configuration
# --------------------------------------------------

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# --------------------------------------------------
# Database URL
# --------------------------------------------------

settings = Settings(_env_file=ENV_FILE)

database_url = make_url(settings.postgres_dsn)

# Alembic runs from Windows, outside Docker.
# Docker publishes PostgreSQL on localhost:5433.
database_url = database_url.set(
    drivername="postgresql+psycopg",
    host="localhost",
    port=5433,
)

# --------------------------------------------------
# Offline migrations
# --------------------------------------------------

def run_migrations_offline() -> None:
    context.configure(
        url=database_url.render_as_string(hide_password=True),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


# --------------------------------------------------
# Online migrations
# --------------------------------------------------

def run_migrations_online() -> None:
    connectable = create_engine(
        database_url,
        poolclass=pool.NullPool,
    )

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                compare_type=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    finally:
        connectable.dispose()


# --------------------------------------------------
# Execute migrations
# --------------------------------------------------

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()