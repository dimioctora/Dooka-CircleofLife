#!/bin/bash

# Circular of Life - VPS Deployment Script
# Run this from the project root directory

echo "🚀 Starting Deployment on VPS..."

# 1. Pull latest code
echo "📥 Pulling latest changes from GitHub..."
git pull origin main

# 2. Update Backend
echo "📦 Updating Backend..."
cd backend
npm install
npm run build
echo "⚙️ Applying Database Constraints..."
npx ts-node setup-db.ts
cd ..

# 3. Update Frontend
echo "🎨 Updating Frontend..."
cd frontend
npm install
npm run build
cd ..

# 4. Restart Services
echo "🔄 Restarting Backend Service (NestJS)..."
# Assuming PM2 is used as per common patterns, or adjust if using systemd
if command -v pm2 &> /dev/null
then
    pm2 restart circle-backend || pm2 start dist/main.js --name "circle-backend"
else
    echo "⚠️ PM2 not found. Please restart the backend service manually (e.g., node backend/dist/main.js)"
fi

echo "✅ Deployment completed successfully!"
