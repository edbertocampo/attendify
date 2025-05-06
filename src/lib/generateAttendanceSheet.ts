import * as XLSX from 'xlsx';

/**
 * Generates and triggers download of an attendance sheet in the requested format with borders.
 * Supports single date or multi-date (week/month/range) formats.
 * @param attendanceData Array of { studentName, status, date }
 * @param options { className, instructor, time, dates: string[] }
 */
export function generateAttendanceSheet(
  attendanceData: Array<{ studentName: string; status: string; date: string }>,
  options: { className: string; instructor: string; time: string; dates: string[] }
) {
  // Get unique students and dates
  const students = Array.from(new Set(attendanceData.map(r => r.studentName)));
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
  // Fill rows
  students.forEach(student => {
    const row = [student];
    dates.forEach(date => {
      const record = attendanceData.find(r => r.studentName === student && r.date === date);
      row.push(record ? record.status : '');
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

  // Download
  XLSX.writeFile(wb, `${options.className}-attendance-${options.time.replace(/\s+/g, '_')}.xlsx`);
}
