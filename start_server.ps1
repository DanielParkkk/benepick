$proj = "C:\Users\dlfns\OneDrive\바탕 화면\final_project-develope"

Write-Host "BenePick 서버 시작 중..." -ForegroundColor Cyan

# 1. Ollama (이미 실행 중이면 스킵)
$ollamaRunning = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if (-not $ollamaRunning) {
    Write-Host "[1/4] Ollama 시작..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama serve"
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/4] Ollama 이미 실행 중 - 스킵" -ForegroundColor Green
}

# 2. ChromaDB
Write-Host "[2/4] ChromaDB 시작 (port 8001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "chroma run --path '$proj\chroma_db' --port 8001"
Start-Sleep -Seconds 3

# 3. FastAPI 백엔드
Write-Host "[3/4] FastAPI 백엔드 시작 (port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$proj'; & '$proj\venv\Scripts\uvicorn.exe' app.main:app --host 127.0.0.1 --port 8000 --reload"
Start-Sleep -Seconds 2

# 4. Next.js 프론트엔드
Write-Host "[4/4] Next.js 프론트엔드 시작 (port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$proj\frontend'; npm run dev"

Write-Host ""
Write-Host "모든 서버 시작 완료!" -ForegroundColor Green
Write-Host "접속 주소: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "종료하려면 각 PowerShell 창을 닫으세요." -ForegroundColor Gray
