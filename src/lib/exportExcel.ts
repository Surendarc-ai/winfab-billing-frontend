import * as XLSX from "xlsx";

export function exportToExcel(
  rows: Record<string, string | number | boolean>[],
  filename: string,
  sheetName = "Sheet1"
) {
  if (!rows.length) {
    throw new Error("No data to export");
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeName = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, safeName);
}
