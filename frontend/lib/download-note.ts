import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import TurndownService from 'turndown';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { saveAs } from 'file-saver';

// Helper to sanitize note title for filename
export function sanitizeFilename(title: string): string {
  const sanitized = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'untitled-note';
}

// Trigger browser download via object URL
function triggerDownload(blob: Blob, filename: string) {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 1. Download as PDF
export async function downloadAsPDF(editorElement: HTMLElement, title: string) {
  const canvas = await html2canvas(editorElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    onclone: (clonedDoc: any) => {
      const style = clonedDoc.createElement('style');
      style.innerHTML = `
        /* Override color properties globally in the cloned document to avoid html2canvas oklch/lab parser crashes */
        * {
          background-color: transparent !important;
          color: #0f172a !important;
          border-color: #cbd5e1 !important;
          text-shadow: none !important;
          box-shadow: none !important;
          outline-color: transparent !important;
        }
        html, body {
          background-color: #ffffff !important;
        }
        .tiptap {
          background-color: #ffffff !important;
        }
        .tiptap p, .tiptap h1, .tiptap h2, .tiptap h3, .tiptap h4, .tiptap h5, .tiptap h6, .tiptap li {
          background-color: transparent !important;
        }
        .tiptap blockquote {
          background-color: transparent !important;
          border-left: 4px solid #cbd5e1 !important;
          color: #475569 !important;
        }
        .tiptap pre, .tiptap code {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }
        .tiptap mark {
          background-color: #fef08a !important;
          color: #0f172a !important;
        }
        .collab-cursor, .collab-cursor__label {
          display: none !important;
          opacity: 0 !important;
        }
      `;
      clonedDoc.head.appendChild(style);
    }
  } as any);
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgWidth = 210; // A4 width
  const pageHeight = 297; // A4 height
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }
  
  pdf.save(sanitizeFilename(title) + '.pdf');
}

// 2. Download as Markdown
export function downloadAsMarkdown(htmlContent: string, title: string) {
  const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
  });
  
  const markdown = turndownService.turndown(htmlContent);
  const fullText = `# ${title}\n\n${markdown}`;
  
  const blob = new Blob([fullText], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, sanitizeFilename(title) + '.md');
}

// 3. Download as Plain Text
export function downloadAsPlainText(textContent: string, title: string) {
  const underline = '='.repeat(title.length);
  const fullText = `${title}\n${underline}\n\n${textContent}`;
  
  const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, sanitizeFilename(title) + '.txt');
}

// Helper to map HTML nodes to docx elements
function parseHtmlToDocx(html: string): Paragraph[] {
  if (typeof window === 'undefined') return [];
  const parser = new DOMParser();
  const parsedDoc = parser.parseFromString(html, 'text/html');
  const body = parsedDoc.body;
  const paragraphs: Paragraph[] = [];

  body.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();

      if (tagName === 'p') {
        paragraphs.push(new Paragraph({ children: parseChildrenToRuns(el) }));
      } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        const headingLevel = tagName.toUpperCase() as any; // Heading1, Heading2, etc.
        paragraphs.push(new Paragraph({
          children: parseChildrenToRuns(el),
          heading: headingLevel,
          spacing: { before: 120, after: 60 },
        }));
      } else if (tagName === 'ul' || tagName === 'ol') {
        el.querySelectorAll('li').forEach((li) => {
          paragraphs.push(new Paragraph({
            children: parseChildrenToRuns(li),
            bullet: tagName === 'ul' ? { level: 0 } : undefined,
          }));
        });
      } else if (tagName === 'blockquote') {
        paragraphs.push(new Paragraph({
          children: parseChildrenToRuns(el),
          spacing: { before: 100, after: 100 },
          indent: { left: 240 },
        }));
      }
    }
  });

  return paragraphs;
}

function parseChildrenToRuns(element: HTMLElement): TextRun[] {
  const runs: TextRun[] = [];

  function traverse(node: Node, formatting: { bold?: boolean; italic?: boolean; underline?: boolean } = {}) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        runs.push(new TextRun({
          text,
          bold: formatting.bold,
          italics: formatting.italic,
          underline: formatting.underline ? {} : undefined,
        }));
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      const newFormatting = { ...formatting };

      if (tagName === 'strong' || tagName === 'b') {
        newFormatting.bold = true;
      } else if (tagName === 'em' || tagName === 'i') {
        newFormatting.italic = true;
      } else if (tagName === 'u') {
        newFormatting.underline = true;
      }

      el.childNodes.forEach((child) => traverse(child, newFormatting));
    }
  }

  element.childNodes.forEach((child) => traverse(child));
  return runs;
}

// 4. Download as DOCX
export async function downloadAsDOCX(htmlContent: string, title: string) {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: title,
            heading: 'Heading1',
            spacing: { after: 200 },
          }),
          ...parseHtmlToDocx(htmlContent),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, sanitizeFilename(title) + '.docx');
}
