$ErrorActionPreference = "Stop"
$proj = $PSScriptRoot
$python = Join-Path $proj "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $python = "python"
}

$env:QWEN35_HF_MODEL = "Qwen/Qwen3.5-4B"
$env:QWEN35_LORA_ADAPTER = Join-Path $proj "outputs\benepick-qwen35-translation-lora-v2"
$env:QWEN35_LORA_HOST = "127.0.0.1"
$env:QWEN35_LORA_PORT = "8008"
$env:QWEN35_LORA_4BIT = "1"

Write-Host "Installing/checking fine-tuned model dependencies..." -ForegroundColor Cyan
& $python -m pip install -r (Join-Path $proj "requirements-finetuned.txt")

Write-Host "Starting Qwen3.5 v2 LoRA translation server on http://127.0.0.1:8008" -ForegroundColor Green
& $python (Join-Path $proj "fine_tuning\serve_translation_lora.py")
