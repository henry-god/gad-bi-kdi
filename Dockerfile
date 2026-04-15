FROM node:20-alpine AS base

WORKDIR /app

# Install Khmer fonts
RUN apk add --no-cache font-noto font-noto-khmer

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Build frontend
RUN npm run build

EXPOSE 3000 4000

# Start both frontend + backend
CMD ["sh", "-c", "npm run api & npm start"]
