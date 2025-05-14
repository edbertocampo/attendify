# Automatic Cron Job for Attendance Marking
# This script sets up a scheduled task that runs every 15 minutes to trigger the attendance marking system

Write-Host "Setting up automatic attendance marking scheduler..." -ForegroundColor Cyan

# Define the path to the simple-trigger.ps1 script
$scriptPath = Join-Path $PSScriptRoot "simple-trigger.ps1"

# Ensure the path exists
if (-not (Test-Path $scriptPath)) {
    Write-Host "Error: Cannot find script at $scriptPath" -ForegroundColor Red
    exit 1
}

# Create a description for the task
$taskName = "AttendifyAutoAttendanceMark"
$taskDescription = "Runs the Attendify auto-attendance marking system every 5 minutes"

# Create the action to run the PowerShell script
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

# Define a trigger that runs every 5 minutes
# Using a large but finite duration (10 years) instead of TimeSpan::MaxValue
$tenYears = New-TimeSpan -Days (365 * 10)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration $tenYears

# Set the task settings
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

# Define the user context - runs whether user is logged in or not
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType S4U -RunLevel Highest

try {
    # Create or update the task
    $existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue    if ($existingTask) {
        # Update existing task
        Set-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal
        # Update description separately if supported
        try {
            $task = Get-ScheduledTask -TaskName $taskName
            $task.Description = $taskDescription
            $task | Set-ScheduledTask
        } catch {
            Write-Host "Note: Could not update task description, but task has been updated" -ForegroundColor Yellow
        }
        Write-Host "Updated existing scheduled task '$taskName'" -ForegroundColor Green
    } else {
        # Create new task
        try {
            Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description $taskDescription
        } catch {
            # Fallback if -Description is not supported
            Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal
            Write-Host "Note: Task created without description" -ForegroundColor Yellow
        }
        Write-Host "Created new scheduled task '$taskName'" -ForegroundColor Green
    }# Display task info
    Write-Host "`nScheduled Task Details:" -ForegroundColor Cyan
    Write-Host "Task Name: $taskName" -ForegroundColor White
    Write-Host "Frequency: Every 5 minutes" -ForegroundColor White
    Write-Host "Script: $scriptPath" -ForegroundColor White
    Write-Host "`nThe auto-attendance marking system will now run automatically every 15 minutes." -ForegroundColor Green
    Write-Host "You can view or modify this task in Task Scheduler." -ForegroundColor Yellow
} 
catch {
    Write-Host "Error creating scheduled task: $_" -ForegroundColor Red
    Write-Host "`nAlternatively, for servers or cloud environments, you can:" -ForegroundColor Yellow
    Write-Host "1. Use a cloud scheduler (e.g., Azure Functions, AWS Lambda with CloudWatch Events)" -ForegroundColor White
    Write-Host "2. Add a cron job in Linux systems: */15 * * * * /path/to/trigger-script.sh" -ForegroundColor White
}

Write-Host "`nTo test the system manually, run: .\simple-trigger.ps1" -ForegroundColor Cyan
