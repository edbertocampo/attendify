# PowerShell script to test autoMarkAbsents API route locally with time simulation
# This allows testing specific time scenarios for the auto marking feature
# To run: .\test-with-time-override.ps1

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

$CRON_SECRET = $env:CRON_SECRET

if (-not $CRON_SECRET) {
    Write-Host "Error: CRON_SECRET not found in environment variables" -ForegroundColor Red
    exit 1
}

# Get the current time
$now = Get-Date
Write-Host "Current time: $($now.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Yellow
Write-Host "Day of week: $($now.DayOfWeek)" -ForegroundColor Yellow

# Ask if you want to override time
$useOverrideTime = Read-Host "Do you want to simulate a specific time? (y/n)"

$overrideTimestamp = $null
if ($useOverrideTime -eq "y") {
    # For our test classroom TIMING0541, session ends at 20:01
    # Let's simulate 5 minutes after end time
    $useDefaultOverride = Read-Host "Use default override (today, 5 minutes after session end for TIMING0541)? (y/n)"
    
    if ($useDefaultOverride -eq "y") {
        # TIMING0541 ends at 20:01, so simulate 20:06
        $overrideTime = $now.Date.AddHours(20).AddMinutes(6)
        Write-Host "Using simulated time: $($overrideTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
        # Convert to ISO format for API
        $overrideTimestamp = $overrideTime.ToString("yyyy-MM-ddTHH:mm:ss.fff") + "Z"
    } else {
        # Custom override
        $hour = Read-Host "Enter hour (24-hour format)"
        $minute = Read-Host "Enter minute"
        $overrideTime = $now.Date.AddHours([int]$hour).AddMinutes([int]$minute)
        Write-Host "Using simulated time: $($overrideTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor Cyan
        # Convert to ISO format for API
        $overrideTimestamp = $overrideTime.ToString("yyyy-MM-ddTHH:mm:ss.fff") + "Z"
    }
}

Write-Host "Testing automatic absent marking API route..." -ForegroundColor Cyan

try {
    $headers = @{
        "Authorization" = "Bearer $CRON_SECRET"
        "X-Debug-Mode" = "true"
    }
    
    # Add time override if specified
    if ($overrideTimestamp) {
        $headers["X-Time-Override"] = $overrideTimestamp
        Write-Host "Using time override: $overrideTimestamp" -ForegroundColor Magenta
    }
    
    Write-Host "Attempting API call to http://localhost:3000/api/autoMarkAbsents..." -ForegroundColor Cyan
    
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/autoMarkAbsents" -Method GET -Headers $headers
    
    Write-Host "API call successful! Status code: $($response.StatusCode)" -ForegroundColor Green
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host ($content | ConvertTo-Json -Depth 10)
    
    # Check if students were marked
    if ($content.markedAbsentCount -gt 0) {
        Write-Host "`nSUCCESS: $($content.markedAbsentCount) students were marked absent!" -ForegroundColor Green
    } else {
        Write-Host "`nNo students were marked absent. Check the debug information to understand why." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Error calling API: $_" -ForegroundColor Red
}
