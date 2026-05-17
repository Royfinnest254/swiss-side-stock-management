$source = "backend"
$dest = "production_temp_v21"
$zip = "SwissSide_Production_V21.zip"

if (Test-Path $dest) { Remove-Item -Recurse -Force $dest -ErrorAction SilentlyContinue }

# robocopy options: /s (recursive except empty), /xd (exclude directory node_modules)
robocopy $source $dest /s /xd node_modules /njh /njs /ndl /nc /ns /r:0 /w:0

# Remove any nested zip files to keep the payload clean and minimal
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
