# Simple PowerShell script to test the autoMarkAbsents API
# Uses direct Invoke-WebRequest for simplicity

# Load environment variables from .env.local
$envFile = Join-Path $PSScriptRoot ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#].*?)=(.*)') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            # Remove any quotes from the value
            $value = $value -replace '^"(.*)"$', '$1'
            $value = $value -replace "^'(.*)'$", '$1'
            Set-Item -Path "env:$key" -Value $value
        }
    }
    Write-Host "Loaded environment variables from .env.local" -ForegroundColor Green
}
else {
    Write-Host "Warning: .env.local file not found. Make sure CRON_SECRET is set in your environment." -ForegroundColor Yellow
}

$cronSecret = $env:CRON_SECRET
if (-not $cronSecret) {
    Write-Host "Error: CRON_SECRET not found in environment variables" -ForegroundColor Red
    exit 1
}

# Get current date
$now = Get-Date
Write-Host "Current date/time: $($now.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Yellow

# Default test time: Wednesday at 20:06
$testDate = Get-Date
# Set to Wednesday (3) if not already
if ($testDate.DayOfWeek -ne "Wednesday") {
    # Calculate days to the next Wednesday
    $daysUntilWednesday = (3 - $testDate.DayOfWeek + 7) % 7
    $testDate = $testDate.AddDays($daysUntilWednesday)
}
# Set time to 8:06 PM (after the test class ends at 8:01 PM)
$testDate = $testDate.Date.AddHours(20).AddMinutes(6)
$testDateFormatted = $testDate.ToString("yyyy-MM-ddTHH:mm:00.000") + "Z"

Write-Host "`nTest Options:" -ForegroundColor Cyan
Write-Host "1. Test with actual current time" -ForegroundColor Cyan
Write-Host "2. Test with simulated time (next Wednesday at 20:06, after session end)" -ForegroundColor Cyan
Write-Host "3. Enter custom test time" -ForegroundColor Cyan
$option = Read-Host "Select option (1-3)"

$timeOverride = $null
switch ($option) {
    "1" {
        Write-Host "Using actual current time for test" -ForegroundColor Green
    }
    "2" {
        $timeOverride = $testDateFormatted
        Write-Host "Using simulated time: $timeOverride (Wednesday at 20:06)" -ForegroundColor Green
    }
    "3" {
        $customDate = Read-Host "Enter date (YYYY-MM-DD)"
        $customTime = Read-Host "Enter time (HH:MM)"
        try {
            $customDateTime = [DateTime]::ParseExact("$customDate $customTime", "yyyy-MM-dd HH:mm", $null)
            $timeOverride = $customDateTime.ToString("yyyy-MM-ddTHH:mm:00.000") + "Z"
            Write-Host "Using custom time: $timeOverride" -ForegroundColor Green
        } catch {
            Write-Host "Invalid date/time format. Using current time instead." -ForegroundColor Yellow
        }
    }
    default {
        Write-Host "Invalid option. Using current time." -ForegroundColor Yellow
    }
}

# Prepare headers
$headers = @{
    "Authorization" = "Bearer $cronSecret"
    "X-Debug-Mode" = "true"
}

# Add time override if specified
if ($timeOverride) {
    $headers["X-Time-Override"] = $timeOverride
    Write-Host "Using time override: $timeOverride" -ForegroundColor Magenta
}

# Base URL - detect if running on port 3000 or 3001
$baseUrl = "http://localhost:3000"
try {
    $testPort3000 = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($testPort3000.StatusCode -eq 200) {
        $baseUrl = "http://localhost:3000"
    }
} catch {
    try {
        $testPort3001 = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($testPort3001.StatusCode -eq 200) {
            $baseUrl = "http://localhost:3001"
        }
    } catch {
        Write-Host "Warning: Could not detect a running server on port 3000 or 3001" -ForegroundColor Yellow
        $continue = Read-Host "Continue anyway? (y/n)"
        if ($continue -ne "y") {
            exit 0
        }
    }
}

$apiUrl = "$baseUrl/api/autoMarkAbsents"
Write-Host "`nTesting API endpoint: $apiUrl" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $apiUrl -Headers $headers -Method GET
    
    Write-Host "`nResponse Status: $($response.StatusCode)" -ForegroundColor Green
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "Response Data:" -ForegroundColor Cyan
    $content | ConvertTo-Json -Depth 5 | Write-Host
    
    if ($content.markedAbsentCount -gt 0) {
        Write-Host "`n✅ SUCCESS: Marked $($content.markedAbsentCount) students as absent!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ No students were marked as absent." -ForegroundColor Yellow
        if ($content.debug) {
            Write-Host "Debug info:" -ForegroundColor Cyan
            $content.debug | ConvertTo-Json -Depth 3 | Write-Host
        }
    }
} catch {
    Write-Host "Error calling API: $_" -ForegroundColor Red
    Write-Host "Status Code: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody" -ForegroundColor Red
    }
}
