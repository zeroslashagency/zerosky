/**
 * CSV export utilities with proper escaping.
 */

/**
 * Escapes a field value for CSV output.
 * - Wraps in quotes if the value contains comma, quote, or newline
 * - Doubles any quotes inside the value
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // Check if we need to quote this field
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    // Escape quotes by doubling them, then wrap the whole thing in quotes
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Converts an array of objects to CSV string.
 * 
 * @param data Array of objects to export
 * @param headers Optional header names (defaults to object keys)
 * @returns CSV string with headers and data
 */
export function objectArrayToCsv<T extends Record<string, unknown>>(
  data: T[],
  headers?: string[]
): string {
  if (data.length === 0) {
    return '';
  }
  
  const keys = headers ?? Object.keys(data[0]);
  const headerRow = keys.map(escapeCsvField).join(',');
  
  const dataRows = data.map(row =>
    keys.map(key => escapeCsvField(row[key])).join(',')
  );
  
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Triggers a browser download of CSV data.
 * 
 * @param csvContent The CSV string to download
 * @param filename Name of the file to download
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}
