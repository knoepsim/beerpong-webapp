from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base class for all SQLAlchemy models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


# The session of a request, committed before the response is sent. With FastAPI's default scope ("request") the code
# after `yield` runs only after the response went out, so a client asking again right away (create a team, then load
# the list) could still read the old state.
# NOSONAR below: Sonar (python:S930) does not know the `scope` argument of Depends yet (FastAPI has it since 0.121)
DbSession = Annotated[AsyncSession, Depends(get_db, scope="function")]  # NOSONAR
