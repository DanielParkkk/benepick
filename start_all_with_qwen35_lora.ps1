$ErrorActionPreference = "Stop"
$proj = $PSScriptRoot
$python = Join-Path $proj "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $python = "python"
}

$projectChromaPath = Join-Path $proj "chroma_db"
$localChromaPath = Join-Path $env:LOCALAPPDATA "BenePick\chroma_db"
$isOneDriveProject = $proj -like "*OneDrive*"
$chromaPath = if ((Test-Path $projectChromaPath) -and -not $isOneDriveProject) { $projectChromaPath } else { $localChromaPath }

Write-Host "Starting BenePick with Qwen3.5 v2 LoRA translation..." -ForegroundColor Cyan

Write-Host "[0/4] Installing/checking fine-tuned model dependencies..." -ForegroundColor Yellow
& $python -m pip install -r (Join-Path $proj "requirements-finetuned.txt")

$ollamaRunning = Get-Process -Name "ollama" -ErrorAction SilentlyContinue
if (-not $ollamaRunning) {
    Write-Host "[1/4] Starting Ollama..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "ollama serve"
    Start-Sleep -Seconds 3
} else {
    Write-Host "[1/4] Ollama already running" -ForegroundColor Green
}

Write-Host "[2/4] Starting Qwen3.5 v2 LoRA translation server on port 8008..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$proj'; `$env:QWEN35_HF_MODEL='Qwen/Qwen3.5-4B'; `$env:QWEN35_LORA_ADAPTER='outputs/benepick-qwen35-translation-lora-v2'; `$env:QWEN35_LORA_PORT='8008'; `$env:QWEN35_LORA_4BIT='1'; & '$python' fine_tuning\serve_translation_lora.py"
Start-Sleep -Seconds 8

Write-Host "[3/4] Starting FastAPI backend on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$proj'; `$env:FINE_TUNED_TRANSLATION_URL='http://127.0.0.1:8008'; `$env:FINE_TUNED_TRANSLATION_TIMEOUT='300'; `$env:BENEPICK_CHROMA_PATH='$chromaPath'; `$env:BENEPICK_ENABLE_RERANKER='0'; `$env:BENEPICK_ENABLE_RAG_WARMUP='1'; `$env:RAG_TIMEOUT_SECONDS='30'; `$env:RAG_COLD_START_TIMEOUT_SECONDS='75'; `$env:RAG_COLD_START_GRACE_SECONDS='180'; `$env:RAG_COOLDOWN_SECONDS='15'; & '$python' -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"
Start-Sleep -Seconds 2

Write-Host "[4/4] Starting Next.js frontend on port 3000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$proj\frontend'; npm install; npm run dev"

Write-Host ""
Write-Host "All services started." -ForegroundColor Green
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "LoRA health: http://127.0.0.1:8008/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "To stop, close each PowerShell window." -ForegroundColor Gray
