"""
Seed the database with the default admin user.

Usage:
    python -m scripts.seed_user

Idempotent — will not create a duplicate if the email already exists.
"""
import asyncio
import sys
import os

# Ensure the project root is on the path so app.* imports work
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from app.db.session import SessionLocal
from app.db.models import User
from app.core.security import hash_password


SEED_EMAIL = "srujeethvisinigiri@titan.com"
SEED_PASSWORD = "Mannat"


async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == SEED_EMAIL))
        existing = result.scalar_one_or_none()

        if existing:
            print(f"✓ User '{SEED_EMAIL}' already exists (id={existing.id})")
            return

        hashed = hash_password(SEED_PASSWORD)
        user = User(email=SEED_EMAIL, hashed_password=hashed)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"✓ Created user '{SEED_EMAIL}' (id={user.id})")


if __name__ == "__main__":
    asyncio.run(main())
