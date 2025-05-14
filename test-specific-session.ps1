# PowerShell script to test with the exact day and time for a specific class session

$envFile = Join-Path $PSScriptRoot ".env.local"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#].*?)=(.*)') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            $value = $value -replace '^"(.*)"$', '$1'
            $value = $value -replace "^'(.*)'$", '$1'
            Set-Item -Path "env:$key" -Value $value
        }
    }
    Write-Host "Loaded environment variables from .env.local" -ForegroundColor Green
} else {
    Write-Host "Error: .env.local file not found" -ForegroundColor Red
    exit 1
}

$cronSecret = $env:CRON_SECRET
if (-not $cronSecret) {
    Write-Host "Error: CRON_SECRET not found in environment variables" -ForegroundColor Red
    exit 1
}

# Step 1: Display all classrooms with sessions to choose from
Write-Host "`n=== Step 1: List All Available Classrooms and Sessions ===`n" -ForegroundColor Cyan

$headers = @{
    "Authorization" = "Bearer $cronSecret"
    "X-Debug-Mode" = "true"
}

$baseUrl = "http://localhost:3000"
try {
    $testResponse = Invoke-WebRequest -Uri "http://localhost:3000" -Method HEAD -TimeoutSec 1 -ErrorAction SilentlyContinue
} catch {
    try {
        $testResponse2 = Invoke-WebRequest -Uri "http://localhost:3001" -Method HEAD -TimeoutSec 1 -ErrorAction SilentlyContinue
        $baseUrl = "http://localhost:3001" 
    } catch {
        Write-Host "Warning: Could not detect server on port 3000 or 3001. Make sure your development server is running." -ForegroundColor Yellow
    }
}

$apiUrl = "$baseUrl/api/autoMarkAbsents"

try {
    Write-Host "Fetching classroom data from $apiUrl..." -ForegroundColor Yellow
    $response = Invoke-WebRequest -Uri $apiUrl -Headers $headers
    
    $content = $response.Content | ConvertFrom-Json
    
    if (-not $content.debug -or -not $content.debug.sessions) {
        Write-Host "Error: Debug information not available in API response." -ForegroundColor Red
        exit 1
    }
    
    # Display all classrooms and sessions
    Write-Host "Available classrooms and sessions:" -ForegroundColor Green
    $classroomSessions = @{}
    
    foreach ($classroom in $content.debug.sessions) {
        $classCode = $classroom.classCode
        $className = $classroom.name
        
        Write-Host "`nClassroom: $classCode - $className" -ForegroundColor White
        
        if ($classroom.sessions.Count -eq 0) {
            Write-Host "  No sessions defined" -ForegroundColor DarkGray
            continue
        }
        
        foreach ($session in $classroom.sessions) {
            $day = $session.day
            $startTime = $session.startTime
            $endTime = $session.endTime
            $subject = $session.subject
            
            Write-Host "  - Day: $day, Time: $startTime to $endTime, Subject: $subject" -ForegroundColor Cyan
            
            # Store session info in our dictionary
            if (-not $classroomSessions.ContainsKey($classCode)) {
                $classroomSessions[$classCode] = @()
            }
            
            $classroomSessions[$classCode] += @{
                ClassCode = $classCode
                ClassName = $className
                Day = $day
                StartTime = $startTime
                EndTime = $endTime
                Subject = $subject
            }
        }
    }
    
    # Step 2: Select a classroom and session to test
    Write-Host "`n=== Step 2: Select a Session to Test ===`n" -ForegroundColor Cyan
    
    $allSessions = @()
    $index = 0
    
    foreach ($classCode in $classroomSessions.Keys) {
        foreach ($session in $classroomSessions[$classCode]) {
            $index++
            $allSessions += $session
            
            $className = $session.ClassName
            $day = $session.Day
            $timeRange = "$($session.StartTime) - $($session.EndTime)"
            $subject = $session.Subject
            
            Write-Host "[$index] Class: $classCode ($className), Day: $day, Time: $timeRange, Subject: $subject" -ForegroundColor Yellow
        }
    }
    
    $selectedIndex = Read-Host "`nEnter the number of the session to test (1-$index)"
    $selectedIndex = [int]$selectedIndex - 1
    
    if ($selectedIndex -lt 0 -or $selectedIndex -ge $allSessions.Count) {
        Write-Host "Invalid selection. Please enter a number between 1 and $index." -ForegroundColor Red
        exit 1
    }
    
    $selectedSession = $allSessions[$selectedIndex]
    
    # Step 3: Set up the test time (5 minutes after the selected session's end time)
    Write-Host "`n=== Step 3: Setting Up Test Parameters ===`n" -ForegroundColor Cyan
    
    $selectedDay = $selectedSession.Day
    $selectedEndTime = $selectedSession.EndTime
    
    Write-Host "Selected session: $($selectedSession.ClassCode) - $($selectedSession.ClassName)" -ForegroundColor Green
    Write-Host "Day: $selectedDay, End time: $selectedEndTime" -ForegroundColor Green
    
    # Parse the end time
    $timeParts = $selectedEndTime -split ":"
    $endHour = [int]$timeParts[0]
    $endMinute = [int]$timeParts[1]
    
    # Current date
    $now = Get-Date
    
    # Create a date time for the test (5 minutes after session end)
    $testDate = $now.Date.AddHours($endHour).AddMinutes($endMinute + 5)
    $formattedDate = $testDate.ToString("yyyy-MM-ddTHH:mm:00.000") + "Z"
    
    Write-Host "Created test time: $formattedDate (5 minutes after session end)" -ForegroundColor Green
    
    # Step 4: Run the test
    Write-Host "`n=== Step 4: Running the Test ===`n" -ForegroundColor Cyan
    
    $testHeaders = @{
        "Authorization" = "Bearer $cronSecret"
        "X-Debug-Mode" = "true"
        "X-Time-Override" = $formattedDate
        "X-Day-Override" = $selectedDay  # Force the day to be the selected day
    }
    
    Write-Host "Making API call to: $apiUrl" -ForegroundColor Yellow
    Write-Host "Using time override: $formattedDate" -ForegroundColor Yellow
    Write-Host "Using day override: $selectedDay" -ForegroundColor Yellow
    
    $testResponse = Invoke-WebRequest -Uri $apiUrl -Headers $testHeaders
    
    Write-Host "`nResponse status: $($testResponse.StatusCode)" -ForegroundColor Green
    
    $testContent = $testResponse.Content | ConvertFrom-Json
    
    Write-Host "Response summary:" -ForegroundColor Cyan
    Write-Host "- Success: $($testContent.success)" -ForegroundColor White
    Write-Host "- Checked sessions: $($testContent.checkedSessions)" -ForegroundColor White
    Write-Host "- Marked absent count: $($testContent.markedAbsentCount)" -ForegroundColor White
    
    if ($testContent.markedAbsentCount -gt 0) {
        Write-Host "`n✅ SUCCESS: Marked $($testContent.markedAbsentCount) students as absent!" -ForegroundColor Green
    } else {
        Write-Host "`n⚠️ No students were marked as absent." -ForegroundColor Yellow
        
        # Show more details from debug info if available
        if ($testContent.debug) {
            Write-Host "`nDebug details:" -ForegroundColor Cyan
            Write-Host "- Time: $($testContent.debug.time)" -ForegroundColor Gray
            Write-Host "- Day: $($testContent.debug.today)" -ForegroundColor Gray
            Write-Host "- Server timezone: $($testContent.debug.serverTimezone)" -ForegroundColor Gray
            
            # Find our specific classroom in the debug info
            $ourClassroom = $testContent.debug.sessions | Where-Object { $_.classCode -eq $selectedSession.ClassCode }
            if ($ourClassroom) {
                Write-Host "`nSelected classroom debug info:" -ForegroundColor Cyan
                Write-Host "- Class: $($ourClassroom.classCode) - $($ourClassroom.name)" -ForegroundColor White
                Write-Host "- Sessions found: $($ourClassroom.sessionCount)" -ForegroundColor White
                
                foreach ($debugSession in $ourClassroom.sessions) {
                    Write-Host "  - Day: $($debugSession.day), StartTime: $($debugSession.startTime), EndTime: $($debugSession.endTime)" -ForegroundColor White
                }
            }
        }
    }
    
    # Display full response for detailed debugging
    $showFullResponse = Read-Host "`nShow full response? (y/n)"
    if ($showFullResponse -eq "y") {
        Write-Host "`nFull response:" -ForegroundColor Cyan
        $testContent | ConvertTo-Json -Depth 5 | Write-Host
    }
    
} catch {
    Write-Host "Error calling API: $_" -ForegroundColor Red
}
