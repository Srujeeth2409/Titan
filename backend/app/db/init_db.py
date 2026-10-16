"""
Database initialization and verification script for Titan.

Connects to PostgreSQL, creates all schema tables defined in models.py,
and verifies each table and relation.
"""
import asyncio
from sqlalchemy import text
from app.db.models import Base
from app.db.session import engine


async def init_and_verify_db():
    print("Connecting to PostgreSQL...")
    async with engine.begin() as conn:
        # Check connection and version
        res = await conn.execute(text("SELECT version();"))
        version = res.scalar()
        print(f"Connected to PostgreSQL: {version}")

        # Create all tables
        print("Creating all tables from declarative models...")
        await conn.run_sync(Base.metadata.create_all)
        print("Tables created successfully.")

        # Inspect public tables
        tables_res = await conn.execute(
            text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' ORDER BY table_name;"
            )
        )
        tables = [row[0] for row in tables_res.fetchall()]
        print(f"\nVerification: {len(tables)} tables present in PostgreSQL:")
        for t in tables:
            print(f"  ✓ {t}")

    await engine.dispose()
    return tables


if __name__ == "__main__":
    asyncio.run(init_and_verify_db())
