# Test Auto-Attendance with Extended Debug
# This script will test the auto-attendance API with extended debug logging

Write-Host "Enabling detailed debug logging..." -ForegroundColor Cyan
Write-Host "This will add extra logging to help diagnose attendance issues" -ForegroundColor Yellow

@'
// Temporary script to update route.ts with extra debugging
const fs = require('fs');
const path = require('path');

// Path to the route.ts file
const routeFilePath = path.join(process.cwd(), 'src', 'app', 'api', 'autoMarkAbsents', 'route.ts');

// First, create a backup
const backupPath = `${routeFilePath}.debug-bak`;
fs.copyFileSync(routeFilePath, backupPath);
console.log(`Created backup of route.ts at ${backupPath}`);

// Read the file content
let content = fs.readFileSync(routeFilePath, 'utf8');

// Add extra debug console.log statements
const debugStatements = `
          // EXTENDED DEBUGGING
          console.log(\`[EXTENDED DEBUG] ===== PROCESSING STUDENT \${studentId} FOR ATTENDANCE =====\`);
          console.log(\`[EXTENDED DEBUG] Class: \${classCode}, Session: \${sessionDay} \${sessionEndTime}\`);
          console.log(\`[EXTENDED DEBUG] Subject: \${session.subject || 'None'}\`);
          console.log(\`[EXTENDED DEBUG] isAfterClassEnded: \${isAfterClassEnded}, isAfterGracePeriod: \${isAfterGracePeriod}\`);
          console.log(\`[EXTENDED DEBUG] Attendance query params: \`);
          console.log(\`[EXTENDED DEBUG]   - classCode: \${classCode}\`);
          console.log(\`[EXTENDED DEBUG]   - studentId: \${studentId}\`);
          console.log(\`[EXTENDED DEBUG]   - date range: \${sessionDateStart.toISOString()} to \${sessionDateEnd.toISOString()}\`);
          if (session.subject) {
            console.log(\`[EXTENDED DEBUG]   - subject: \${session.subject}\`);
          }
`;

// Find the insertion point - right before checking attendance
const insertionPoint = content.indexOf('const attendanceSnap = await attendanceQuery.get();');

if (insertionPoint !== -1) {
  // Insert the debug statements
  content = content.slice(0, insertionPoint) + debugStatements + content.slice(insertionPoint);
  
  // Add more debug after checking attendance
  const afterAttendanceCheck = content.indexOf('if (attendanceSnap.empty) {', insertionPoint);
  if (afterAttendanceCheck !== -1) {
    const moreDebug = `
            console.log(\`[EXTENDED DEBUG] Attendance records found: \${attendanceSnap.size}\`);
    `;
    content = content.slice(0, afterAttendanceCheck) + moreDebug + content.slice(afterAttendanceCheck);
  }
  
  // Write the modified content back to the file
  fs.writeFileSync(routeFilePath, content);
  console.log('Added extended debugging to route.ts');
} else {
  console.error('Could not find the right location to insert debug statements');
}
'@ | Out-File -FilePath "$PSScriptRoot\add-debug-logging.js" -Encoding utf8

# Run the script
node "$PSScriptRoot\add-debug-logging.js"

Write-Host "`nRunning the auto-attendance API with extended debugging..." -ForegroundColor Cyan
.\simple-trigger.ps1

Write-Host "`nTest complete! Don't forget to restore the original file when done debugging." -ForegroundColor Green
Write-Host "To restore: copy src\app\api\autoMarkAbsents\route.ts.debug-bak src\app\api\autoMarkAbsents\route.ts" -ForegroundColor Yellow
