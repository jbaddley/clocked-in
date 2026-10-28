export function csvCell(text: string) {
  let value = text;
  if (value.length > 0 && "=+-@\t\r".includes(value[0])) {
    value = `'${value}`;
  }

  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function csvRow(cells: Array<string | number | null | undefined>) {
  return cells.map((cell) => csvCell(cell == null ? "" : String(cell))).join(",");
}

export function csvDocument(lines: string[]) {
  return lines.join("\n");
}
