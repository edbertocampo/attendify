# Script to test with a specific date and time for Wednesday May 14, 2025 at 20:06

$envFile = Join-Path $PSScriptRoot ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#].*?)=(.*)') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $value = $value -replace '^"(.*)"$', '$1'
            $value = $value -replace "^'(.*)'$", '$1'
            Set-Item -Path "env:$key" -Value $value
        }
    }
    Write-Host "Loaded environment variables from .env.local" -ForegroundColor Green
}
else {
    Write-Host "Error: .env.local file not found" -ForegroundColor Red
    exit 1
}

$cronSecret = $env:CRON_SECRET
if (-not $cronSecret) {
    Write-Host "Error: CRON_SECRET not found in environment variables" -ForegroundColor Red
    exit 1
}

# Create a date for Wednesday, May 14, 2025
# Hard-code this date since we need the day to be Wednesday in UTC time
# Use a time after the TIMING0541 session end (20:01)
$testDateTime = [DateTime]::new(2025, 5, 14, 20, 6, 0, [DateTimeKind]::Utc)
$formattedDate = $testDateTime.ToString("yyyy-MM-ddTHH:mm:00.000") + "Z"

# Verify the day of the week in UTC
$dayOfWeek = $testDateTime.DayOfWeek
Write-Host "UTC Date: $formattedDate, Day: $dayOfWeek" -ForegroundColor Yellow
if ($dayOfWeek -ne "Wednesday") {
    Write-Host "Warning: The UTC date is not a Wednesday! Adjusting..." -ForegroundColor Red
    # Find the next Wednesday
    $daysToAdd = (3 - [int]$dayOfWeek + 7) % 7
    $testDateTime = $testDateTime.AddDays($daysToAdd)
    $formattedDate = $testDateTime.ToString("yyyy-MM-ddTHH:mm:00.000") + "Z"
    Write-Host "Adjusted UTC Date: $formattedDate, Day: $($testDateTime.DayOfWeek)" -ForegroundColor Green
}

Write-Host "Testing with simulated time: $formattedDate (Wednesday after session end)" -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $cronSecret"
    "X-Debug-Mode" = "true"
    "X-Time-Override" = $formattedDate
    "X-Day-Override" = "Wednesday"  # Force the day to be Wednesday
}
Write-Host "Using day override: Wednesday" -ForegroundColor Magenta

$baseUrl = "http://localhost:3000"
try {
    $testResponse = Invoke-WebRequest -Uri "http://localhost:3000" -Method HEAD -TimeoutSec 1 -ErrorAction SilentlyContinue
} catch {
    try {
        $testResponse2 = Invoke-WebRequest -Uri "http://localhost:3001" -Method HEAD -TimeoutSec 1 -ErrorAction SilentlyContinue
        $baseUrl = "http://localhost:3001" 
    } catch {
        Write-Host "Warning: Could not detect server on port 3000 or 3001" -ForegroundColor Yellow
    }
}

$apiUrl = "$baseUrl/api/autoMarkAbsents"
Write-Host "Making API call to: $apiUrl" -ForegroundColor Cyan
Write-Host "Using time override: $formattedDate" -ForegroundColor Magenta

try {
    $response = Invoke-WebRequest -Uri $apiUrl -Headers $headers
    Write-Host "Response status: $($response.StatusCode)" -ForegroundColor Green
    $content = $response.Content | ConvertFrom-Json
    Write-Host "Response:" -ForegroundColor Cyan
    $content | ConvertTo-Json -Depth 5 | Write-Host
    
    # Check if any students were marked
    if ($content.markedAbsentCount -gt 0) {
        Write-Host "`n✅ SUCCESS: Marked $($content.markedAbsentCount) students as absent!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ No students were marked as absent." -ForegroundColor Yellow
    }
} catch {
    Write-Host "Error calling API: $_" -ForegroundColor Red
}
