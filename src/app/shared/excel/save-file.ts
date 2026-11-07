/** Saves the data as a download named `fileName`. */
export function saveFile(document: Document, data: BlobPart, type: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // The download has started from the URL; let the browser free it afterwards.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
