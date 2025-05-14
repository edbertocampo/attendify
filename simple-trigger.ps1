# PowerShell script to test autoMarkAbsents API route locally
# To run: .\simple-trigger.ps1

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
    
    Write-Host "Debug Info:" -ForegroundColor Yellow
    Write-Host "- Current time: $(Get-Date)" -ForegroundColor Yellow
    Write-Host "- CRON_SECRET length: $($CRON_SECRET.Length) chars" -ForegroundColor Yellow
    Write-Host "- Day of week: $((Get-Date).DayOfWeek)" -ForegroundColor Yellow
      Write-Host "Attempting API call to http://localhost:3000/api/autoMarkAbsents..." -ForegroundColor Cyan
    
    $response = Invoke-WebRequest -Uri "http://localhost:3000/api/autoMarkAbsents" -Method GET -Headers $headers -TimeoutSec 60
    
    Write-Host "API call successful! Status code: $($response.StatusCode)" -ForegroundColor Green
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Output $content
}
catch {
    Write-Host "Error calling API: $_" -ForegroundColor Red
    Write-Host "Make sure:" -ForegroundColor Red
    Write-Host "1. The Next.js development server is running (npm run dev)" -ForegroundColor Red
    Write-Host "2. Your CRON_SECRET in .env.local matches what the server expects" -ForegroundColor Red
    Write-Host "3. Firebase credentials are properly set up in .env.local" -ForegroundColor Red
}
