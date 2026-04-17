# Use the official Puppeteer Docker image which has Chrome ready
FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to configure permissions and install packages safely
USER root

# Environment variables to skip chromium download and point to the installed chrome
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

WORKDIR /app

# Copy the package files
COPY package*.json ./

# Install the Node packages
RUN npm install

# Copy all the remaining files into the container
COPY . .

# Grant permissions to the internal user provided by the base image
RUN chown -R pptruser:pptruser /app

# Switch to the non-root user for security
USER pptruser

# Command to start the bot
CMD ["node", "index.js"]
