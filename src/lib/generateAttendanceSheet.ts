import * as XLSX from 'xlsx';

/**
 * Generates and triggers download of an attendance sheet in the requested format with borders.
 * Supports single date or multi-date (week/month/range) formats.
 * Lists all students alphabetically, regardless of whether they have attendance records.
 * @param attendanceData Array of { studentName, status, date }
 * @param options { className, instructor, time, dates: string[], allStudents?: string[] }
 */
export function generateAttendanceSheet(
  attendanceData: Array<{ studentName: string; status: string; date: string }>,
  options: { 
    className: string; 
    instructor: string; 
    time: string; 
    dates: string[];
    allStudents?: string[] // Optional list of all students to include regardless of attendance
  }
) {
  // Get all students to include in the sheet
  let students: string[];
  
  // If all students list was provided, use it; otherwise extract from attendance data
  if (options.allStudents && options.allStudents.length > 0) {
    students = options.allStudents.sort((a, b) => a.localeCompare(b)); // Ensure alphabetical order
  } else {
    // Legacy behavior: extract unique students from attendance data
    students = Array.from(new Set(attendanceData.map(r => r.studentName))).sort();
  }
  
  const dates = options.dates;

  // Prepare sheet data with new format
  const sheetData: any[][] = [];
  sheetData.push([`Classroom Name: `, options.className]);
  sheetData.push([`Instructor: `, options.instructor]);
  sheetData.push([`Time: `, options.time]);
  sheetData.push([]);
  sheetData.push([]);
  
  // Header row
  sheetData.push(['Student Name', ...dates]);
    // Fill rows for all students
  students.forEach(student => {
    const row = [student];
    dates.forEach(date => {
      const record = attendanceData.find(r => r.studentName === student && r.date === date);
      row.push((record && record.status) ? record.status : ''); // Empty cell if no record for that date or status is undefined
    });
    sheetData.push(row);
  });

  // Create worksheet and workbook
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Add borders to all cells
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cell_address]) continue;
      if (!ws[cell_address].s) ws[cell_address].s = {};
      ws[cell_address].s.border = {
        top: { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left: { style: 'thin', color: { rgb: '000000' } },
        right: { style: 'thin', color: { rgb: '000000' } },
      };
    }
  }

  // Set column widths for better appearance
  ws['!cols'] = [
    { wch: 25 }, // Student Name
    ...dates.map(() => ({ wch: 20 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  // Download - Use try-catch to handle potential errors
  try {
    XLSX.writeFile(wb, `${options.className}-attendance-${options.time.replace(/\s+/g, '_')}.xlsx`);
  } catch (error) {
    console.error("Error generating attendance sheet:", error);
    throw new Error("Failed to generate attendance sheet. Please try again.");
  }
}
