import * as XLSX from 'xlsx';

const excelData = [
  {
    'Employee Name': 'Test',
    'From Date': new Date('2026-04-01T00:00:00Z'),
    'To Date': new Date('2026-04-03T00:00:00Z')
  }
];

const worksheet = XLSX.utils.json_to_sheet(excelData, { cellDates: true });

// Iterate through cells and set format to 'dd-mm-yyyy'
for (let cellAddress in worksheet) {
  if (cellAddress[0] === '!') continue;
  const cell = worksheet[cellAddress];
  if (cell.t === 'd' || cell.v instanceof Date) {
    cell.z = 'dd-mm-yyyy';
  }
}

const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Approved Leaves");
XLSX.writeFile(workbook, 'test.xlsx');
console.log("Done");
