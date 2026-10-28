"use client";

import { jsPDF } from "jspdf";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import { Citation, Confidence } from "@/components/ask-box";

export interface ExportDocumentOptions {
  title: string;
  content: string;
  citations?: Citation[];
  confidence?: Confidence;
  model?: string;
  collection?: string;
  date?: string;
}

function cleanFilename(title: string, ext: string): string {
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return `${safe || "titan_document"}.${ext}`;
}

/**
 * Client-side PDF Generation with jsPDF
 */
export async function exportToPdf(options: ExportDocumentOptions): Promise<void> {
  const { title, content, citations, confidence, model = "Titan RAG", collection = "default", date = new Date().toLocaleDateString() } = options;
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 45;
  const maxLineWidth = pageWidth - margin * 2;

  let y = margin;

  // Header Bar
  doc.setFillColor(79, 70, 229);
  doc.rect(margin, y, maxLineWidth, 4, "F");
  y += 18;

  // Organization Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(79, 70, 229);
  doc.text("TITAN RAG WORKSTATION", margin, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${date} • Model: ${model} • Corpus: ${collection}`, pageWidth - margin, y, { align: "right" });
  y += 24;

  // Document Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(15, 23, 42);
  const titleLines = doc.splitTextToSize(title, maxLineWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 24 + 10;

  // Grounding badge line
  if (confidence?.composite !== undefined) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(22, 101, 52);
    doc.text(`✓ Grounded & Verified Synthesis (${Math.round(confidence.composite * 100)}% Confidence)`, margin, y);
    y += 16;
  }

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 20;

  // Process and print body paragraphs
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);

  const rawParagraphs = content.split("\n");

  for (const rawP of rawParagraphs) {
    const trimmed = rawP.trim();
    if (!trimmed) {
      y += 10;
      continue;
    }

    // Check page break
    if (y > pageHeight - margin - 60) {
      doc.addPage();
      y = margin + 20;
    }

    // Heading detect (e.g. **Heading** or ### Heading)
    if (trimmed.startsWith("### ") || trimmed.startsWith("## ")) {
      const headingText = trimmed.replace(/^#+\s*/, "");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      const hLines = doc.splitTextToSize(headingText, maxLineWidth);
      doc.text(hLines, margin, y);
      y += hLines.length * 16 + 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      continue;
    }

    // Bullet points
    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ") || /^\d+\.\s/.test(trimmed);
    const indent = isBullet ? 14 : 0;
    const cleanText = trimmed.replace(/\*\*(.*?)\*\*/g, "$1"); // remove markdown bold syntax for clean printing
    const lines = doc.splitTextToSize(cleanText, maxLineWidth - indent);

    doc.text(lines, margin + indent, y);
    y += lines.length * 16 + 4;
  }

  // Citations Section
  if (citations && citations.length > 0) {
    y += 16;
    if (y > pageHeight - margin - 90) {
      doc.addPage();
      y = margin + 20;
    }

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, maxLineWidth, citations.length * 20 + 35, 6, 6, "FD");

    y += 18;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(79, 70, 229);
    doc.text("VERIFIED SOURCE GROUNDING PASSAGES", margin + 12, y);
    y += 16;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    citations.forEach((c, idx) => {
      const citeStr = `[${c.index || idx + 1}] ${c.source} ${c.section ? `• ${c.section}` : ""} ${c.page ? `(Page ${c.page})` : ""}`;
      doc.text(citeStr, margin + 12, y);
      y += 16;
    });
  }

  // Add Page Numbers to all pages
  const totalPages = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Titan RAG Workstation • Confidential Enterprise Document • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: "center" }
    );
  }

  doc.save(cleanFilename(title, "pdf"));
}

/**
 * Client-side Word (.docx) Generation using `docx`
 */
export async function exportToDocx(options: ExportDocumentOptions): Promise<void> {
  const { title, content, citations, confidence, model = "Titan RAG", collection = "default", date = new Date().toLocaleDateString() } = options;

  const paragraphs: Paragraph[] = [
    // Header line
    new Paragraph({
      children: [
        new TextRun({
          text: "TITAN RAG WORKSTATION • ENTERPRISE SYNTHESIS",
          bold: true,
          size: 18,
          color: "4F46E5",
        }),
      ],
      spacing: { after: 120 },
    }),

    // Document Title
    new Paragraph({
      text: title,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
    }),

    // Metadata line
    new Paragraph({
      children: [
        new TextRun({
          text: `Generated on: ${date}   |   Model: ${model}   |   Corpus Collection: ${collection}`,
          italics: true,
          size: 18,
          color: "64748B",
        }),
      ],
      spacing: { after: 120 },
    }),
  ];

  if (confidence?.composite !== undefined) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Status: ✓ Grounded & Verified against Enterprise Knowledge Base (${Math.round(confidence.composite * 100)}% Confidence)`,
            bold: true,
            size: 18,
            color: "166534",
          }),
        ],
        spacing: { after: 240 },
      })
    );
  }

  // Parse markdown content into Word paragraphs
  const rawParagraphs = content.split("\n");

  for (const rawP of rawParagraphs) {
    const trimmed = rawP.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith("### ") || trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
      const headingText = trimmed.replace(/^#+\s*/, "");
      paragraphs.push(
        new Paragraph({
          text: headingText,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    const isBullet = trimmed.startsWith("- ") || trimmed.startsWith("* ");
    const isNumbered = /^\d+\.\s/.test(trimmed);

    // Parse bold text runs
    const cleanText = trimmed.replace(/^[-*]\s+|\d+\.\s+/, "");
    const parts = cleanText.split(/(\*\*.*?\*\*)/g);

    const runs: TextRun[] = parts.map((part) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return new TextRun({
          text: part.slice(2, -2),
          bold: true,
          size: 22,
          color: "0F172A",
        });
      }
      return new TextRun({
        text: part,
        size: 22,
        color: "1E293B",
      });
    });

    paragraphs.push(
      new Paragraph({
        children: runs,
        bullet: isBullet || isNumbered ? { level: 0 } : undefined,
        spacing: { after: 140 },
      })
    );
  }

  // Citations Section
  if (citations && citations.length > 0) {
    paragraphs.push(
      new Paragraph({
        text: "Verified Grounding Passages & Citations",
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 300, after: 140 },
      })
    );

    citations.forEach((c, idx) => {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `[${c.index || idx + 1}] ${c.source}`,
              bold: true,
              size: 20,
              color: "4F46E5",
            }),
            new TextRun({
              text: `  —  Section: ${c.section || "General"}${c.page ? ` (Page ${c.page})` : ""}\n`,
              size: 18,
              color: "475569",
            }),
            new TextRun({
              text: c.snippet ? `    "${c.snippet}"` : "",
              italics: true,
              size: 18,
              color: "64748B",
            }),
          ],
          spacing: { after: 100 },
        })
      );
    });
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = cleanFilename(title, "docx");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Detects whether a user prompt is asking to download or export as PDF or Word document.
 */
export function detectExportIntent(query: string): {
  isExport: boolean;
  format: "pdf" | "docx" | "both";
} {
  const q = query.toLowerCase().trim();

  const isPdf =
    q.includes("pdf") ||
    q.includes("download as pdf") ||
    q.includes("export as pdf") ||
    q.includes("save as pdf") ||
    q.includes("give my above response as a pdf") ||
    q.includes("convert to pdf");

  const isWord =
    q.includes("word") ||
    q.includes("docx") ||
    q.includes("doc format") ||
    q.includes("word document") ||
    q.includes("download as word") ||
    q.includes("export as word");

  if (isPdf && isWord) {
    return { isExport: true, format: "both" };
  }
  if (isPdf) {
    return { isExport: true, format: "pdf" };
  }
  if (isWord) {
    return { isExport: true, format: "docx" };
  }

  return { isExport: false, format: "pdf" };
}
