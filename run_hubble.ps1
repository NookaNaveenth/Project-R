# Project_R - Run Mock Hubble Microservice on Windows (PowerShell)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (Test-Path ".\venv\Scripts\Activate.ps1") {
    & ".\venv\Scripts\Activate.ps1"
} elseif (Test-Path "..\venv\Scripts\Activate.ps1") {
    & "..\venv\Scripts\Activate.ps1"
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Starting Mock Hubble Service on port 8001..." -ForegroundColor Cyan
Write-Host "Service: http://127.0.0.1:8001" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

& uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
