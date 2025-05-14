# Full Auto Attendance Test Script
# This is a comprehensive test that creates a session ending soon 
# and then processes it for attendance

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

Write-Host "Running comprehensive auto-attendance test..." -ForegroundColor Cyan
Write-Host "This will create a test session and then mark attendance for it." -ForegroundColor Yellow
Write-Host "In a real scenario, you would need to wait 6+ minutes for the session to end, but for testing we'll simulate this." -ForegroundColor Yellow

# Get classroom ID to test with
$defaultClassroomId = "4emnQYv9NjIuyBKNQXC9" # Default to our test classroom
$classroomId = Read-Host "Enter classroom ID to test with (default: $defaultClassroomId)"

if ([string]::IsNullOrWhiteSpace($classroomId)) {
    $classroomId = $defaultClassroomId
}

Write-Host "Using classroom ID: $classroomId" -ForegroundColor Cyan

# Run the test script
node "$PSScriptRoot\full-attendance-test.js" "$classroomId"

Write-Host "`nTest complete!" -ForegroundColor Green
Write-Host "To run the actual API endpoint use: .\simple-trigger.ps1" -ForegroundColor Green
