#!/bin/bash

echo "Setting up AI Library Management System..."

# Backend setup
echo "Setting up backend..."
cd backend

python -m venv venv

source venv/bin/activate

pip install -r requirements.txt

python manage.py makemigrations
python manage.py migrate

echo "Creating Django superuser..."
python manage.py createsuperuser

cd ..

# Frontend setup
echo "Setting up frontend..."
cd frontend

npm install
npm run build

cd ..

# Data setup
echo "Creating data directories..."

mkdir -p data/sample_data
mkdir -p data/ai_models

echo "Setup complete!"