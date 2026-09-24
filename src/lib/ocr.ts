import { Category, guessCategory } from './categories';

export type ReceiptGuess = { title: string; amount: number | null; date: string | null; category: Category };

export async function readReceipt(file: File, progress: (value: number) => void) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng+tha', 1, {
    logger: message => { if (message.status === 'recognizing text') progress(Math.round(message.progress * 100)); },
  });
  try { return (await worker.recognize(file)).data.text; }
  finally { await worker.terminate(); }
}

function normalizeAmount(value: string) {
  const parsed = Number(value.replace(/,/g, '').replace(/[฿B]/gi, '').trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(text: string) {
  const match = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (!match) return null;
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  if (year > 2400) year -= 543;
  const month = Number(match[2]);
  const day = Number(match[1]);
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseReceipt(text: string): ReceiptGuess {
  const lines = text.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const totalPattern = /(?:grand\s*total|net\s*total|total|amount|ยอดสุทธิ|รวมทั้งสิ้น|ยอดรวม|สุทธิ)[^\d]{0,20}([\d,]+(?:\.\d{1,2})?)/i;
  const keywordAmounts = lines.map(line => line.match(totalPattern)?.[1]).filter((value): value is string => Boolean(value)).map(normalizeAmount).filter((value): value is number => value !== null);
  const allAmounts = [...text.matchAll(/(?:฿|THB|บาท)?\s*([\d,]+\.\d{2})\b/gi)].map(match => normalizeAmount(match[1])).filter((value): value is number => value !== null && value < 10_000_000);
  const amount = keywordAmounts.at(-1) ?? (allAmounts.length ? Math.max(...allAmounts) : null);
  const ignored = /tax|vat|receipt|ใบเสร็จ|โทร|tel|เลขที่|date|วันที่|cashier|thank|ขอบคุณ|www\.|total|รวม|สำนักงานใหญ่/i;
  const title = lines.find(line => line.length >= 2 && line.length <= 80 && !ignored.test(line) && !/^\d[\d\s/:.-]+$/.test(line)) || 'รายการจากใบเสร็จ';
  return { title, amount, date: parseDate(text), category: guessCategory(`${title}\n${text}`) };
}
