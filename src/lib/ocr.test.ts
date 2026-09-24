import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReceipt } from './ocr';

test('เลือกยอดที่ต้องชำระจากบิลค่าไฟ แทน VAT และเลขมิเตอร์', () => {
  const result = parseReceipt(`
    การไฟฟ้านครหลวง MEA
    วันที่ 20/09/2569
    เลขมิเตอร์ 998877
    ค่าบริการ 38.22
    ภาษีมูลค่าเพิ่ม VAT 81.45
    จำนวนเงินค่าไฟฟ้าที่ต้องชำระ
    1,245.67 บาท
  `);
  assert.equal(result.title, 'การไฟฟ้านครหลวง');
  assert.equal(result.amount, 1245.67);
  assert.equal(result.date, '2026-09-20');
  assert.equal(result.category, 'Bills');
  assert.equal(result.confidence, 'high');
});

test('เลือกยอดสุทธิจาก 7-Eleven แทนเงินรับและเงินทอน', () => {
  const result = parseReceipt(`
    7-ELEVEN
    รวมสินค้า 3 ชิ้น 150.00
    ส่วนลด 10.00
    ยอดสุทธิ 140.00 บาท
    รับเงินสด 500.00
    เงินทอน 360.00
  `);
  assert.equal(result.title, '7-Eleven');
  assert.equal(result.amount, 140);
  assert.equal(result.category, 'Food');
  assert.equal(result.amountCandidates.some(candidate => candidate.amount === 500), false);
});

test('รองรับยอดที่อยู่บรรทัดถัดจากคำว่า TOTAL DUE', () => {
  const result = parseReceipt('TOTAL DUE\n95.00 THB');
  assert.equal(result.amount, 95);
  assert.equal(result.confidence, 'high');
});

test('คืนค่าความมั่นใจต่ำเมื่อพบเพียงตัวเลขไม่มีป้ายกำกับ', () => {
  const result = parseReceipt('ร้านทดสอบ\nสินค้า 25.00\nสินค้า 80.00');
  assert.equal(result.confidence, 'low');
  assert.equal(result.amountCandidates.length, 2);
});

test('อนุมานยอดสุทธิได้เมื่อ OCR อ่านป้ายกำกับไม่ออกแต่ยอดรวมลบส่วนลดลงตัว', () => {
  const result = parseReceipt(`
    ALL, 7-Bleven
    ขนมจีบกุ้ง 21.00
    ลาเต้เย็น 30.00
    ISCORE GREEN 60.00
    111.00
    6.
    ส่วนจจ)11 Cafe16oz. 5.00
    6 ชิ้น 100.00
    เงินสด/เงินทอน 100.00 0.00
  `);
  assert.equal(result.title, '7-Eleven');
  assert.equal(result.amount, 100);
  assert.match(result.amountCandidates[0].label, /ยอด(?:หลังหักส่วนลด|ตามจำนวนสินค้า)/);
  assert.equal(result.confidence, 'high');
});

test('จับบรรทัดสรุปจำนวนสินค้าได้เมื่อ OCR อ่านคำว่ายอดสุทธิหาย', () => {
  const result = parseReceipt('111.00\n6.\nส่วนจจ)11 Cafe16oz.\n6 ขิ้น 100.00\n00.00');
  assert.equal(result.amount, 100);
  assert.equal(result.amountCandidates[0].label, 'ยอดตามจำนวนสินค้า');
  assert.equal(result.confidence, 'high');
});

test('รองรับส่วนลดหลายรายการโดยไม่ผูกกับชื่อร้าน', () => {
  const result = parseReceipt(`
    ร้านค้าทั่วไป
    SUBTOTAL 850.00
    PROMOTION 50.00
    COUPON 20.00
    780.00
  `);
  assert.equal(result.amount, 780);
  assert.equal(result.amountCandidates[0].label, 'ยอดหลังหักส่วนลด');
});

test('ไม่สรุปความสัมพันธ์ส่วนลดจากราคาสินค้าที่บังเอิญลบกันลงตัว', () => {
  const result = parseReceipt('ร้านค้าทั่วไป\nสินค้า A 100.00\nสินค้า B 30.00\nสินค้า C 70.00');
  assert.notEqual(result.amountCandidates[0].label, 'ยอดหลังหักส่วนลด');
  assert.equal(result.confidence, 'low');
});

test('ไม่ใช้ VAT Code, POS และเลขอ้างอิงเป็นชื่อร้าน', () => {
  const result = parseReceipt('ง Code 13061 0140926260009300269\nTAX#0101234567890\nPOS#009300269\nยอดสุทธิ 100.00');
  assert.equal(result.title, '');
  assert.equal(result.titleConfidence, 'low');
});

test('รู้จัก 7-Eleven แม้ OCR อ่านชื่อผิดบางตัว', () => {
  const result = parseReceipt('ALL, 7-Bleven อุอน\nVat Code 13061 POS#009300269\n6 ขิ้น 100.00');
  assert.equal(result.title, '7-Eleven');
  assert.equal(result.titleConfidence, 'high');
});

test('เลือกชื่อร้านทั่วไปจากหัวบิลและตัดเลขสาขาที่ยาวออก', () => {
  const result = parseReceipt('บริษัท กาแฟบ้านสวน จำกัด (12345)\nTAX ID 0101234567890\nTOTAL 85.00');
  assert.equal(result.title, 'บริษัท กาแฟบ้านสวน จำกัด');
  assert.equal(result.titleConfidence, 'medium');
});

test('แปลงปี พ.ศ. แบบสี่หลักเป็น ค.ศ.', () => {
  const result = parseReceipt('วันที่ทำรายการ 24/09/2569 เวลา 14:30\nยอดสุทธิ 120.00');
  assert.equal(result.date, '2026-09-24');
  assert.equal(result.dateConfidence, 'high');
});

test('แปลงปี พ.ศ. แบบสองหลักจากใบเสร็จไทย', () => {
  const result = parseReceipt('ใบเสร็จรับเงิน\n11/06/63 06:41\nยอดสุทธิ 100.00');
  assert.equal(result.date, '2020-06-11');
  assert.equal(result.dateConfidence, 'medium');
});

test('รองรับเลขไทยและตัวย่อเดือนไทยที่มีจุด', () => {
  const result = parseReceipt('วันที่ออกใบเสร็จ ๕ ม.ค. ๒๕๖๘ เวลา 09:15');
  assert.equal(result.date, '2025-01-05');
  assert.equal(result.dateConfidence, 'high');
});

test('รองรับตัวย่อเดือนไทยทุกช่วงปลายปี', () => {
  assert.equal(parseReceipt('วันที่ 12 ก.ย. 2567').date, '2024-09-12');
  assert.equal(parseReceipt('วันที่ 3 ต.ค. 67').date, '2024-10-03');
  assert.equal(parseReceipt('วันที่ 9 พ.ย. 2568').date, '2025-11-09');
  assert.equal(parseReceipt('วันที่ 24 ธ.ค. 68').date, '2025-12-24');
});

test('รองรับชื่อเดือนอังกฤษและวันที่แบบ ISO', () => {
  assert.equal(parseReceipt('Receipt Date: Sep 24, 2026').date, '2026-09-24');
  assert.equal(parseReceipt('Transaction Date 2026-09-24 18:20').date, '2026-09-24');
  assert.equal(parseReceipt('Receipt Date 09/24/2026').date, '2026-09-24');
  assert.equal(parseReceipt('วันที่ 24ธ.ค.2568').date, '2025-12-24');
});

test('เลือกวันที่ทำรายการเหนือวันครบกำหนดชำระ', () => {
  const result = parseReceipt('วันที่ทำรายการ 05/08/2568 10:20\nวันครบกำหนดชำระ 20/08/2568');
  assert.equal(result.date, '2025-08-05');
  assert.equal(result.dateCandidates[1].date, '2025-08-20');
});

test('ไม่รับวันที่ที่ไม่มีอยู่จริง', () => {
  const result = parseReceipt('วันที่ 31/02/2568\nเลขที่ 0101234567890');
  assert.equal(result.date, null);
  assert.equal(result.dateConfidence, 'low');
});

test('เชื่อถือวันที่เดี่ยวบนใบเสร็จของร้านที่รู้จักในระดับปานกลาง', () => {
  const result = parseReceipt('ALL, 7-Bleven\nใบเสร็จรับเงิน\nRE0000043858P1 11/06/63');
  assert.equal(result.date, '2020-06-11');
  assert.equal(result.dateConfidence, 'medium');
});

test('แยกข้อมูลใบเสร็จและรายการสินค้าเป็นโครงสร้าง', () => {
  const result = parseReceipt(`
    ร้านกาแฟบ้านสวน
    เลขที่ใบเสร็จ RC-1234
    เลขประจำตัวผู้เสียภาษี 0101234567890
    สาขา 001
    วันที่ทำรายการ 24/09/2569 เวลา 14:30
    2 กาแฟเย็น 100.00
    1 ขนมปัง 35.00
    ยอดรวมสินค้า 135.00
    ส่วนลด 10.00
    VAT 7.00
    ยอดสุทธิ 125.00
    เงินสด 125.00
  `);
  assert.equal(result.details.receiptNumber, 'RC-1234');
  assert.equal(result.details.taxId, '0101234567890');
  assert.equal(result.details.branch, '001');
  assert.equal(result.details.transactionTime, '14:30');
  assert.equal(result.details.subtotal, 135);
  assert.equal(result.details.discount, 10);
  assert.equal(result.details.tax, 7);
  assert.equal(result.details.paymentMethod, 'เงินสด');
  assert.equal(result.details.items.length, 2);
  assert.deepEqual(result.details.items[0], { name: 'กาแฟเย็น', quantity: 2, unitPrice: 50, total: 100, confidence: .78 });
});

test('ไม่อ่านราคาสินค้าแบบจุดทศนิยมเป็นเวลา', () => {
  const result = parseReceipt('ร้านค้า\nสินค้า 21.00\nยอดสุทธิ 21.00');
  assert.equal(result.details.transactionTime, '');
});
