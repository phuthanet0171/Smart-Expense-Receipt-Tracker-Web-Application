'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, FileImage, LoaderCircle, Plus, Save, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { categoryLabel, categories, Category } from '@/lib/categories';
import { Draft, getExpense, getReceiptAnalysis, ReceiptAnalysisDraft, saveExpense, today, validateFile } from '@/lib/expenses';
import { AmountCandidate, DateCandidate, ImageQuality, parseReceipt, readReceipt, ReceiptDetailsGuess } from '@/lib/ocr';
import { isDemoMode } from '@/lib/supabase';
import { thaiError } from '@/lib/errors';
import ReceiptImageEditor, { CropMetadata } from './receipt-image-editor';

type FormState = { title: string; amount: string; date: string; category: Category; note: string };
const initialState: FormState = { title: '', amount: '', date: today(), category: 'Food', note: '' };
const displayDate = (date: string) => { const [year, month, day] = date.split('-'); return `${day}/${month}/${year}`; };

export default function ExpenseForm({ receipt = false, expenseId }: { receipt?: boolean; expenseId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(() => ({ ...initialState, date: receipt ? '' : today() }));
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [progress, setProgress] = useState(0);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(expenseId));
  const [error, setError] = useState('');
  const [autofilled, setAutofilled] = useState(false);
  const [amountCandidates, setAmountCandidates] = useState<AmountCandidate[]>([]);
  const [ocrConfidence, setOcrConfidence] = useState<'high' | 'medium' | 'low'>('low');
  const [titleConfidence, setTitleConfidence] = useState<'high' | 'medium' | 'low'>('low');
  const [dateCandidates, setDateCandidates] = useState<DateCandidate[]>([]);
  const [dateConfidence, setDateConfidence] = useState<'high' | 'medium' | 'low'>('low');
  const [quality, setQuality] = useState<ImageQuality | null>(null);
  const [receiptDetails, setReceiptDetails] = useState<ReceiptDetailsGuess | null>(null);
  const [fieldConfidence, setFieldConfidence] = useState<Record<string, number>>({});
  const [cropMetadata, setCropMetadata] = useState<CropMetadata | null>(null);
  const [hasReceipt, setHasReceipt] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!expenseId) return;
    Promise.all([getExpense(expenseId), getReceiptAnalysis(expenseId)]).then(([row, analysis]) => {
      setForm({ title: row.title, amount: String(row.amount), date: row.expense_date, category: row.category, note: row.note }); setHasReceipt(Boolean(row.receipt_path));
      if (analysis) { setReceiptDetails(analysis.details); setOcrText(analysis.ocrText); setFieldConfidence(analysis.fieldConfidence); setQuality(analysis.imageQuality); }
    }).catch(error => setError(error instanceof Error ? error.message : 'โหลดรายการไม่สำเร็จ')).finally(() => setLoading(false));
  }, [expenseId]);

  function change(name: keyof FormState) { return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(current => ({ ...current, [name]: event.target.value })); }
  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setError(''); setOcrText(''); setAutofilled(false); setAmountCandidates([]); setOcrConfidence('low'); setTitleConfidence('low'); setDateCandidates([]); setDateConfidence('low'); setQuality(null); setReceiptDetails(null); setFieldConfidence({}); setCropMetadata(null);
    const next = event.target.files?.[0]; if (!next) return;
    try { validateFile(next); if (preview) URL.revokeObjectURL(preview); setFile(next); setPreview(URL.createObjectURL(next)); }
    catch (error) { setError(thaiError(error, 'ไฟล์ไม่ถูกต้อง')); event.target.value = ''; }
  }
  function applyEditedFile(next: File, metadata: CropMetadata) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next); setPreview(URL.createObjectURL(next)); setCropMetadata(metadata); setOcrText(''); setAutofilled(false); setQuality(null); setReceiptDetails(null); setFieldConfidence({});
  }
  async function scan() {
    if (!file) return;
    setReading(true); setProgress(0); setError('');
    try {
      const result = await readReceipt(file, setProgress); const text = result.text; const guess = parseReceipt(text); setOcrText(text); setQuality(result.quality); setReceiptDetails(guess.details); setFieldConfidence(guess.fieldConfidence); setAmountCandidates(guess.amountCandidates); setOcrConfidence(guess.confidence); setTitleConfidence(guess.titleConfidence); setDateCandidates(guess.dateCandidates); setDateConfidence(guess.dateConfidence);
      setForm(current => ({ ...current, title: guess.titleConfidence !== 'low' ? guess.title : current.title, amount: guess.amount ? String(guess.amount) : current.amount, date: guess.dateConfidence !== 'low' && guess.date ? guess.date : current.date, category: guess.category })); setAutofilled(true);
    } catch { setError('อ่านข้อความไม่สำเร็จ กรุณาลองรูปที่ชัดขึ้น หรือกรอกข้อมูลเอง'); }
    finally { setReading(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (receipt && !file) return setError('กรุณาเลือกรูปใบเสร็จ');
    setBusy(true); setError('');
    const draft: Draft = { title: form.title, amount: Number(form.amount), category: form.category, expense_date: form.date, note: form.note, receipt_path: null };
    const analysis: ReceiptAnalysisDraft | null = receiptDetails && quality ? { merchantName: form.title.trim(), transactionDate: form.date || null, total: Number(form.amount) || null, details: receiptDetails, ocrText, fieldConfidence, imageQuality: quality, cropMetadata: cropMetadata || { edited: false } } : null;
    try { await saveExpense(draft, receipt ? file : null, expenseId, analysis); router.push('/dashboard'); }
    catch (error) { setError(thaiError(error, 'บันทึกไม่สำเร็จ')); }
    finally { setBusy(false); }
  }

  if (loading) return <div className="state-page"><span className="spinner"/>กำลังโหลดรายการ…</div>;
  const editing = Boolean(expenseId);
  const demo = isDemoMode();
  return <>
    <Link className="back-link" href="/dashboard"><ArrowLeft size={18}/>กลับหน้าภาพรวม</Link>
    <header className="page-heading compact"><div><p className="eyebrow">{editing ? 'แก้ไขข้อมูล' : receipt ? 'บันทึกจากรูปภาพ' : 'บันทึกรายการใหม่'}</p><h1>{editing ? 'แก้ไขรายจ่าย' : receipt ? 'สแกนใบเสร็จ' : 'เพิ่มรายจ่าย'}</h1><p>{editing ? 'ตรวจสอบและปรับข้อมูลให้ถูกต้อง' : receipt ? 'ระบบจะช่วยอ่านข้อมูล แล้วให้คุณตรวจสอบก่อนบันทึก' : 'กรอกข้อมูลสำคัญให้ครบ ใช้เวลาเพียงครู่เดียว'}</p></div></header>
    {error && <p role="alert" className="alert alert-error">{error}</p>}
    <div className={receipt ? 'expense-layout with-receipt' : 'expense-layout'}>
      {receipt && <section className="card receipt-panel"><div className="step-heading"><span>1</span><div><h2>เลือกรูปใบเสร็จ</h2><p>ใช้ภาพที่ตรง ชัด และเห็นยอดรวม</p></div></div>
        {!preview ? <label className="dropzone" htmlFor="receipt"><Upload size={32}/><strong>แตะเพื่อถ่ายหรือเลือกรูปใบเสร็จ</strong><span>วางบิลให้ตรง เห็นยอดครบ รองรับ JPG, PNG และ WebP ไม่เกิน 5 MB</span><input id="receipt" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={selectFile}/></label> : file && <div className="receipt-editor-wrap"><button className="icon-button preview-remove" aria-label="นำรูปออก" onClick={() => { URL.revokeObjectURL(preview); setPreview(''); setFile(null); setOcrText(''); setAmountCandidates([]); setDateCandidates([]); setAutofilled(false); setTitleConfidence('low'); setDateConfidence('low'); setQuality(null); setReceiptDetails(null); setCropMetadata(null); }}><X size={18}/></button><ReceiptImageEditor file={file} disabled={reading || busy} onApply={applyEditedFile}/></div>}
        <button type="button" className="btn btn-secondary w-full" disabled={!file || reading || busy} onClick={scan}>{reading ? <><LoaderCircle className="spin" size={18}/>กำลังอ่าน {progress}%</> : <><Sparkles size={18}/>อ่านข้อความและกรอกให้อัตโนมัติ</>}</button>
        {autofilled && <p className={ocrConfidence === 'high' ? 'success-note' : 'review-note'}><CheckCircle2 size={18}/>{ocrConfidence === 'high' ? 'พบยอดที่น่าเชื่อถือ กรุณาเทียบกับรูปอีกครั้ง' : amountCandidates.length ? 'พบหลายตัวเลข กรุณาเลือกยอดที่ตรงกับใบเสร็จ' : 'ยังหายอดเงินไม่พบ กรุณากรอกยอดจากใบเสร็จ'}</p>}
        {autofilled && titleConfidence === 'low' && <p className="review-note"><FileImage size={18}/>อ่านชื่อร้านได้ไม่ชัด ระบบจึงไม่ใส่ข้อความที่ไม่น่าเชื่อถือ กรุณากรอกชื่อร้านเอง</p>}
        {autofilled && dateConfidence === 'low' && <p className="review-note"><FileImage size={18}/>{dateCandidates.length ? 'พบวันที่แต่ยังแยกประเภทไม่ชัด กรุณาเลือกวันที่จากใบเสร็จ' : 'อ่านวันที่ไม่พบ ระบบจึงเว้นช่องวันที่ไว้ กรุณากรอกเอง'}</p>}
        {quality && <div className={quality.level === 'good' ? 'quality-note good' : 'quality-note warning'}>{quality.level === 'good' ? <CheckCircle2 size={18}/> : <AlertTriangle size={18}/>}<div><strong>คุณภาพภาพ {quality.score}/100</strong><span>{quality.warnings.length ? quality.warnings.join(' · ') : 'ภาพมีแสง ความคมชัด และความละเอียดเหมาะสำหรับ OCR'}</span></div></div>}
        {autofilled && <div className="field-confidence-grid"><div><span>ชื่อร้าน</span><strong>{Math.round((fieldConfidence.merchant_name || 0) * 100)}%</strong></div><div><span>ยอดสุทธิ</span><strong>{Math.round((fieldConfidence.total || 0) * 100)}%</strong></div><div><span>วันที่</span><strong>{Math.round((fieldConfidence.transaction_date || 0) * 100)}%</strong></div><div><span>รายการสินค้า</span><strong>{Math.round((fieldConfidence.items || 0) * 100)}%</strong></div></div>}
        {amountCandidates.length > 0 && <div className="amount-review" aria-label="ยอดเงินที่ตรวจพบ">
          <div className="amount-review-heading"><strong>ยอดที่ตรวจพบ</strong><span>แตะยอดที่ถูกต้อง</span></div>
          <div className="amount-options">{amountCandidates.map(candidate => {
            const selected = Number(form.amount) === candidate.amount;
            return <button type="button" className={selected ? 'amount-option selected' : 'amount-option'} aria-pressed={selected} onClick={() => setForm(current => ({ ...current, amount: String(candidate.amount) }))} key={`${candidate.amount}-${candidate.label}`}><span>{candidate.label}</span><strong>฿{candidate.amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></button>;
          })}</div>
        </div>}
        {dateCandidates.length > 0 && <div className="amount-review" aria-label="วันที่ที่ตรวจพบ">
          <div className="amount-review-heading"><strong>วันที่ที่ตรวจพบ</strong><span>เลือกวันที่ทำรายการ</span></div>
          <div className="amount-options">{dateCandidates.map(candidate => {
            const selected = form.date === candidate.date;
            return <button type="button" title={candidate.raw} className={selected ? 'amount-option selected' : 'amount-option'} aria-pressed={selected} onClick={() => setForm(current => ({ ...current, date: candidate.date }))} key={`${candidate.date}-${candidate.label}`}><span>{candidate.label}</span><strong>{displayDate(candidate.date)}</strong></button>;
          })}</div>
        </div>}
        {ocrText && <details className="ocr-details"><summary>ดูข้อความดิบที่อ่านได้</summary><pre>{ocrText}</pre></details>}
      </section>}
      <form className="card expense-fields" onSubmit={submit}><div className="step-heading"><span>{receipt ? '2' : <FileImage size={18}/>}</span><div><h2>รายละเอียดค่าใช้จ่าย</h2><p>ช่องที่มี * จำเป็นต้องกรอก</p></div></div>
        {editing && hasReceipt && <p className="info-note"><Camera size={18}/>รายการนี้มีรูปใบเสร็จแนบอยู่</p>}
        <div className="form-grid"><div className="full"><label htmlFor="title">ชื่อรายการหรือร้านค้า *</label><input id="title" value={form.title} onChange={change('title')} required maxLength={120} placeholder="เช่น อาหารกลางวัน ร้านกาแฟ"/></div><div><label htmlFor="amount">จำนวนเงิน (บาท) *</label><input id="amount" value={form.amount} onChange={change('amount')} type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" required placeholder="0.00"/></div><div><label htmlFor="date">วันที่ *</label><input id="date" value={form.date} onChange={change('date')} type="date" required/></div><div className="full"><label htmlFor="category">หมวดหมู่ *</label><select id="category" value={form.category} onChange={change('category')}>{categories.map(category => <option value={category} key={category}>{categoryLabel(category)}</option>)}</select></div><div className="full"><label htmlFor="note">หมายเหตุ</label><textarea id="note" value={form.note} onChange={change('note')} maxLength={2000} rows={4} placeholder="รายละเอียดเพิ่มเติม เช่น ซื้อสำหรับงานกลุ่ม"/><small className="char-count">{form.note.length}/2,000</small></div></div>
        {receiptDetails && <section className="receipt-data-section">
          <div className="receipt-data-heading"><div><h3>ข้อมูลละเอียดจากใบเสร็จ</h3><p>แก้ไขข้อมูลที่อ่านคลาดเคลื่อนได้ก่อนบันทึก</p></div><span className="confidence-badge">OCR {Math.round((fieldConfidence.items || 0) * 100)}%</span></div>
          <div className="form-grid receipt-meta-grid">
            <div><label htmlFor="receipt-number">เลขที่ใบเสร็จ <small>{Math.round((fieldConfidence.receipt_number || 0) * 100)}%</small></label><input id="receipt-number" value={receiptDetails.receiptNumber} onChange={event => setReceiptDetails(current => current && ({ ...current, receiptNumber: event.target.value }))} placeholder="ไม่พบข้อมูล"/></div>
            <div><label htmlFor="receipt-branch">สาขา <small>{Math.round((fieldConfidence.branch || 0) * 100)}%</small></label><input id="receipt-branch" value={receiptDetails.branch} onChange={event => setReceiptDetails(current => current && ({ ...current, branch: event.target.value }))} placeholder="ไม่พบข้อมูล"/></div>
            <div><label htmlFor="receipt-tax-id">เลขประจำตัวผู้เสียภาษี <small>{Math.round((fieldConfidence.tax_id || 0) * 100)}%</small></label><input id="receipt-tax-id" inputMode="numeric" value={receiptDetails.taxId} onChange={event => setReceiptDetails(current => current && ({ ...current, taxId: event.target.value.replace(/\D/g, '').slice(0, 20) }))} placeholder="ไม่พบข้อมูล"/></div>
            <div><label htmlFor="receipt-time">เวลาทำรายการ <small>{Math.round((fieldConfidence.transaction_time || 0) * 100)}%</small></label><input id="receipt-time" type="time" value={receiptDetails.transactionTime} onChange={event => setReceiptDetails(current => current && ({ ...current, transactionTime: event.target.value }))}/></div>
            <div><label htmlFor="receipt-subtotal">ยอดก่อนส่วนลด</label><input id="receipt-subtotal" type="number" inputMode="decimal" min="0" step=".01" value={receiptDetails.subtotal ?? ''} onChange={event => setReceiptDetails(current => current && ({ ...current, subtotal: event.target.value ? Number(event.target.value) : null }))}/></div>
            <div><label htmlFor="receipt-discount">ส่วนลดรวม</label><input id="receipt-discount" type="number" inputMode="decimal" min="0" step=".01" value={receiptDetails.discount ?? ''} onChange={event => setReceiptDetails(current => current && ({ ...current, discount: event.target.value ? Number(event.target.value) : null }))}/></div>
            <div><label htmlFor="receipt-tax">ภาษีมูลค่าเพิ่ม</label><input id="receipt-tax" type="number" inputMode="decimal" min="0" step=".01" value={receiptDetails.tax ?? ''} onChange={event => setReceiptDetails(current => current && ({ ...current, tax: event.target.value ? Number(event.target.value) : null }))}/></div>
            <div><label htmlFor="payment-method">วิธีชำระเงิน</label><select id="payment-method" value={receiptDetails.paymentMethod} onChange={event => setReceiptDetails(current => current && ({ ...current, paymentMethod: event.target.value }))}><option value="">ไม่พบข้อมูล</option><option>เงินสด</option><option>พร้อมเพย์</option><option>QR Payment</option><option>บัตรเครดิต</option><option>บัตรเดบิต</option><option>โอนเงิน</option><option>อื่น ๆ</option></select></div>
          </div>
          <div className="items-heading"><div><strong>รายการสินค้า</strong><span>{receiptDetails.items.length} รายการ</span></div><button type="button" className="btn btn-secondary btn-small" onClick={() => setReceiptDetails(current => current && ({ ...current, items: [...current.items, { name: '', quantity: 1, unitPrice: null, total: 0, confidence: 1 }] }))}><Plus size={16}/>เพิ่มรายการ</button></div>
          <div className="receipt-items">{receiptDetails.items.length ? receiptDetails.items.map((item, index) => <div className="receipt-item" key={`${index}-${item.name}`}>
            <div className="item-name"><label htmlFor={`item-name-${index}`}>ชื่อสินค้า</label><input id={`item-name-${index}`} value={item.name} onChange={event => setReceiptDetails(current => current && ({ ...current, items: current.items.map((value, itemIndex) => itemIndex === index ? { ...value, name: event.target.value } : value) }))}/></div>
            <div><label htmlFor={`item-qty-${index}`}>จำนวน</label><input id={`item-qty-${index}`} type="number" min=".001" step=".001" value={item.quantity} onChange={event => setReceiptDetails(current => current && ({ ...current, items: current.items.map((value, itemIndex) => itemIndex === index ? { ...value, quantity: Number(event.target.value) } : value) }))}/></div>
            <div><label htmlFor={`item-total-${index}`}>รวม</label><input id={`item-total-${index}`} type="number" min="0" step=".01" value={item.total} onChange={event => setReceiptDetails(current => current && ({ ...current, items: current.items.map((value, itemIndex) => itemIndex === index ? { ...value, total: Number(event.target.value) } : value) }))}/></div>
            <button type="button" className="icon-button danger-icon item-remove" aria-label={`ลบ ${item.name || 'รายการสินค้า'}`} onClick={() => setReceiptDetails(current => current && ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={17}/></button>
          </div>) : <p className="items-empty">ยังอ่านรายการสินค้าไม่พบ สามารถเพิ่มเองได้</p>}</div>
        </section>}
        {receipt && demo && <p className="info-note">โหมดทดลองอ่าน OCR ได้ แต่ต้องเข้าสู่ระบบก่อนบันทึกรูป</p>}
        <div className="form-actions"><Link className="btn btn-secondary" href="/dashboard">ยกเลิก</Link><button disabled={busy || reading || (receipt && demo)} className="btn btn-primary">{busy ? <><LoaderCircle className="spin" size={18}/>กำลังบันทึก…</> : <><Save size={18}/>{editing ? 'บันทึกการแก้ไข' : 'บันทึกรายจ่าย'}</>}</button></div>
      </form>
    </div>
  </>;
}
