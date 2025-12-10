# --- Base image with Node & Playwright browsers ---
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

# --- Install Python 3 and pip ---
RUN apt-get update && \
    apt-get install -y python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

# --- Set working directory ---
WORKDIR /app

# --- Copy package files ---
COPY package*.json ./

# --- Install Node.js dependencies ---
# Note: Playwright browsers are already included in Microsoft's image at /ms-playwright
RUN npm install

# --- Copy Python requirements and install Scrapy ---
COPY requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# --- Copy app source ---
COPY . .

# --- Expose the port Next.js will use ---
EXPOSE 3000

# --- Set environment for production ---
ENV NODE_ENV=production
ENV PORT=3000
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# --- Build and start app ---
RUN npm run build
CMD ["npm", "start"]
