param(
    [string]$BaseUrl = "http://127.0.0.1:8000",
    [int]$Count = 5,
    [int]$PauseSeconds = 1
)

$ErrorActionPreference = "Stop"

function Get-P95([double[]]$values) {
    if (-not $values -or $values.Count -eq 0) {
        return 0
    }
    $sorted = $values | Sort-Object
    $idx = [Math]::Ceiling($sorted.Count * 0.95) - 1
    if ($idx -lt 0) { $idx = 0 }
    if ($idx -ge $sorted.Count) { $idx = $sorted.Count - 1 }
    return [Math]::Round([double]$sorted[$idx], 1)
}

Write-Host "RAG stability check start" -ForegroundColor Cyan
Write-Host "BaseUrl=$BaseUrl Count=$Count Pause=${PauseSeconds}s" -ForegroundColor Gray

try {
    $health = Invoke-RestMethod "$BaseUrl/health" -Method Get -TimeoutSec 5
    if ($health.status -ne "ok") {
        throw "Health check returned non-ok status."
    }
} catch {
    Write-Host "Backend is not ready at $BaseUrl" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

$payload = @{
    age = 27
    region_code = "Seoul"
    region_name = "Seoul"
    income_band = "MID_50_60"
    household_type = "SINGLE"
    employment_status = "UNEMPLOYED"
    housing_status = "MONTHLY_RENT"
    interest_tags = @("housing")
} | ConvertTo-Json -Depth 5

$rows = @()

for ($i = 1; $i -le $Count; $i++) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $status = "FAIL"
    $docs = 0
    $policies = 0
    $errorMsg = ""
    $fallbackLikely = $true

    try {
        $resp = Invoke-RestMethod "$BaseUrl/api/v1/eligibility/analyze" `
            -Method Post `
            -ContentType "application/json" `
            -Body $payload `
            -TimeoutSec 90

        if ($resp.success -eq $true) {
            $status = "OK"
            $docs = @($resp.data.rag_docs_used).Count
            $policies = @($resp.data.policies).Count
            $fallbackLikely = ($docs -eq 0)
        } else {
            $errorMsg = "success=false"
        }
    } catch {
        $errorMsg = $_.Exception.Message
    }

    $sw.Stop()
    $elapsed = [Math]::Round($sw.Elapsed.TotalMilliseconds, 1)

    $rows += [PSCustomObject]@{
        Try = $i
        Status = $status
        ElapsedMs = $elapsed
        RagDocs = $docs
        Policies = $policies
        FallbackLikely = $fallbackLikely
        Error = $errorMsg
    }

    Write-Host ("[{0}/{1}] {2} {3}ms docs={4} fallback={5}" -f $i, $Count, $status, $elapsed, $docs, $fallbackLikely)
    if ($PauseSeconds -gt 0 -and $i -lt $Count) {
        Start-Sleep -Seconds $PauseSeconds
    }
}

Write-Host ""
$rows | Format-Table -AutoSize

$okRows = @($rows | Where-Object { $_.Status -eq "OK" })
$elapsedAll = @($rows | ForEach-Object { [double]$_.ElapsedMs })
$elapsedOk = @($okRows | ForEach-Object { [double]$_.ElapsedMs })
$okRate = if ($Count -gt 0) { [Math]::Round(($okRows.Count / $Count) * 100, 1) } else { 0 }
$fallbackCount = @($rows | Where-Object { $_.FallbackLikely -eq $true }).Count

Write-Host ""
Write-Host "Summary" -ForegroundColor Cyan
Write-Host ("- success_rate: {0}% ({1}/{2})" -f $okRate, $okRows.Count, $Count)
Write-Host ("- avg_ms(all): {0}" -f ([Math]::Round((($elapsedAll | Measure-Object -Average).Average), 1)))
if ($elapsedOk.Count -gt 0) {
    Write-Host ("- p95_ms(ok): {0}" -f (Get-P95 $elapsedOk))
}
Write-Host ("- fallback_likely_count: {0}" -f $fallbackCount)
