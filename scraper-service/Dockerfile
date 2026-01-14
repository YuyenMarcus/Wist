# Optimized Dockerfile for Wist Scraper Service
# Uses multi-stage build to reduce final image size
# Cache bust: 2026-01-14-v2

FROM python:3.11-slim AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# --- Final Stage ---
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies for Playwright/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Copy Python packages from builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Install Playwright browsers (Chromium only to save space)
RUN playwright install chromium --with-deps

# Force cache invalidation for COPY step
ARG CACHE_BUST=2026-01-14-v8-use-dockerfile-cmd
RUN echo "Cache bust: $CACHE_BUST"

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 8080

# No HEALTHCHECK here - let Railway handle it via railway.json
# This avoids startup issues with Docker's internal healthcheck

# Start Gunicorn with optimized settings
# -w 1: 1 worker (reduce startup time)
# --preload: Preload app before forking
# --timeout 120: 2 min timeout for slow scrapes
CMD ["sh", "-c", "gunicorn -w 1 -b 0.0.0.0:${PORT:-8080} app:app --timeout 120 --keep-alive 5 --log-level info"]
