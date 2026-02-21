FROM python:3.10-slim

WORKDIR /app

# Install CPU-only PyTorch first (saves ~1.5GB vs full torch)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
COPY ml-server/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ml-server/app/ ./app/

# Copy model artifacts
COPY model/artifacts.pt ./model/artifacts.pt

ENV ARTIFACTS_PATH=/app/model/artifacts.pt

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
