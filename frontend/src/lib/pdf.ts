import { jsPDF } from "jspdf";

export function exportTextToPdf(title: string, content: string) {
  const document = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const margin = 48;
  const pageWidth = document.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = document.internal.pageSize.getHeight();

  document.setFont("helvetica", "bold");
  document.setFontSize(18);
  document.text(title, margin, margin);

  document.setFont("helvetica", "normal");
  document.setFontSize(11);

  const lines = document.splitTextToSize(content, pageWidth);
  let cursorY = margin + 28;

  lines.forEach((line: string) => {
    if (cursorY > pageHeight - margin) {
      document.addPage();
      cursorY = margin;
    }

    document.text(line, margin, cursorY);
    cursorY += 16;
  });

  document.save("nav-veiviser.pdf");
}
