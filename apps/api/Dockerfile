# Use the official uv image as the base
FROM ghcr.io/astral-sh/uv:python3.12-alpine

WORKDIR /app

# Enable bytecode compilation for faster startup
ENV UV_COMPILE_BYTECODE=1

# Copy the requirements and lock file
COPY pyproject.toml uv.lock ./

# Install dependencies (without installing the project itself for caching)
RUN uv sync --frozen --no-install-project

# Copy the rest of the application
COPY . .

# Install the project
RUN uv sync --frozen

# Expose the API port
EXPOSE 8000

# Start the application using uv run
CMD ["uv", "run", "python", "main.py"]
