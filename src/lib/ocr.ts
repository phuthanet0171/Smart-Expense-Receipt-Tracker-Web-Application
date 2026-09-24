import { Category, guessCategory } from './categories';

export type AmountCandidate = { amount: number; label: string; score: number; source: string };
export type DateCandidate = { date: string; label: string; score: number; raw: string };
export type Confidence = 'high' | 'medium' | 'low';
export type ReceiptItemGuess = { name: string; quantity: number; unitPrice: number | null; total: number; confidence: number };
export type ImageQuality = {
  level: 'good' | 'warning' | 'poor';
  score: number;
  brightness: number;
  contrast: number;
  sharpness: number;
  width: number;
  height: number;
  warnings: string[];
};
export type ReceiptDetailsGuess = {
  receiptNumber: string;
  taxId: string;
  branch: string;
  transactionTime: string;
  subtotal: number | null;
  discount: number | null;
  tax: number | null;
  paymentMethod: string;
  items: ReceiptItemGuess[];
};
export type ReceiptGuess = {
  title: string;
  titleConfidence: Confidence;
  amount: number | null;
  date: string | null;
  dateCandidates: DateCandidate[];
  dateConfidence: Confidence;
  category: Category;
  amountCandidates: AmountCandidate[];
  confidence: Confidence;
  details: ReceiptDetailsGuess;
  fieldConfidence: Record<string, number>;
};

const thaiDigits: Record<string, string> = {
  '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
  '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9',
};

function normalizeDigits(value: string) {
  return value.replace(/[๐-๙]/g, digit => thaiDigits[digit]);
}

function measureImageQuality(image: ImageData, sourceWidth: number, sourceHeight: number): ImageQuality {
  const values = new Float32Array(image.width * image.height);
  let sum = 0;
  let sumSquares = 0;
  for (let pixel = 0, index = 0; index < image.data.length; index += 4, pixel++) {
    const gray = image.data[index] * .299 + image.data[index + 1] * .587 + image.data[index + 2] * .114;
    values[pixel] = gray;
    sum += gray;
    sumSquares += gray * gray;
  }
  const brightness = sum / values.length;
  const contrast = Math.sqrt(Math.max(0, sumSquares / values.length - brightness * brightness));
  let edgeSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < image.height - 1; y += 2) {
    for (let x = 1; x < image.width - 1; x += 2) {
      const index = y * image.width + x;
      edgeSum += Math.abs(values[index - image.width] + values[index + image.width] + values[index - 1] + values[index + 1] - 4 * values[index]);
      edgeCount++;
    }
  }
  const sharpness = edgeCount ? edgeSum / edgeCount : 0;
  const warnings: string[] = [];
  let score = 100;
  if (Math.min(sourceWidth, sourceHeight) < 700) { warnings.push('ความละเอียดภาพต่ำ อาจอ่านข้อความขนาดเล็กไม่ครบ'); score -= 28; }
  if (brightness < 65) { warnings.push('ภาพมืดเกินไป ควรถ่ายในที่สว่างขึ้น'); score -= 24; }
  if (brightness > 238) { warnings.push('ภาพสว่างหรือมีแสงสะท้อนมากเกินไป'); score -= 22; }
  if (contrast < 32) { warnings.push('ตัวอักษรกับพื้นกระดาษมีความต่างน้อย'); score -= 22; }
  if (sharpness < 9) { warnings.push('ภาพอาจเบลอ กรุณาถือกล้องให้นิ่ง'); score -= 30; }
  score = Math.max(0, score);
  return { level: score >= 78 ? 'good' : score >= 48 ? 'warning' : 'poor', score, brightness: Math.round(brightness), contrast: Math.round(contrast), sharpness: Math.round(sharpness * 10) / 10, width: sourceWidth, height: sourceHeight, warnings };
}

async function prepareReceiptImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const targetWidth = Math.min(2200, Math.max(1600, bitmap.width));
  const scale = Math.min(targetWidth / bitmap.width, 3600 / bitmap.height);
  const border = 28;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale) + border * 2;
  canvas.height = Math.round(bitmap.height * scale) + border * 2;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('ไม่สามารถเตรียมรูปภาพได้');

  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, border, border, canvas.width - border * 2, canvas.height - border * 2);
  const qualityCanvas = document.createElement('canvas');
  const qualityScale = Math.min(1, 520 / Math.max(bitmap.width, bitmap.height));
  qualityCanvas.width = Math.max(1, Math.round(bitmap.width * qualityScale));
  qualityCanvas.height = Math.max(1, Math.round(bitmap.height * qualityScale));
  const qualityContext = qualityCanvas.getContext('2d', { willReadFrequently: true });
  if (!qualityContext) throw new Error('ไม่สามารถตรวจคุณภาพรูปภาพได้');
  qualityContext.drawImage(bitmap, 0, 0, qualityCanvas.width, qualityCanvas.height);
  const quality = measureImageQuality(qualityContext.getImageData(0, 0, qualityCanvas.width, qualityCanvas.height), bitmap.width, bitmap.height);
  bitmap.close();

  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  const histogram = new Uint32Array(256);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = Math.round(image.data[index] * .299 + image.data[index + 1] * .587 + image.data[index + 2] * .114);
    histogram[gray]++;
  }
  const pixels = canvas.width * canvas.height;
  const percentile = (ratio: number) => {
    let seen = 0;
    for (let value = 0; value < histogram.length; value++) {
      seen += histogram[value];
      if (seen >= pixels * ratio) return value;
    }
    return 255;
  };
  const low = percentile(.03);
  const high = Math.max(low + 40, percentile(.97));
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * .299 + image.data[index + 1] * .587 + image.data[index + 2] * .114;
    const leveled = Math.max(0, Math.min(255, ((gray - low) / (high - low)) * 255));
    const contrasted = Math.max(0, Math.min(255, (leveled - 128) * 1.18 + 134));
    image.data[index] = contrasted;
    image.data[index + 1] = contrasted;
    image.data[index + 2] = contrasted;
  }
  context.putImageData(image, 0, 0);
  return { canvas, quality };
}

function cropReceiptRegion(source: HTMLCanvasElement, startRatio: number, endRatio: number) {
  const canvas = document.createElement('canvas');
  const startY = Math.round(source.height * startRatio);
  const endY = Math.round(source.height * endRatio);
  canvas.width = source.width;
  canvas.height = endY - startY;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('ไม่สามารถเตรียมพื้นที่ยอดเงินได้');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, startY, source.width, canvas.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function readReceipt(file: File, progress: (value: number) => void) {
  progress(2);
  const prepared = await prepareReceiptImage(file);
  const image = prepared.canvas;
  progress(7);
  const { createWorker, PSM } = await import('tesseract.js');
  let pass = 0;
  let retryCount = 1;
  const worker = await createWorker('eng+tha', 1, {
    logger: message => {
      if (message.status !== 'recognizing text') return;
      const value = pass === 0 ? 8 + message.progress * 66 : 74 + ((pass - 1 + message.progress) / retryCount) * 26;
      progress(Math.min(100, Math.round(value)));
    },
  });
  try {
    await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    const primary = (await worker.recognize(image, { rotateAuto: true })).data.text;
    const primaryGuess = parseReceipt(primary);
    const retryRegions: HTMLCanvasElement[] = [];
    if (primaryGuess.titleConfidence === 'low') retryRegions.push(cropReceiptRegion(image, 0, .48));
    if (primaryGuess.confidence !== 'high' || primaryGuess.dateConfidence === 'low') retryRegions.push(cropReceiptRegion(image, .1, 1));
    if (retryRegions.length === 0) {
      progress(100);
      return { text: primary, quality: prepared.quality };
    }
    retryCount = retryRegions.length;
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, preserve_interword_spaces: '1', user_defined_dpi: '300' });
    let combined = primary;
    for (let index = 0; index < retryRegions.length; index++) {
      pass = index + 1;
      combined += `\n<<<OCR_PASS>>>\n${(await worker.recognize(retryRegions[index])).data.text}`;
    }
    progress(100);
    return { text: combined, quality: prepared.quality };
  } finally {
    await worker.terminate();
  }
}

function normalizeAmount(value: string) {
  const cleaned = normalizeDigits(value).replace(/[OoD]/g, '0').replace(/[Il|]/g, '1').replace(/\s/g, '').replace(/,/g, '').replace(/[฿B]/gi, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 && parsed < 10_000_000 ? parsed : null;
}

function amountsInLine(line: string, allowInteger = false) {
  const normalized = normalizeDigits(line);
  const hasCurrency = /บาท|฿|\bTHB\b/i.test(normalized);
  const pattern = /(?:฿|THB)?\s*((?:[0-9OoDIl|]{1,3}(?:,[0-9OoDIl|]{3})+|[0-9OoDIl|]+)(?:\.[0-9OoDIl|]{0,2})?)\s*(?:บาท|฿|THB)?/gi;
  return [...normalized.matchAll(pattern)]
    .filter(match => allowInteger || hasCurrency || match[1].includes('.'))
    .map(match => normalizeAmount(match[1]))
    .filter((amount): amount is number => amount !== null);
}

const monthNumbers: Record<string, number> = {
  มค: 1, มกราคม: 1, jan: 1, january: 1,
  กพ: 2, กุมภาพันธ์: 2, feb: 2, february: 2,
  มีค: 3, มีนาคม: 3, mar: 3, march: 3,
  เมย: 4, เมษายน: 4, apr: 4, april: 4,
  พค: 5, พฤษภาคม: 5, may: 5,
  มิย: 6, มิถุนายน: 6, jun: 6, june: 6,
  กค: 7, กรกฎาคม: 7, jul: 7, july: 7,
  สค: 8, สิงหาคม: 8, aug: 8, august: 8,
  กย: 9, กันยายน: 9, sep: 9, sept: 9, september: 9,
  ตค: 10, ตุลาคม: 10, oct: 10, october: 10,
  พย: 11, พฤศจิกายน: 11, nov: 11, november: 11,
  ธค: 12, ธันวาคม: 12, dec: 12, december: 12,
};

function normalizeMonth(value: string) {
  return value.toLowerCase().replace(/[.\s]/g, '');
}

function normalizeYear(value: number, context: string, hasThaiText: boolean) {
  const currentYear = new Date().getFullYear();
  if (value >= 2400 && value <= 2700) return value - 543;
  if (value >= 1900 && value <= currentYear + 2) return value;
  if (value >= 100) return null;
  if (/พ\.?\s*ศ\.?|b\.?\s*e\.?/i.test(context) || (hasThaiText && value >= 40)) {
    const buddhistYear = 2500 + value - 543;
    if (buddhistYear >= 1990 && buddhistYear <= currentYear + 2) return buddhistYear;
  }
  const pivot = (currentYear + 2) % 100;
  const gregorianYear = value <= pivot ? 2000 + value : 1900 + value;
  return gregorianYear >= 1990 && gregorianYear <= currentYear + 2 ? gregorianYear : null;
}

function validDate(day: number, month: number, rawYear: number, context: string, hasThaiText: boolean) {
  const year = normalizeYear(rawYear, context, hasThaiText);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const value = new Date(year, month - 1, day);
  if (value.getFullYear() !== year || value.getMonth() !== month - 1 || value.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function dateLineMeta(line: string) {
  const transaction = /วันที่(?:ทำรายการ|ออก(?:ใบเสร็จ|เอกสาร)?|ซื้อ|ชำระ)|วันเวลา|transaction|trans(?:action)?\s*date|trx|sale\s*date|receipt\s*date|issued|paid\s*(?:on|date)/i.test(line);
  const generic = /วันที่|\bdate\b/i.test(line);
  const due = /ครบกำหนด|กำหนดชำระ|ชำระภายใน|due\s*date|payment\s*due/i.test(line);
  const billing = /รอบบิล|รอบการใช้|billing\s*(?:period|cycle)|meter\s*read|อ่านหน่วย/i.test(line);
  const hasTime = /(?:^|\s)\d{1,2}[:.][0-5]\d(?::[0-5]\d)?(?:\s|$)/.test(line);
  const label = transaction ? 'วันที่ทำรายการ' : due ? 'วันครบกำหนด' : billing ? 'วันที่รอบบิล' : generic ? 'วันที่ในเอกสาร' : hasTime ? 'วันที่พร้อมเวลา' : 'วันที่ที่ตรวจพบ';
  const score = 32 + (transaction ? 65 : generic ? 30 : 0) + (hasTime ? 28 : 0) - (due ? 38 : 0) - (billing ? 30 : 0);
  return { label, score };
}

function findDateCandidates(lines: string[]) {
  const candidates: DateCandidate[] = [];
  const hasThaiText = lines.some(line => /[ก-๙]/.test(line));
  const add = (date: string | null, line: string, bonus = 0) => {
    if (!date) return;
    const meta = dateLineMeta(line);
    const score = meta.score + bonus;
    const existing = candidates.find(candidate => candidate.date === date);
    if (!existing) candidates.push({ date, label: meta.label, score, raw: line });
    else if (score > existing.score) Object.assign(existing, { label: meta.label, score, raw: line });
  };

  for (const originalLine of lines) {
    const line = normalizeDigits(originalLine)
      .replace(/(?<=\d)[Oo](?=[\d/.-])/g, '0')
      .replace(/(?<=[\d/.-])[Oo](?=\d)/g, '0');

    for (const match of line.matchAll(/(?<!\d)(\d{1,4})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(?:(?:พ\.?\s*ศ\.?|b\.?\s*e\.?)\s*)?(\d{1,4})(?!\d)/gi)) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      const third = Number(match[3]);
      const yearFirst = match[1].length === 4 && first > 1900;
      const monthFirst = !yearFirst && first <= 12 && second > 12;
      add(yearFirst ? validDate(third, second, first, line, hasThaiText) : monthFirst ? validDate(second, first, third, line, hasThaiText) : validDate(first, second, third, line, hasThaiText), originalLine, yearFirst ? 12 : match[3].length === 4 ? 10 : monthFirst ? 6 : 0);
    }

    for (const match of line.matchAll(/(?<!\d)(\d{1,2})\s*([ก-๙A-Za-z.]{2,14})\s*(?:(?:พ\.?\s*ศ\.?|b\.?\s*e\.?)\s*)?(\d{2,4})(?!\d)/gi)) {
      const month = monthNumbers[normalizeMonth(match[2])];
      if (month) add(validDate(Number(match[1]), month, Number(match[3]), line, hasThaiText), originalLine, 18);
    }

    for (const match of line.matchAll(/\b([A-Za-z.]{3,12})\s+(\d{1,2}),?\s+(\d{2,4})\b/gi)) {
      const month = monthNumbers[normalizeMonth(match[1])];
      if (month) add(validDate(Number(match[2]), month, Number(match[3]), line, hasThaiText), originalLine, 18);
    }
  }
  return candidates.sort((a, b) => b.score - a.score).slice(0, 5);
}

const duePattern = /จำนวนเงิน(?:ค่าไฟฟ้า)?ที่ต้องชำระ|ค่าไฟฟ้าที่ต้องชำระ|ยอด(?:เงิน)?ที่ต้องชำระ|ยอดชำระ|ต้องชำระ|amount\s*due|total\s*due|balance\s*due|payable/i;
const netPattern = /ยอดสุทธิ|รวมทั้งสิ้น|รวมเงินสุทธิ|สุทธิ|grand\s*total|net\s*(?:total|amount|amt)|after\s*discount/i;
const totalPattern = /ยอดรวม|รวม(?:เงิน|ราคา)?|total|amount|sub\s*total|subtotal/i;
const itemCountSummaryPattern = /(?:^|\s)(?:[2-9]|\d{2,})\s*(?:[ชขซ]ิ้น|รายการ|items?|pcs?)(?:\s|$)/i;
const negativePattern = /เงินทอน|change|รับเงิน|เงินสด|cash|ภาษี|vat|ส่วน(?:ลด|.{0,4}จจ)|discount|คูปอง|coupon|promotion|promo|เลข(?:ที่|มิเตอร์)|meter|หน่วย|kwh|ค่าบริการ/i;

type AmountObservation = { amount: number; lineIndex: number };

function hasSubsetSum(values: number[], target: number) {
  if (target <= 0 || values.length === 0) return false;
  const roundedTarget = Math.round(target * 100);
  let sums = new Set([0]);
  for (const value of values.slice(0, 8)) {
    const cents = Math.round(value * 100);
    const next = new Set(sums);
    for (const sum of sums) {
      const candidate = sum + cents;
      if (candidate <= roundedTarget + 2) next.add(candidate);
    }
    sums = next;
  }
  return [...sums].some(sum => Math.abs(sum - roundedTarget) <= 2);
}

function findAmountCandidates(lines: string[]) {
  const candidates: AmountCandidate[] = [];
  const observations: AmountObservation[] = [];
  const add = (amount: number, score: number, label: string, source: string) => {
    const existing = candidates.find(candidate => Math.abs(candidate.amount - amount) < .005);
    if (!existing) candidates.push({ amount, score, label, source });
    else if (score > existing.score) Object.assign(existing, { score, label, source });
  };
  lines.forEach((line, index) => {
    const positionBonus = Math.round((index / Math.max(1, lines.length - 1)) * 12);
    const rule = duePattern.test(line)
      ? { score: 150, label: 'ยอดที่ต้องชำระ' }
      : netPattern.test(line)
        ? { score: 130, label: 'ยอดสุทธิ' }
        : itemCountSummaryPattern.test(line)
          ? { score: 128, label: 'ยอดตามจำนวนสินค้า' }
        : totalPattern.test(line)
          ? { score: 98, label: 'ยอดรวม' }
          : null;
    const penalty = negativePattern.test(line) && !duePattern.test(line) && !netPattern.test(line) ? 150 : 0;
    const lineAmounts = amountsInLine(line, Boolean(rule) && rule?.label !== 'ยอดตามจำนวนสินค้า');
    amountsInLine(line).forEach(amount => observations.push({ amount, lineIndex: index }));
    lineAmounts.forEach(amount => {
      const decimalBonus = Number.isInteger(amount) ? 0 : 8;
      const currencyBonus = /บาท|฿|\bTHB\b/i.test(line) ? 18 : 0;
      add(amount, (rule?.score ?? 34) + decimalBonus + currencyBonus + positionBonus - penalty, rule?.label ?? 'ตัวเลขที่พบ', line);
    });
    if (rule) {
      for (let offset = 1; offset <= 2; offset++) {
        const nearby = lines[index + offset];
        if (!nearby) break;
        amountsInLine(nearby, true).forEach(amount => {
          const nearbyPenalty = negativePattern.test(nearby) ? 150 : 0;
          add(amount, rule.score - offset * 12 + (Number.isInteger(amount) ? 0 : 8) - nearbyPenalty, rule.label, `${line} ${nearby}`);
        });
      }
    }
  });

  // ใบเสร็จจำนวนมากพิมพ์ "ยอดรวม → ส่วนลดหนึ่งหรือหลายรายการ → ยอดสุทธิ"
  // แม้ OCR อ่านป้ายกำกับไม่ออก ความสัมพันธ์ทางคณิตศาสตร์ยังช่วยหายอดที่จ่ายจริงได้
  for (let grossIndex = 0; grossIndex < observations.length; grossIndex++) {
    const gross = observations[grossIndex];
    for (let netIndex = grossIndex + 2; netIndex < observations.length; netIndex++) {
      const net = observations[netIndex];
      if (net.lineIndex - gross.lineIndex > 6 || net.amount >= gross.amount) continue;
      const difference = gross.amount - net.amount;
      if (difference > gross.amount * .8) continue;
      const betweenLines = lines.slice(gross.lineIndex + 1, net.lineIndex);
      const netOccurrences = observations.filter(item => Math.abs(item.amount - net.amount) < .005).length;
      const hasReceiptEvidence = totalPattern.test(lines[gross.lineIndex]) || betweenLines.some(line => negativePattern.test(line)) || netOccurrences >= 2;
      if (!hasReceiptEvidence) continue;
      const between = observations.slice(grossIndex + 1, netIndex)
        .filter(item => item.amount < gross.amount && item.amount <= difference + .02)
        .map(item => item.amount);
      if (!hasSubsetSum(between, difference)) continue;
      const candidate = candidates.find(item => Math.abs(item.amount - net.amount) < .005);
      if (candidate) {
        candidate.score += 90;
        candidate.label = 'ยอดหลังหักส่วนลด';
        candidate.source = `ตรวจสอบได้จาก ${gross.amount.toFixed(2)} − ส่วนลด = ${net.amount.toFixed(2)}`;
      }
    }
  }

  // ยอดสุทธิมักถูกพิมพ์ซ้ำอีกครั้งเป็นยอดรับชำระ จึงเพิ่มความน่าเชื่อถือเมื่อพบจำนวนเดียวกันหลายบรรทัด
  for (const candidate of candidates) {
    const occurrences = new Set(observations.filter(item => Math.abs(item.amount - candidate.amount) < .005).map(item => item.lineIndex)).size;
    if (occurrences >= 2) {
      candidate.score += Math.min(36, 18 * (occurrences - 1));
      if (candidate.label === 'ตัวเลขที่พบ') candidate.label = 'ยอดที่พบซ้ำ';
    }
  }
  return candidates.filter(candidate => candidate.score > 15).sort((a, b) => b.score - a.score).slice(0, 6);
}

function amountBesideLabel(lines: string[], pattern: RegExp, lookAhead = true) {
  for (let index = lines.length - 1; index >= 0; index--) {
    if (!pattern.test(lines[index])) continue;
    const sameLine = amountsInLine(lines[index]);
    if (sameLine.length) return sameLine.at(-1) ?? null;
    const nextLine = lookAhead ? lines[index + 1] : undefined;
    if (nextLine) {
      const nearby = amountsInLine(nextLine);
      if (nearby.length) return nearby.at(-1) ?? null;
    }
  }
  return null;
}

function extractReceiptDetails(lines: string[]): ReceiptDetailsGuess {
  const joined = lines.join('\n');
  const receiptMatch = joined.match(/(?:receipt|invoice|เลขที่ใบเสร็จ|เลขที่เอกสาร|เลขที่(?!\s*(?:ผู้เสีย|สาขา))|no\.?)[\s:#-]*([A-Z0-9][A-Z0-9\-/]{3,30})/i);
  const taxMatch = joined.match(/(?:tax\s*(?:id|no|#)?|เลขประจำตัวผู้เสียภาษี)[^\d]{0,12}(\d[\d\s-]{11,17}\d)/i);
  const branchMatch = joined.match(/(?:สาขา|branch)[\s:#-]*([^\n]{1,35})/i);
  const timeMatch = joined.match(/(?:เวลา|time)\s*((?:[01]?\d|2[0-3])[:.]([0-5]\d)(?::[0-5]\d)?)|\b((?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)\b/i);
  const subtotal = amountBesideLabel(lines, /subtotal|sub\s*total|ยอดรวม(?:ก่อน|สินค้า)|รวมเป็นเงิน/i);
  const discountLines = lines.filter(line => /ส่วน(?:ลด|.{0,4}จจ)|discount|coupon|คูปอง|promotion|promo/i.test(line));
  const discounts = discountLines.flatMap(line => amountsInLine(line)).filter(amount => amount > 0);
  const discount = discounts.length ? Math.round(discounts.reduce((sum, amount) => sum + amount, 0) * 100) / 100 : null;
  const tax = amountBesideLabel(lines, /(?:ภาษีมูลค่าเพิ่ม|vat|tax)(?!\s*(?:id|code|no|#))/i, false);
  const paymentMethod = /prompt\s*pay|พร้อมเพย์/i.test(joined) ? 'พร้อมเพย์'
    : /qr\s*(?:payment|pay)|ชำระ.*qr/i.test(joined) ? 'QR Payment'
      : /credit|visa|mastercard|บัตรเครดิต/i.test(joined) ? 'บัตรเครดิต'
        : /debit|บัตรเดบิต/i.test(joined) ? 'บัตรเดบิต'
          : /transfer|โอนเงิน/i.test(joined) ? 'โอนเงิน'
            : /เงินสด|cash/i.test(joined) ? 'เงินสด' : '';

  const itemNoise = /total|subtotal|amount|ยอดรวม|ยอดสุทธิ|สุทธิ|ส่วนลด|discount|coupon|vat|tax|เงินสด|cash|เงินทอน|change|ชำระ|เลขที่|receipt|invoice|โทร|tel|ขอบคุณ|thank|member|point|คะแนน|สาขา|branch|date|วันที่|เวลา|time|www\.|http/i;
  const items: ReceiptItemGuess[] = [];
  for (const line of lines) {
    if (itemNoise.test(line) || /\d{5,}/.test(line) || /^\s*\d+\s*[ชขซ]ิ้น/i.test(line)) continue;
    const amounts = amountsInLine(line);
    if (!amounts.length) continue;
    const total = amounts.at(-1)!;
    if (total <= 0) continue;
    const moneyPattern = /(?:฿|THB)?\s*(?:[0-9OoDIl|]{1,3}(?:,[0-9OoDIl|]{3})+|[0-9OoDIl|]+)(?:\.[0-9OoDIl|]{0,2})?\s*(?:บาท|฿|THB)?/gi;
    const moneyMatches = [...line.matchAll(moneyPattern)].map(match => ({ match, amount: normalizeAmount(match[0]) })).filter(value => value.amount !== null);
    const finalMoney = moneyMatches.at(-1);
    if (!finalMoney || finalMoney.match.index === undefined) continue;
    const beforeAmount = line.slice(0, finalMoney.match.index).replace(/(?:฿|THB)?\s*[\d,]+(?:\.\d{1,2})?\s*(?:บาท|฿|THB)?\s*$/i, '').trim();
    const quantityMatch = beforeAmount.match(/^([1-9]\d{0,2})\s+(.*)$/);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
    const name = (quantityMatch?.[2] ?? beforeAmount).replace(/^[^A-Za-zก-๙]+/, '').trim();
    const letters = (name.match(/[A-Za-zก-๙]/g) || []).length;
    if (letters < 2 || name.length > 100) continue;
    const explicitUnitPrice = amounts.length >= 2 ? amounts.at(-2)! : null;
    const unitPrice = explicitUnitPrice && explicitUnitPrice * quantity === total ? explicitUnitPrice : quantity > 1 ? Math.round((total / quantity) * 100) / 100 : total;
    items.push({ name, quantity, unitPrice, total, confidence: quantityMatch ? .78 : .66 });
    if (items.length >= 30) break;
  }

  return {
    receiptNumber: receiptMatch?.[1]?.trim() ?? '',
    taxId: taxMatch?.[1]?.replace(/\D/g, '') ?? '',
    branch: branchMatch?.[1]?.replace(/\s{2,}.*/, '').trim() ?? '',
    transactionTime: timeMatch ? (timeMatch[1] || timeMatch[3]).replace('.', ':') : '',
    subtotal,
    discount,
    tax,
    paymentMethod,
    items,
  };
}

type TitleGuess = { title: string; confidence: 'high' | 'medium' | 'low' };

const merchantRules: Array<{ title: string; pattern: RegExp }> = [
  { title: '7-Eleven', pattern: /7[\s.,:'_\-/]{0,5}[a-z0-9]{0,3}leven|7[\s-]*11|เซเว่น|\bcp\s*all\b|0107542000011/i },
  { title: "Lotus's", pattern: /lotus'?s?|โลตัส/i },
  { title: 'Mini Big C', pattern: /mini\s*big\s*c|มินิ\s*บิ๊ก\s*ซี/i },
  { title: 'Big C', pattern: /\bbig\s*c\b|บิ๊ก\s*ซี/i },
  { title: 'Tops', pattern: /\btops\b|ท็อปส์/i },
  { title: 'Makro', pattern: /\bmakro\b|แม็คโคร/i },
  { title: 'CJ MORE', pattern: /\bcj\s*more\b|ซีเจ\s*มอร์/i },
  { title: 'Lawson 108', pattern: /lawson\s*108|ลอว์สัน/i },
  { title: 'FamilyMart', pattern: /family\s*mart|แฟมิลี่มาร์ท/i },
  { title: 'Starbucks', pattern: /starbucks|สตาร์บัคส์/i },
  { title: 'Café Amazon', pattern: /cafe\s*amazon|café\s*amazon|คาเฟ่\s*อเมซอน/i },
  { title: 'KFC', pattern: /\bkfc\b|เคเอฟซี/i },
  { title: "McDonald's", pattern: /mcdonald'?s?|แมคโดนัลด์/i },
  { title: 'Grab', pattern: /\bgrab\b/i },
  { title: 'Watsons', pattern: /watsons?|วัตสัน/i },
  { title: 'Boots', pattern: /\bboots\b|บู๊ทส์/i },
  { title: 'HomePro', pattern: /home\s*pro|โฮมโปร/i },
  { title: 'การไฟฟ้านครหลวง', pattern: /การไฟฟ้านครหลวง|metropolitan\s+electricity|\bmea\b/i },
  { title: 'การไฟฟ้าส่วนภูมิภาค', pattern: /การไฟฟ้าส่วนภูมิภาค|provincial\s+electricity|\bpea\b/i },
];

const titleNoisePattern = /tax|vat|code|pos|เลข(?:ที่|ประจำตัว|ผู้เสียภาษี)|receipt|invoice|ใบเสร็จ|ใบกำกับ|โทร|tel|date|วันที่|เวลา|time|cashier|thank|ขอบคุณ|www\.|https?|total|amount|รวม|สุทธิ|สำนักงานใหญ่|สาขา|branch|ชำระ|member|terminal|ref(?:erence)?|รหัส/i;

function detectTitle(lines: string[]): TitleGuess {
  const joined = lines.slice(0, 18).join(' ');
  const known = merchantRules.find(rule => rule.pattern.test(joined));
  if (known) return { title: known.title, confidence: 'high' };

  const ranked = lines.slice(0, 12).map((rawLine, index) => {
    const line = rawLine.replace(/^[^A-Za-zก-๙]+/, '').replace(/\s*[([]?\d{4,}[)\]]?\s*$/, '').trim();
    const digits = (line.match(/\d/g) || []).length;
    const letters = (line.match(/[A-Za-zก-๙]/g) || []).length;
    const hasLongIdentifier = /\d{5,}/.test(line);
    const looksLikeMoney = /\d+[.,]\d{2}\b/.test(line);
    const rejected = line.length < 3 || line.length > 70 || letters < 3 || hasLongIdentifier || looksLikeMoney || titleNoisePattern.test(line) || digits > letters * .35;
    if (rejected) return { title: '', score: -1 };
    let score = Math.min(45, letters * 2) - index * 2;
    if (/บริษัท|หจก\.?|จำกัด|company|co\.?\s*,?\s*ltd|restaurant|cafe|market|store|shop/i.test(line)) score += 30;
    if (/^[A-Z][A-Z\s&'.,-]{2,}$/.test(line) && digits === 0) score += 8;
    return { title: line, score };
  }).filter(candidate => candidate.title).sort((a, b) => b.score - a.score);

  if (!ranked[0] || ranked[0].score < 18) return { title: '', confidence: 'low' };
  return { title: ranked[0].title, confidence: ranked[0].score >= 45 ? 'medium' : 'low' };
}

export function parseReceipt(text: string): ReceiptGuess {
  const passes = normalizeDigits(text).split(/<<<OCR_PASS>>>/).map(pass => pass.split(/\r?\n/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean));
  const lines = passes.flat();
  const amountCandidates = passes.flatMap(findAmountCandidates).reduce<AmountCandidate[]>((merged, candidate) => {
    const existing = merged.find(item => Math.abs(item.amount - candidate.amount) < .005);
    if (!existing) merged.push(candidate);
    else if (candidate.score > existing.score) Object.assign(existing, candidate);
    return merged;
  }, []).sort((a, b) => b.score - a.score).slice(0, 6);
  const best = amountCandidates[0];
  const dateCandidates = passes.flatMap(findDateCandidates).reduce<DateCandidate[]>((merged, candidate) => {
    const existing = merged.find(item => item.date === candidate.date);
    if (!existing) merged.push(candidate);
    else if (candidate.score > existing.score) Object.assign(existing, candidate);
    return merged;
  }, []).sort((a, b) => b.score - a.score).slice(0, 5);
  const bestDate = dateCandidates[0];
  const titleGuess = detectTitle(lines);
  const details = extractReceiptDetails(lines);
  const decisiveLabel = best && ['ยอดที่ต้องชำระ', 'ยอดสุทธิ', 'ยอดหลังหักส่วนลด', 'ยอดตามจำนวนสินค้า'].includes(best.label);
  const confidence = !best ? 'low' : best.score >= 120 && decisiveLabel ? 'high' : best.score >= 75 ? 'medium' : 'low';
  const dateConfidence = !bestDate ? 'low' : bestDate.score >= 85 ? 'high' : bestDate.score >= 55 || (dateCandidates.length === 1 && titleGuess.confidence === 'high' && bestDate.score >= 30) ? 'medium' : 'low';
  const confidenceValue = (value: Confidence) => value === 'high' ? .95 : value === 'medium' ? .7 : .3;
  const fieldConfidence = {
    merchant_name: confidenceValue(titleGuess.confidence),
    total: confidenceValue(confidence),
    transaction_date: confidenceValue(dateConfidence),
    receipt_number: details.receiptNumber ? .78 : 0,
    tax_id: details.taxId.length === 13 ? .9 : details.taxId ? .5 : 0,
    branch: details.branch ? .68 : 0,
    transaction_time: details.transactionTime ? .78 : 0,
    subtotal: details.subtotal !== null ? .74 : 0,
    discount: details.discount !== null ? .72 : 0,
    tax: details.tax !== null ? .72 : 0,
    payment_method: details.paymentMethod ? .82 : 0,
    items: details.items.length ? Math.round(details.items.reduce((sum, item) => sum + item.confidence, 0) / details.items.length * 100) / 100 : 0,
  };
  return { title: titleGuess.title, titleConfidence: titleGuess.confidence, amount: best?.amount ?? null, date: bestDate?.date ?? null, dateCandidates, dateConfidence, category: guessCategory(`${titleGuess.title}\n${text}`), amountCandidates, confidence, details, fieldConfidence };
}
