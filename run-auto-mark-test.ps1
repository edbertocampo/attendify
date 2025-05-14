# PowerShell script to test the autoMarkAbsents function with time simulation
# This script runs the Node.js test script with various options

# Check if necessary files exist
if (-not (Test-Path -Path "c:\Users\Edbert\attendify\test-auto-mark-function.js")) {
    Write-Host "Error: test-auto-mark-function.js not found" -ForegroundColor Red
    exit 1
}

# Display introduction
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Attendify Auto-Mark Test Script" -ForegroundColor Cyan 
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will test the autoMarkAbsents function with simulated time"
Write-Host "to verify that the auto-marking functionality is working correctly."
Write-Host ""
Write-Host "Options:"
Write-Host "1. Test with system time (use actual current time)"
Write-Host "2. Test with simulated time (5 minutes after session end for test class)"
Write-Host "3. Test with custom time"
Write-Host "4. Exit"
Write-Host ""

$choice = Read-Host "Enter your choice (1-4)"

if ($choice -eq "4") {
    Write-Host "Exiting..." -ForegroundColor Yellow
    exit 0
}

# Make sure the dev server is running
$serverCheckResult = $null
try {
    $serverCheckResult = Invoke-WebRequest -Uri "http://localhost:3000" -Method HEAD -TimeoutSec 2 -ErrorAction SilentlyContinue
} catch {
    $serverCheckResult = $null
}

if (-not $serverCheckResult -or $serverCheckResult.StatusCode -ne 200) {
    Write-Host "Warning: Local development server does not appear to be running." -ForegroundColor Yellow
    Write-Host "Make sure to start the server with 'npm run dev' before proceeding." -ForegroundColor Yellow
    
    $startServer = Read-Host "Do you want to start the server now? (y/n)"
    if ($startServer -eq "y") {
        Start-Process -FilePath "cmd.exe" -ArgumentList "/c cd c:\Users\Edbert\attendify && npm run dev" -NoNewWindow
        Write-Host "Starting server... Please wait 10 seconds for it to initialize." -ForegroundColor Cyan
        Start-Sleep -Seconds 10
    } else {
        $continue = Read-Host "Continue anyway? (y/n)"
        if ($continue -ne "y") {
            Write-Host "Exiting..." -ForegroundColor Yellow
            exit 0
        }
    }
}

# Install required npm package if needed
if (-not (Test-Path -Path "c:\Users\Edbert\attendify\node_modules\dotenv")) {
    Write-Host "Installing dotenv package..." -ForegroundColor Cyan
    Set-Location -Path "c:\Users\Edbert\attendify"
    npm install --no-save dotenv
}

# Prepare the command based on user choice
$command = "node test-auto-mark-function.js --debug"

switch ($choice) {
    "1" {
        # Use system time
        Write-Host "Testing with current system time..." -ForegroundColor Cyan
    }
    "2" {
        # Use simulated time (let the Node.js script handle it)
        Write-Host "Testing with simulated time (5 minutes after session end)..." -ForegroundColor Cyan
        # The script will automatically generate an appropriate time
    }
    "3" {
        # Use custom time
        Write-Host "Enter custom date and time in format YYYY-MM-DD HH:MM" -ForegroundColor Cyan
        $customDate = Read-Host "Date (YYYY-MM-DD)"
        $customTime = Read-Host "Time (HH:MM)"
        
        try {
            $dateTime = [DateTime]::ParseExact("$customDate $customTime", "yyyy-MM-dd HH:mm", $null)
            $isoDateTime = $dateTime.ToUniversalTime().ToString("o")
            $command += " --time `"$isoDateTime`""
            Write-Host "Using custom time: $isoDateTime" -ForegroundColor Cyan
        } catch {
            Write-Host "Invalid date/time format. Using current time instead." -ForegroundColor Yellow
        }
    }
}

# Run the command
Write-Host "`nRunning test..." -ForegroundColor Green
$originalLocation = Get-Location
Set-Location -Path "c:\Users\Edbert\attendify"
Write-Host "Command: $command" -ForegroundColor DarkCyan
try {
    $output = & node test-auto-mark-function.js --debug
    Write-Host $output
} catch {
    Write-Host "Error executing command: $_" -ForegroundColor Red
}
Set-Location -Path $originalLocation
