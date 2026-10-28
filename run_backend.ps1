# Project_R - Run Attendance Backend on Windows (PowerShell)
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

if (Test-Path ".\venv\Scripts\Activate.ps1") {
    & ".\venv\Scripts\Activate.ps1"
} elseif (Test-Path "..\venv\Scripts\Activate.ps1") {
    & "..\venv\Scripts\Activate.ps1"
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Starting FaceAttend Backend API on port 8000..." -ForegroundColor Cyan
Write-Host "Docs: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

& uvicorn api:app --host 127.0.0.1 --port 8000 --reload
