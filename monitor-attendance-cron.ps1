# Monitor Auto-Attendance Cron Job
# This script monitors the execution of the auto-attendance cron job

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
    Write-Host "Warning: .env.local file not found." -ForegroundColor Yellow
}

# Check if the task exists
$taskName = "AttendifyAutoAttendanceMark"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if (-not $task) {
    Write-Host "The scheduled task '$taskName' does not exist. Please run setup-auto-attendance-scheduler.ps1 first." -ForegroundColor Red
    exit 1
}

# Display task information
Write-Host "Monitoring Auto-Attendance Scheduled Task" -ForegroundColor Cyan
Write-Host "------------------------------------------" -ForegroundColor Cyan

Write-Host "`nTask Details:" -ForegroundColor Yellow
Write-Host "Name: $($task.TaskName)" -ForegroundColor White
Write-Host "State: $($task.State)" -ForegroundColor $(if ($task.State -eq "Ready") { "Green" } else { "Red" })
Write-Host "Last Run Time: $($task.LastRunTime)" -ForegroundColor White
Write-Host "Last Result: $($task.LastTaskResult)" -ForegroundColor $(if ($task.LastTaskResult -eq 0) { "Green" } else { "Red" })
Write-Host "Next Run Time: $($task.NextRunTime)" -ForegroundColor White

# Check task history
Write-Host "`nRecent Task History:" -ForegroundColor Yellow
try {
    $history = Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 10 | 
        Where-Object { $_.Message -like "*$taskName*" } | 
        Select-Object TimeCreated, Message
    
    if ($history) {
        foreach ($entry in $history) {
            $color = if ($entry.Message -like "*succeeded*") { "Green" } elseif ($entry.Message -like "*failed*") { "Red" } else { "White" }
            Write-Host "$($entry.TimeCreated) - $($entry.Message)" -ForegroundColor $color
        }
    } else {
        Write-Host "No recent history found." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Unable to retrieve task history: $_" -ForegroundColor Red
}

# Check if the server is running
Write-Host "`nChecking if the Next.js server is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001" -Method HEAD -TimeoutSec 5 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "Next.js server is running on port 3001." -ForegroundColor Green
    }
    else {
        Write-Host "Next.js server may be running, but returned status code $($response.StatusCode)." -ForegroundColor Yellow
    }
}
catch {
    Write-Host "Next.js server does not appear to be running on port 3001." -ForegroundColor Red
    Write-Host "The auto-attendance system requires the server to be running." -ForegroundColor Yellow
    Write-Host "Start the server with: npm run dev -- -p 3001" -ForegroundColor Cyan
}

# Display monitoring instructions
Write-Host "`nMonitoring Instructions:" -ForegroundColor Yellow
Write-Host "1. The scheduled task should run every 15 minutes." -ForegroundColor White
Write-Host "2. To view detailed logs, check the Next.js server console output." -ForegroundColor White
Write-Host "3. For troubleshooting, run the script manually: .\simple-trigger.ps1" -ForegroundColor White

Write-Host "`nIn a production environment, set up proper monitoring using:" -ForegroundColor Cyan
Write-Host "- Application logs aggregation (e.g., CloudWatch, Datadog, Grafana)" -ForegroundColor White
Write-Host "- Alerts for failed cron job executions" -ForegroundColor White
Write-Host "- Dashboard to track attendance marking statistics" -ForegroundColor White
