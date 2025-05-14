# PowerShell script to simulate Vercel cron job locally
# To run: .\monitor-cron.ps1

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

function Invoke-CronJob {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] Running auto mark absents cron job..." -ForegroundColor Cyan
    
    try {
        $headers = @{
            "Authorization" = "Bearer $CRON_SECRET"
        }
        
        # Use Invoke-WebRequest to call the API
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/autoMarkAbsents" -Method GET -Headers $headers
        
        Write-Host "[$timestamp] API call successful! Status code: $($response.StatusCode)" -ForegroundColor Green
        
        # Parse and display JSON response
        $content = $response.Content | ConvertFrom-Json
        Write-Host "[$timestamp] Response:" -ForegroundColor Cyan
        Write-Output $content
    }
    catch {
        Write-Host "[$timestamp] Error calling API: $_" -ForegroundColor Red
    }
}

Write-Host "Local development cron simulation started." -ForegroundColor Green
Write-Host "Auto mark absents job will run every 15 minutes." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop." -ForegroundColor Yellow

# Run once on startup
Invoke-CronJob

# Schedule to run every 15 minutes
$timer = New-Object System.Timers.Timer
$timer.Interval = 15 * 60 * 1000  # 15 minutes in milliseconds
$timer.AutoReset = $true

# Add the event handler
Register-ObjectEvent -InputObject $timer -EventName Elapsed -Action {
    Invoke-CronJob
} | Out-Null

# Start the timer
$timer.Start()

# Keep the script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
}
finally {
    # Ensure the timer is disposed when the script is terminated
    $timer.Stop()
    $timer.Dispose()
}
