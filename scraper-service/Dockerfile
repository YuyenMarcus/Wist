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
ARG CACHE_BUST=2026-01-14-v3-force-rebuild
RUN echo "Cache bust: $CACHE_BUST"

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-8080}/health || exit 1

# Start Gunicorn with optimized settings
# -w 2: 2 workers (enough for scraping, saves RAM)
# --timeout 120: 2 min timeout for slow scrapes
# --keep-alive 5: Keep connections alive
CMD ["sh", "-c", "gunicorn -w 2 -b 0.0.0.0:${PORT:-8080} app:app --timeout 120 --keep-alive 5"]
