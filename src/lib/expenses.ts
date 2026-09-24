import { categoryLabel, Category, categories } from './categories';
import { isDemoMode, supabase } from './supabase';
import type { ImageQuality, ReceiptDetailsGuess } from './ocr';

export { categories } from './categories';
export type Expense = {
  id: string;
  title: string;
  amount: number;
  category: Category;
  expense_date: string;
  note: string;
  receipt_path: string | null;
  created_at?: string;
};
export type Draft = Omit<Expense, 'id' | 'created_at'>;
export type ReceiptAnalysisDraft = {
  merchantName: string;
  transactionDate: string | null;
  total: number | null;
  details: ReceiptDetailsGuess;
  ocrText: string;
  fieldConfidence: Record<string, number>;
  imageQuality: ImageQuality;
  cropMetadata?: Record<string, number | string | boolean>;
};
export type StoredReceiptAnalysis = ReceiptAnalysisDraft & { id: string };
export type ExpenseFilters = { month?: string; category?: Category | 'all'; search?: string };
const demoKey = 'pocket-demo-expenses-v2';

export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function money(amount: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 2 }).format(amount);
}

export function validate(draft: Draft) {
  if (!draft.title.trim() || draft.title.trim().length > 120) throw new Error('กรุณากรอกชื่อรายการไม่เกิน 120 ตัวอักษร');
  if (!Number.isFinite(draft.amount) || draft.amount <= 0 || draft.amount > 9_999_999_999.99 || Math.abs(draft.amount * 100 - Math.round(draft.amount * 100)) > 0.0001) {
    throw new Error('จำนวนเงินต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 ตำแหน่ง');
  }
  if (!categories.includes(draft.category) || !/^\d{4}-\d{2}-\d{2}$/.test(draft.expense_date)) throw new Error('หมวดหมู่หรือวันที่ไม่ถูกต้อง');
  if (draft.note.length > 2000) throw new Error('หมายเหตุยาวเกิน 2,000 ตัวอักษร');
}

function demoRows(): Expense[] {
  try { return JSON.parse(localStorage.getItem(demoKey) || '[]'); }
  catch { localStorage.removeItem(demoKey); return []; }
}

function applyFilters(rows: Expense[], filters: ExpenseFilters) {
  const search = filters.search?.trim().toLocaleLowerCase('th');
  return rows.filter(row =>
    (!filters.month || row.expense_date.startsWith(filters.month)) &&
    (!filters.category || filters.category === 'all' || row.category === filters.category) &&
    (!search || row.title.toLocaleLowerCase('th').includes(search) || row.note.toLocaleLowerCase('th').includes(search))
  );
}

export async function listExpenses(filters: ExpenseFilters = {}): Promise<Expense[]> {
  if (isDemoMode()) return applyFilters(demoRows(), filters).sort((a, b) => b.expense_date.localeCompare(a.expense_date));
  const client = supabase!;
  let query = client.from('expenses').select('id,title,amount,category,expense_date,note,receipt_path,created_at').order('expense_date', { ascending: false }).order('created_at', { ascending: false }).limit(500);
  if (filters.month) {
    const [year, month] = filters.month.split('-').map(Number);
    const next = new Date(year, month, 1);
    const nextMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`;
    query = query.gte('expense_date', filters.month + '-01').lt('expense_date', nextMonth);
  }
  if (filters.category && filters.category !== 'all') query = query.eq('category', filters.category);
  if (filters.search?.trim()) {
    const safeSearch = filters.search.trim().replace(/[%,()]/g, '');
    if (safeSearch) query = query.or(`title.ilike.%${safeSearch}%,note.ilike.%${safeSearch}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return data.map(row => ({ ...row, amount: Number(row.amount), category: row.category as Category }));
}

export async function getExpense(id: string): Promise<Expense> {
  if (isDemoMode()) {
    const row = demoRows().find(item => item.id === id);
    if (!row) throw new Error('ไม่พบรายการนี้');
    return row;
  }
  const { data, error } = await supabase!.from('expenses').select('id,title,amount,category,expense_date,note,receipt_path,created_at').eq('id', id).single();
  if (error) throw error;
  return { ...data, amount: Number(data.amount), category: data.category as Category };
}

export async function getReceiptAnalysis(expenseId: string): Promise<StoredReceiptAnalysis | null> {
  if (isDemoMode()) return null;
  const { data, error } = await supabase!.from('receipts').select('id,merchant_name,transaction_date,total,receipt_number,tax_id,branch,transaction_time,subtotal,discount,tax,payment_method,ocr_text,field_confidence,image_quality,crop_metadata,receipt_items(line_number,name,quantity,unit_price,total,confidence)').eq('expense_id', expenseId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const items = [...(data.receipt_items || [])].sort((a, b) => a.line_number - b.line_number).map(item => ({ name: item.name, quantity: Number(item.quantity), unitPrice: item.unit_price === null ? null : Number(item.unit_price), total: Number(item.total), confidence: Number(item.confidence) }));
  return {
    id: data.id,
    merchantName: data.merchant_name,
    transactionDate: data.transaction_date,
    total: data.total === null ? null : Number(data.total),
    details: { receiptNumber: data.receipt_number, taxId: data.tax_id, branch: data.branch, transactionTime: data.transaction_time?.slice(0, 5) || '', subtotal: data.subtotal === null ? null : Number(data.subtotal), discount: data.discount === null ? null : Number(data.discount), tax: data.tax === null ? null : Number(data.tax), paymentMethod: data.payment_method, items },
    ocrText: data.ocr_text,
    fieldConfidence: data.field_confidence as Record<string, number>,
    imageQuality: data.image_quality as ImageQuality,
    cropMetadata: data.crop_metadata as Record<string, number | string | boolean>,
  };
}

export function validateFile(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error('รองรับ JPG, PNG และ WebP ขนาดไม่เกิน 5 MB');
}

async function userId() {
  const { data: { user }, error } = await supabase!.auth.getUser();
  if (error || !user) throw new Error('กรุณาเข้าสู่ระบบอีกครั้ง');
  return user.id;
}

async function uploadReceipt(file: File, id: string) {
  validateFile(file);
  const uid = await userId();
  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
  const path = `${uid}/${id}.${extension}`;
  const { error } = await supabase!.storage.from('receipts').upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  return path;
}

async function saveReceiptAnalysis(expenseId: string, storagePath: string | null, analysis: ReceiptAnalysisDraft) {
  const { error } = await supabase!.rpc('save_receipt_analysis', {
    p_expense_id: expenseId,
    p_storage_path: storagePath,
    p_receipt: {
      merchant_name: analysis.merchantName,
      receipt_number: analysis.details.receiptNumber,
      tax_id: analysis.details.taxId,
      branch: analysis.details.branch,
      transaction_date: analysis.transactionDate,
      transaction_time: analysis.details.transactionTime || null,
      subtotal: analysis.details.subtotal,
      discount: analysis.details.discount,
      tax: analysis.details.tax,
      total: analysis.total,
      payment_method: analysis.details.paymentMethod,
      ocr_text: analysis.ocrText,
      field_confidence: analysis.fieldConfidence,
      image_quality: analysis.imageQuality,
      crop_metadata: analysis.cropMetadata || {},
    },
    p_items: analysis.details.items.map((item, lineNumber) => ({
      line_number: lineNumber,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      total: item.total,
      confidence: item.confidence,
    })),
  });
  if (error) throw error;
}

export async function saveExpense(draft: Draft, file?: File | null, id?: string, analysis?: ReceiptAnalysisDraft | null) {
  validate(draft);
  if (isDemoMode()) {
    if (file) throw new Error('เชื่อมต่อ Supabase ก่อนบันทึกรูปใบเสร็จ');
    const rows = demoRows();
    const value: Expense = { ...draft, title: draft.title.trim(), id: id || crypto.randomUUID(), created_at: new Date().toISOString() };
    localStorage.setItem(demoKey, JSON.stringify(id ? rows.map(row => row.id === id ? value : row) : [value, ...rows]));
    return value.id;
  }
  const uid = await userId();
  const expenseId = id || crypto.randomUUID();
  const old = id ? await getExpense(id) : null;
  let receiptPath = old?.receipt_path || null;
  if (file) receiptPath = await uploadReceipt(file, expenseId);
  const payload = { ...draft, id: expenseId, title: draft.title.trim(), user_id: uid, receipt_path: receiptPath };
  const { error } = id
    ? await supabase!.from('expenses').update(payload).eq('id', id)
    : await supabase!.from('expenses').insert(payload);
  if (error) {
    if (file && receiptPath && receiptPath !== old?.receipt_path) await supabase!.storage.from('receipts').remove([receiptPath]);
    throw error;
  }
  if (analysis) {
    try { await saveReceiptAnalysis(expenseId, receiptPath, analysis); }
    catch (analysisError) {
      if (!id) {
        await supabase!.from('expenses').delete().eq('id', expenseId);
        if (receiptPath) await supabase!.storage.from('receipts').remove([receiptPath]);
      }
      throw analysisError;
    }
  }
  if (file && old?.receipt_path && old.receipt_path !== receiptPath) await supabase!.storage.from('receipts').remove([old.receipt_path]);
  return expenseId;
}

export async function deleteExpense(id: string) {
  if (isDemoMode()) {
    localStorage.setItem(demoKey, JSON.stringify(demoRows().filter(row => row.id !== id)));
    return;
  }
  const row = await getExpense(id);
  const { error } = await supabase!.from('expenses').delete().eq('id', id);
  if (error) throw error;
  if (row.receipt_path) await supabase!.storage.from('receipts').remove([row.receipt_path]);
}

export async function receiptUrl(path: string) {
  if (isDemoMode()) throw new Error('ไม่มีไฟล์ใบเสร็จในโหมดทดลอง');
  const { data, error } = await supabase!.storage.from('receipts').createSignedUrl(path, 60);
  if (error) throw error;
  return data.signedUrl;
}

export function exportExpensesCsv(rows: Expense[]) {
  const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
  const content = ['วันที่,รายการ,หมวดหมู่,จำนวนเงิน,หมายเหตุ', ...rows.map(row => [row.expense_date, row.title, categoryLabel(row.category), row.amount.toFixed(2), row.note].map(escape).join(','))].join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `pocket-expenses-${today()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
