<#
setup-https-windows.ps1

Usage: run this in PowerShell (as your user) from the repo root or from the frontend folder.
It will try to locate your primary LAN IPv4 address, generate a mkcert certificate for
`localhost` and that IP, and write a `.env` file that CRA will pick up to serve HTTPS.

Prereqs:
- mkcert (https://github.com/FiloSottile/mkcert). Install via Chocolatey: choco install mkcert
- You may need to run PowerShell as Administrator for the mkcert -install step (to install the local CA).

This script DOES NOT install mkcert for you. It only automates certificate creation and .env generation.
#>

param(
  [string]$CertFolder = "certs",
  [string]$EnvFile = ".env"
)

function Write-ErrAndExit($msg) {
  Write-Host "ERROR: $msg" -ForegroundColor Red
  exit 1
}

Push-Location -Path (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent)

Write-Host "Setting up self-signed HTTPS for CRA (Windows)"

# find an IPv4 address that's not loopback or APIPA
$ip = Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
  Select-Object -First 1 -ExpandProperty IPAddress -ErrorAction SilentlyContinue

if (-not $ip) {
  # fallback: take any non-loopback IPv4
  $ip = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne '127.0.0.1' } | Select-Object -First 1 -ExpandProperty IPAddress -ErrorAction SilentlyContinue
}

if (-not $ip) {
  Write-ErrAndExit "Couldn't determine a LAN IPv4 address. Please specify one or ensure your machine is connected to a network."
}

Write-Host "Detected IP: $ip"

# check mkcert
if (-not (Get-Command mkcert -ErrorAction SilentlyContinue)) {
  Write-Host "mkcert not found in PATH. Install mkcert first."
  Write-Host "Install via Chocolatey (run PowerShell as Admin):"
  Write-Host "  choco install mkcert -y"
  Write-Host "Then run this script again."
  Pop-Location
  exit 1
}

if (-not (Test-Path $CertFolder)) {
  New-Item -ItemType Directory -Path $CertFolder | Out-Null
}

Push-Location $CertFolder

Write-Host "Installing local CA (mkcert -install) — you may be prompted to allow changes."
mkcert -install

$names = @("localhost", $ip)
$namesArg = $names -join " "

Write-Host "Generating certificate for: $namesArg"
mkcert $namesArg

# mkcert outputs files like: localhost+1.pem and localhost+1-key.pem or localhost+<ip>.pem
$pem = Get-ChildItem -Filter "localhost*.pem" | Sort-Object LastWriteTime | Select-Object -First 1
$key = Get-ChildItem -Filter "*-key.pem" | Sort-Object LastWriteTime | Select-Object -First 1

if (-not $pem -or -not $key) {
  Write-ErrAndExit "mkcert did not produce cert files in the expected format. Check mkcert output."
}

$certPath = (Resolve-Path $pem.FullName).Path
$keyPath = (Resolve-Path $key.FullName).Path

Write-Host "Created cert: $certPath"
Write-Host "Created key:  $keyPath"

Pop-Location

# Write .env in frontend folder (relative path)
$envContent = @()
$envContent += "HTTPS=true"
$envContent += "SSL_CRT_FILE=$CertFolder\$($pem.Name)"
$envContent += "SSL_KEY_FILE=$CertFolder\$($key.Name)"
$envContent += "REACT_APP_SOCKET_URL=https://$ip:4000"

Write-Host "Writing $EnvFile in frontend folder with the following values:"
$envContent | ForEach-Object { Write-Host "  $_" }

Set-Content -Path $EnvFile -Value $envContent -Force

Write-Host "Done. Restart your frontend dev server (npm start). Then open https://$ip:3000 on your phone (accept the certificate if prompted)."

Pop-Location
