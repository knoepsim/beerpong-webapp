from fastapi import FastAPI

from app.core.exceptions import register_exception_handlers
from app.routers import auth, results, roles, teams, tournaments, users

app = FastAPI(
    title="Bierpong API",
    description="Backend API für die Bierpong-Turnier-App",
    version="0.1.0",
)

# Register global exception handler for consistent error responses
register_exception_handlers(app)

# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
app.include_router(tournaments.router)
app.include_router(roles.router)
app.include_router(results.router)


@app.get("/status", tags=["System"], summary="System Status")
def get_status():
    """Health-check endpoint."""
    return {"status": "online", "version": "0.1.0"}
