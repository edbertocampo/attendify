# PowerShell script to test autoMarkAbsents API route locally
# To run: .\trigger-cron.ps1

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

Write-Host "Testing automatic absent marking API route..." -ForegroundColor Cyan

try {
    $headers = @{
        "Authorization" = "Bearer $CRON_SECRET"
    }
    
    # Display debug info
    Write-Host "Debug Info:" -ForegroundColor Yellow
    Write-Host "- Current time: $(Get-Date)" -ForegroundColor Yellow    Write-Host "- CRON_SECRET length: $($CRON_SECRET.Length) chars" -ForegroundColor Yellow
    Write-Host "- Day of week: $((Get-Date).DayOfWeek)" -ForegroundColor Yellow
    
    Write-Host "`nAttempting API call to http://localhost:3001/api/autoMarkAbsents..." -ForegroundColor Cyan
    
    # Use Invoke-WebRequest to call the API with increased timeout
    $response = Invoke-WebRequest -Uri "http://localhost:3001/api/autoMarkAbsents" -Method GET -Headers $headers -TimeoutSec 60
    
    Write-Host "API call successful! Status code: $($response.StatusCode)" -ForegroundColor Green
    
    # Parse and display JSON response
    $content = $response.Content | ConvertFrom-Json
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Output $content
    
    # Show detailed results
    if ($content.checkedSessions -eq 0) {
        Write-Host "`nNo eligible sessions found to process today." -ForegroundColor Yellow
        Write-Host "This could be because:" -ForegroundColor Yellow
        Write-Host "1. No classes have sessions scheduled for today ($(Get-Date).DayOfWeek)" -ForegroundColor Yellow
        Write-Host "2. No sessions have ended yet or they ended more than 30 minutes ago" -ForegroundColor Yellow
        Write-Host "3. Sessions exist but the timing conditions weren't met" -ForegroundColor Yellow
    }
    
    if ($content.markedAbsentCount -eq 0 -and $content.markedLateCount -eq 0 -and $content.checkedSessions -gt 0) {
        Write-Host "`nSessions were checked but no students were marked absent or late." -ForegroundColor Yellow
        Write-Host "This could be because all students already have attendance records for today." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Error calling API: $_" -ForegroundColor Red
    Write-Host "`nMake sure:" -ForegroundColor Red
    Write-Host "1. The Next.js development server is running (npm run dev)" -ForegroundColor Red
    Write-Host "2. Your CRON_SECRET in .env.local matches what the server expects" -ForegroundColor Red
    Write-Host "3. Firebase credentials are properly set up in .env.local" -ForegroundColor Red
}
