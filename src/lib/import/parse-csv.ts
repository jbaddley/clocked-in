export const maxImportRows = 1000;

export function parseCsv(text: string) {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  function finishRow() {
    row.push(field);
    field = "";
    rows.push(row);
    row = [];
  }

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n" || char === "\r") {
      finishRow();
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      continue;
    }

    field += char;
  }

  if (quoted) {
    throw new Error("The CSV has an unterminated quote.");
  }

  if (field.length > 0 || row.length > 0) {
    finishRow();
  }

  const last = rows.at(-1);
  if ((source.endsWith("\n") || source.endsWith("\r")) && last?.length === 1 && last[0] === "") {
    rows.pop();
  }

  if (rows.length > maxImportRows + 1) {
    throw new Error("A CSV import can include at most 1000 rows.");
  }

  return rows;
}
