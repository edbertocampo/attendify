# PowerShell script to simplify auto-marking testing
# This combines the most common testing scenarios into a single script

# Display header
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  ATTENDIFY AUTO-MARK TESTING TOOL   " -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

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
    Write-Host "Error: .env.local file not found. Make sure CRON_SECRET is set in your environment." -ForegroundColor Red
    exit 1
}

# Check if server is running
$serverRunning = $false
try {
    $testPort3000 = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($testPort3000.StatusCode -eq 200) {
        $serverRunning = $true
        $port = 3000
    }
} catch {
    try {
        $testPort3001 = Invoke-WebRequest -Uri "http://localhost:3001" -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($testPort3001.StatusCode -eq 200) {
            $serverRunning = $true
            $port = 3001
        }
    } catch {
        $serverRunning = $false
    }
}

if (-not $serverRunning) {
    Write-Host "No development server detected on ports 3000 or 3001." -ForegroundColor Yellow
    $startServer = Read-Host "Would you like to start the development server? (y/n)"
    if ($startServer -eq 'y') {
        Write-Host "Starting development server..." -ForegroundColor Cyan
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd $PSScriptRoot && npm run dev" -NoNewWindow
        Write-Host "Waiting 15 seconds for server to start..." -ForegroundColor Yellow
        Start-Sleep -Seconds 15
        $port = 3000
    } else {
        Write-Host "Cannot proceed without a running server. Exiting." -ForegroundColor Red
        exit 1
    }
}

# Show testing options
Write-Host "`nAUTO-MARK TESTING OPTIONS:" -ForegroundColor Cyan
Write-Host "1. Test with current time (simple test)" -ForegroundColor White
Write-Host "2. Test with debug mode (detailed logs)" -ForegroundColor White
Write-Host "3. Test with time override (simulate specific time)" -ForegroundColor White
Write-Host "4. Test with extended debugging (maximum diagnostics)" -ForegroundColor White
Write-Host "5. Test specific classroom session" -ForegroundColor White
Write-Host "6. Create test classroom with timings" -ForegroundColor White
Write-Host "7. Exit" -ForegroundColor White

$choice = Read-Host "`nSelect an option (1-7)"

switch ($choice) {
    "1" {
        Write-Host "`nRunning simple test with current time..." -ForegroundColor Cyan
        & "$PSScriptRoot\simple-trigger.ps1"
    }
    "2" {
        Write-Host "`nRunning test with debug mode..." -ForegroundColor Cyan
        & "$PSScriptRoot\debug-trigger.ps1"
    }
    "3" {
        Write-Host "`nRunning test with time override..." -ForegroundColor Cyan
        & "$PSScriptRoot\test-with-time-override.ps1"
    }
    "4" {
        Write-Host "`nRunning test with extended debugging..." -ForegroundColor Cyan
        & "$PSScriptRoot\test-with-extended-debug.ps1"
    }
    "5" {
        Write-Host "`nRunning test for specific classroom session..." -ForegroundColor Cyan
        & "$PSScriptRoot\test-specific-session.ps1"
    }
    "6" {
        Write-Host "`nCreating test classroom with timing for auto-mark testing..." -ForegroundColor Cyan
        & "$PSScriptRoot\create-timing-test.ps1"
    }
    "7" {
        Write-Host "`nExiting..." -ForegroundColor Yellow
        exit 0
    }
    default {
        Write-Host "`nInvalid option. Exiting." -ForegroundColor Red
        exit 1
    }
}

# Show documentation reminder
Write-Host "`nFor more information on testing scripts, see TEST-SCRIPTS-GUIDE.md" -ForegroundColor Green
