FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright and Chromium
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy application code
COPY . .

# Expose port (Railway will set PORT env var at runtime)
EXPOSE 8080

# Start Gunicorn (Railway sets PORT env var, but we need to use it in CMD)
CMD gunicorn -w 4 -b 0.0.0.0:${PORT:-8080} app:app --timeout 120
