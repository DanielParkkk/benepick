$proj = $PSScriptRoot
$python = "C:\Users\dlfns\AppData\Local\Programs\Python\Python312\python.exe"
$projectChromaPath = Join-Path $proj "chroma_db"
$localChromaPath = Join-Path $env:LOCALAPPDATA "BenePick\chroma_db"
$isOneDriveProject = $proj -like "*OneDrive*"
$chromaPath = if ((Test-Path $projectChromaPath) -and -not $isOneDriveProject) { $projectChromaPath } else { $localChromaPath }

if (-not (Test-Path $python)) {
    throw "Python not found: $python"
}

Write-Host "Starting BenePick services..." -ForegroundColor Cyan

# 1. Ollama
$ollamaRunning = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if (-not $ollamaRunning) {
    Write-Host "[1/3] Starting Ollama..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama serve"
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/3] Ollama already running" -ForegroundColor Green
}

# 2. FastAPI backend
Write-Host "[2/3] Starting FastAPI on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$proj'; `$env:BENEPICK_CHROMA_PATH='$chromaPath'; `$env:BENEPICK_ENABLE_RERANKER='0'; `$env:BENEPICK_ENABLE_RAG_WARMUP='1'; `$env:RAG_TIMEOUT_SECONDS='30'; `$env:RAG_COLD_START_TIMEOUT_SECONDS='75'; `$env:RAG_COLD_START_GRACE_SECONDS='180'; `$env:RAG_COOLDOWN_SECONDS='15'; & '$python' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
Start-Sleep -Seconds 2

# 3. Next.js frontend
Write-Host "[3/3] Starting Next.js on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$proj\frontend'; npm run dev"

Write-Host ""
Write-Host "All services started." -ForegroundColor Green
Write-Host "Open: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop, close each PowerShell window." -ForegroundColor Gray
