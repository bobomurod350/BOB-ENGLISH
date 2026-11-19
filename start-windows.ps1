$ErrorActionPreference = 'Stop'

Write-Host "EnglishTalk AI - Windows launcher" -ForegroundColor Yellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found. Install Node.js 22.13 or newer, then run this script again."
}

$nodeVersion = (node -p "process.versions.node").Trim()
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing project dependencies..." -ForegroundColor Cyan
  npm install
}

Write-Host "Starting Expo..." -ForegroundColor Green
npx expo start
