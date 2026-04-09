#!/bin/bash
# AngoTinder - Script de arranque local
# Inicia backend (Python) e frontend (React) em paralelo

echo "🇦🇴 Iniciando AngoTinder..."
echo ""

# Check Python
if ! command -v python &> /dev/null; then
    echo "❌ Python não encontrado. Instala Python 3.11+"
    exit 1
fi

# Check Node
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instala Node.js 18+"
    exit 1
fi

# Install backend dependencies
echo "📦 Instalando dependências do backend..."
cd backend
pip install -r requirements.txt -q
cd ..

# Install frontend dependencies
echo "📦 Instalando dependências do frontend..."
cd frontend
npm install --silent
cd ..

echo ""
echo "🚀 Iniciando servidores..."
echo "   Backend: http://localhost:3001"
echo "   Frontend: http://localhost:5173"
echo ""

# Start backend in background
cd backend && python -m uvicorn main:app --host 0.0.0.0 --port 3001 --reload &
BACKEND_PID=$!

# Start frontend
cd ../frontend && npm run dev &
FRONTEND_PID=$!

# Wait for both
wait $BACKEND_PID $FRONTEND_PID
