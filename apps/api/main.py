from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.exceptions import register_exception_handlers
from app.routers import auth, results, roles, teams, tournaments, users

app = FastAPI(
    title="Bierpong API",
    description="Backend API für die Bierpong-Turnier-App",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
