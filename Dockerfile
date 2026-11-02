# ==========================================
# PharmacyGuard — Production Multi-Stage Dockerfile
# ==========================================

# --- Stage 1: Build React 19 Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# --- Stage 2: Production Python Backend & Unified Server ---
FROM python:3.11-slim
WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

# Install dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy backend application
COPY backend/ ./backend/

# Copy compiled frontend from Stage 1 into frontend/dist
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 8000

WORKDIR /app/backend

# Initialize and seed database idempotently on boot, then start Uvicorn
CMD ["sh", "-c", "python -m app.core.init_db && python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]

