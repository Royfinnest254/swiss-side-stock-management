# Swiss Side Production V25 Build & Zip Script
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "SWISS SIDE MANAGEMENT SUITE V25 BUILD & PACKAGE" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Compile Frontend Assets
Write-Host "Building frontend assets..." -ForegroundColor Yellow
Push-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend compilation failed" -ForegroundColor Red
    Pop-Location
    Exit 1
}
Pop-Location

# 2. Sync built files to backend/public
Write-Host "Syncing built assets to backend/public..." -ForegroundColor Yellow
$frontendDist = "frontend/dist"
$backendPublic = "backend/public"

if (Test-Path $backendPublic) {
    Remove-Item -Recurse -Force "$backendPublic/*" -ErrorAction SilentlyContinue
} else {
    New-Item -ItemType Directory -Path $backendPublic -Force
}

robocopy $frontendDist $backendPublic /s /njh /njs /ndl /nc /ns /r:0 /w:0

# 3. Create production package
$source = "backend"
$dest = "production_temp_v25"
$zip = "SwissSide_Production_V25.zip"

Write-Host "Preparing production package directory..." -ForegroundColor Yellow
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue }

# Exclude node_modules during copy
robocopy $source $dest /s /xd node_modules /njh /njs /ndl /nc /ns /r:0 /w:0

# Ensure no nested zip files exist in public or other temp folders that balloon size
Get-ChildItem -Path $dest -Filter "*.zip" -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue

if (Test-Path $dest) {
    Write-Host "Compressing production bundle..." -ForegroundColor Yellow
    if (Test-Path $zip) { Remove-Item -Force $zip -ErrorAction SilentlyContinue }
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($dest, $zip)
        Write-Host "SUCCESS: V25 Production ZIP created successfully: $zip" -ForegroundColor Green
        $size = (Get-Item $zip).Length / 1MB
        Write-Host "Package Size: $('{0:N2}' -f $size) MB" -ForegroundColor Green
        Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
    } catch {
        Write-Host "ERROR: Compression failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "ERROR: Copy failed" -ForegroundColor Red
}
