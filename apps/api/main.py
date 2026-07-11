from fastapi import FastAPI
import uvicorn

app = FastAPI(title="Bierpong API")

@app.get("/")
def read_root():
    return {"message": "Hello from bierpong-api!"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

def main():
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    main()

