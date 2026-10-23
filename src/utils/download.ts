/** Start a browser download and release its temporary URL after the click is handled. */
export function downloadText(name: string, contents: string, type: string) {
  const href = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
