# Swiss Side Full Codebase Zip Script
$zip = "SwissSide_Full_Codebase_Backup_V35.zip"
$dest = "codebase_temp_v35"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "SWISS SIDE FULL CODEBASE BACKUP ZIP GENERATION" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

if (Test-Path $dest) { Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue }
if (Test-Path $zip) { Remove-Item -Force $zip -ErrorAction SilentlyContinue }

Write-Host "Copying codebase files (excluding node_modules, temp builds, and existing archives)..." -ForegroundColor Yellow

# Robocopy codebase files to temporary directory
robocopy . $dest /s /xd node_modules .git .github production_temp* codebase_temp* deploy_final deploy_v14 temp_deploy temp_patch temp_zip_check* FinalZIP NAMECHEAP_PRODUCTION_V13 STAGING_V17* SwissSide_Production_* /xf *.zip *.log build_error.txt build_log* /njh /njs /ndl /nc /ns /r:0 /w:0

if (Test-Path $dest) {
    Write-Host "Compressing codebase files into ZIP archive..." -ForegroundColor Yellow
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($dest, $zip)
        Write-Host "SUCCESS: Full codebase backup ZIP created successfully: $zip" -ForegroundColor Green
        $size = (Get-Item $zip).Length / 1MB
        Write-Host "Archive Size: $('{0:N2}' -f $size) MB" -ForegroundColor Green
        Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
    } catch {
        Write-Host "ERROR: Compression failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "ERROR: Robocopy copy failed" -ForegroundColor Red
}
