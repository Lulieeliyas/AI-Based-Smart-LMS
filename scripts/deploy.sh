#!/bin/bash

echo "Deploying AI Library Management System..."

echo "Pulling latest changes..."
git pull

echo "Stopping existing containers..."
docker compose down

echo "Building Docker images..."
docker compose build

echo "Starting containers..."
docker compose up -d

echo "Deployment complete!"

echo "Running containers:"
docker compose ps