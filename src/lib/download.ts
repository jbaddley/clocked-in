export function downloadBlob(filename: string, blob: Blob, type?: string) {
  const file = type && blob.type !== type ? new Blob([blob], { type }) : blob;
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadTextFile(filename: string, text: string, type = "text/csv;charset=utf-8") {
  downloadBlob(filename, new Blob([text], { type }));
}
