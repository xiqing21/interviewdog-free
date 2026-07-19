/** Local OCR for screenshot questions. Screenshot pixels never leave the device. */
import { createWorker, PSM } from 'tesseract.js';

// chi_sim already includes the Latin characters commonly present in technical
// questions. Loading the separate eng pack in the browser worker can fail on
// some CDN/cache combinations, which otherwise makes the entire OCR fail.
const OCR_LANGUAGES = 'chi_sim';

export async function extractTextFromImage(imageBase64: string): Promise<string> {
  const worker = await createWorker(OCR_LANGUAGES);
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(`data:image/png;base64,${imageBase64}`);
    return data.text.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  } finally {
    await worker.terminate();
  }
}
