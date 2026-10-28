# Project_R - Run HR Dashboard on Windows (PowerShell)
$ErrorActionPreference = "Stop"
Set-Location -Path "$PSScriptRoot\hr-dashboard"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Starting HR Dashboard Frontend on port 5173..." -ForegroundColor Cyan
Write-Host "App: http://localhost:5173" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

& npm.cmd run dev
