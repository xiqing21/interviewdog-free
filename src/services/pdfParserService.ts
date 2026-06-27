/**
 * PdfParserService — 客户端 PDF 文本解析服务
 *
 * 使用 pdfjs-dist 在浏览器端解析 PDF 文件，提取纯文本内容。
 * 无需上传到任何服务器，完全本地处理。
 */

import * as pdfjsLib from 'pdfjs-dist';

// Use the worker shipped with the installed pdfjs-dist package so API and worker versions stay in sync.
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

/**
 * 从 File 对象解析 PDF 文本。
 * @param file - PDF 文件对象
 * @returns 提取的纯文本内容
 */
export async function parsePdf(file: File): Promise<string> {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('请上传 PDF 格式的文件。');
  }

  const arrayBuffer = await file.arrayBuffer();
  return parsePdfBuffer(arrayBuffer);
}

/**
 * 从 ArrayBuffer 解析 PDF 文本。
 * @param buffer - PDF 文件的 ArrayBuffer
 * @returns 提取的纯文本内容
 */
export async function parsePdfBuffer(buffer: ArrayBuffer): Promise<string> {
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const numPages = pdf.numPages;
  const pages: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => {
        if ('str' in item) return item.str;
        return '';
      })
      .join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n').trim();
}

/**
 * 从 Base64 字符串解析 PDF 文本。
 * @param base64 - Base64 编码的 PDF 数据（不含 data URI 前缀）
 */
export async function parsePdfBase64(base64: string): Promise<string> {
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return parsePdfBuffer(buffer);
}

/**
 * 检测文件是否为 PDF。
 */
export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * 最大可解析的 PDF 文件大小（10MB）。
 */
export const MAX_PDF_SIZE = 10 * 1024 * 1024;
