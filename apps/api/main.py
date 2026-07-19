from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn

app = FastAPI(
    title="Bierpong API", 
    description="Backend API für die Bierpong Webapp", 
    version="0.1.0"
)

class StatusResponse(BaseModel):
    status: str
    version: str
    environment: str

@app.get(
    "/status",
    response_model=StatusResponse,
    summary="System Status abrufen",
    description="Gibt den aktuellen Betriebsstatus der API, die Version und die Umgebung zurück.",
    tags=["System"]
)
def get_status():
    """
    Diese Route dient als erweiterter Health-Check.
    Sie wird in der Swagger UI (/docs) ausführlich dokumentiert,
    inklusive der Pydantic Response Models.
    """
    return StatusResponse(
        status="online",
        version="1.0.0",
        environment="development"
    )

def main():
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()
