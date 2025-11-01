FROM node:18-bullseye

# Required libs for Chromium
RUN apt-get update && apt-get install -y \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libpangocairo-1.0-0 \
  libxss1 \
  libgtk-3-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy source
COPY . .

# Build TypeScript (needs TypeScript from devDependencies)
RUN npm run build

# Install Playwright Chromium and dependencies
RUN npx playwright install chromium --with-deps

# Remove devDependencies to reduce image size (optional, keeps it smaller)
RUN npm ci --only=production && npm cache clean --force

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
