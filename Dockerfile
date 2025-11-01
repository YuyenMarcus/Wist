# --- Base image with Node & Playwright browsers ---
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

# --- Set working directory ---
WORKDIR /app

# --- Copy package files ---
COPY package*.json ./

# --- Install dependencies ---
# Note: Playwright browsers are already included in Microsoft's image at /ms-playwright
RUN npm install

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
