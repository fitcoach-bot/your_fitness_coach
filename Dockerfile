# Use the official Puppeteer Docker image which has Chrome ready
FROM ghcr.io/puppeteer/puppeteer:latest

# Switch to root to configure permissions and install packages safely
USER root
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
