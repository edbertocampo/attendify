# Simple Auto-Attendance Scheduler (Non-Admin version)
# This script sets up a scheduled task that runs every 15 minutes to trigger the attendance marking system

Write-Host "Setting up automatic attendance marking scheduler (User-level)..." -ForegroundColor Cyan

# Define the path to the simple-trigger.ps1 script
$scriptPath = Join-Path $PSScriptRoot "simple-trigger.ps1"

# Ensure the path exists
if (-not (Test-Path $scriptPath)) {
    Write-Host "Error: Cannot find script at $scriptPath" -ForegroundColor Red
    exit 1
}

# Task details
$taskName = "AttendifyAutoAttendanceMark"

# Create command for the scheduled task
$taskCommand = "PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

# Create the task using schtasks.exe (doesn't require admin rights for current user tasks)
$result = schtasks.exe /Create /TN $taskName /TR $taskCommand /SC MINUTE /MO 15 /F

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nScheduled task created successfully!" -ForegroundColor Green
    Write-Host "`nScheduled Task Details:" -ForegroundColor Cyan
    Write-Host "Task Name: $taskName" -ForegroundColor White
    Write-Host "Frequency: Every 15 minutes" -ForegroundColor White
    Write-Host "Script: $scriptPath" -ForegroundColor White
    Write-Host "`nThe auto-attendance marking system will now run automatically every 15 minutes." -ForegroundColor Green
    Write-Host "You can view or modify this task in Task Scheduler." -ForegroundColor Yellow
} 
else {
    Write-Host "Error creating scheduled task. Exit code: $LASTEXITCODE" -ForegroundColor Red
    Write-Host "Command output: $result" -ForegroundColor Red
    Write-Host "`nYou may need to run this script with administrator privileges." -ForegroundColor Yellow
    Write-Host "Alternatively, you can create the task manually in Task Scheduler." -ForegroundColor Yellow
}

Write-Host "`nTo test the system manually, run: .\simple-trigger.ps1" -ForegroundColor Cyan
