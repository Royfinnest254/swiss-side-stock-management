$source = "backend"
$dest = "production_temp_v18"
$zip = "SWISS_SIDE_PRODUCTION_V18.zip"

if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }

# Robocopy is more robust against file locks during copy
robocopy $source $dest /s /xd node_modules /njh /njs /ndl /nc /ns /r:0 /w:0

if (Test-Path $dest) {
    if (Test-Path $zip) { Remove-Item -Force $zip }
    try {
        Compress-Archive -Path "$dest\*" -DestinationPath $zip -Force
        Write-Host "SUCCESS: Production ZIP created: $zip"
        $size = (Get-Item $zip).Length / 1MB
        Write-Host "Size: $('{0:N2}' -f $size) MB"
        Remove-Item -Recurse -Force $dest
    } catch {
        Write-Host "ERROR: Compression failed: $_"
    }
} else {
    Write-Host "ERROR: Copy failed"
}
