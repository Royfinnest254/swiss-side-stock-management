$source = "backend"
$dest = "production_temp_v18"
$zip = "SWISS_SIDE_PRODUCTION_V18.zip"

if (Test-Path $dest) { Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue }

# Robocopy copy
robocopy $source $dest /s /xd node_modules /njh /njs /ndl /nc /ns /r:0 /w:0

# Ensure no nested zip files exist in public or other temp folders that balloon size
Get-ChildItem -Path $dest -Filter "*.zip" -Recurse | Remove-Item -Force -ErrorAction SilentlyContinue

if (Test-Path $dest) {
    if (Test-Path $zip) { Remove-Item -Force $zip -ErrorAction SilentlyContinue }
    try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        [System.IO.Compression.ZipFile]::CreateFromDirectory($dest, $zip)
        Write-Host "SUCCESS: Production ZIP created: $zip"
        $size = (Get-Item $zip).Length / 1MB
        Write-Host "Size: $('{0:N2}' -f $size) MB"
        Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue
    } catch {
        Write-Host "ERROR: Compression failed: $_"
    }
} else {
    Write-Host "ERROR: Copy failed"
}
