'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, Camera, CheckCircle2, FileImage, LoaderCircle, Save, Sparkles, Upload, X } from 'lucide-react';
import { categoryLabel, categories, Category } from '@/lib/categories';
import { Draft, getExpense, saveExpense, today, validateFile } from '@/lib/expenses';
import { parseReceipt, readReceipt } from '@/lib/ocr';
import { isDemoMode } from '@/lib/supabase';
import { thaiError } from '@/lib/errors';

type FormState = { title: string; amount: string; date: string; category: Category; note: string };
const initialState: FormState = { title: '', amount: '', date: today(), category: 'Food', note: '' };

export default function ExpenseForm({ receipt = false, expenseId }: { receipt?: boolean; expenseId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialState);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [progress, setProgress] = useState(0);
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(Boolean(expenseId));
  const [error, setError] = useState('');
  const [autofilled, setAutofilled] = useState(false);
  const [hasReceipt, setHasReceipt] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (!expenseId) return;
    getExpense(expenseId).then(row => { setForm({ title: row.title, amount: String(row.amount), date: row.expense_date, category: row.category, note: row.note }); setHasReceipt(Boolean(row.receipt_path)); }).catch(error => setError(error instanceof Error ? error.message : 'โหลดรายการไม่สำเร็จ')).finally(() => setLoading(false));
  }, [expenseId]);

  function change(name: keyof FormState) { return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm(current => ({ ...current, [name]: event.target.value })); }
  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    setError(''); setOcrText(''); setAutofilled(false);
    const next = event.target.files?.[0]; if (!next) return;
    try { validateFile(next); if (preview) URL.revokeObjectURL(preview); setFile(next); setPreview(URL.createObjectURL(next)); }
    catch (error) { setError(thaiError(error, 'ไฟล์ไม่ถูกต้อง')); event.target.value = ''; }
  }
  async function scan() {
    if (!file) return;
    setReading(true); setProgress(0); setError('');
    try {
      const text = await readReceipt(file, setProgress); const guess = parseReceipt(text); setOcrText(text);
      setForm(current => ({ ...current, title: guess.title || current.title, amount: guess.amount ? String(guess.amount) : current.amount, date: guess.date || current.date, category: guess.category })); setAutofilled(true);
    } catch { setError('อ่านข้อความไม่สำเร็จ กรุณาลองรูปที่ชัดขึ้น หรือกรอกข้อมูลเอง'); }
    finally { setReading(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (receipt && !file) return setError('กรุณาเลือกรูปใบเสร็จ');
    setBusy(true); setError('');
    const draft: Draft = { title: form.title, amount: Number(form.amount), category: form.category, expense_date: form.date, note: form.note, receipt_path: null };
    try { await saveExpense(draft, receipt ? file : null, expenseId); router.push('/dashboard'); }
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
        {!preview ? <label className="dropzone" htmlFor="receipt"><Upload size={32}/><strong>แตะเพื่อเลือกรูปใบเสร็จ</strong><span>รองรับ JPG, PNG และ WebP ไม่เกิน 5 MB</span><input id="receipt" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectFile}/></label> : <div className="receipt-preview"><Image unoptimized width={700} height={900} src={preview} alt="ตัวอย่างใบเสร็จที่เลือก"/><button className="icon-button preview-remove" aria-label="นำรูปออก" onClick={() => { URL.revokeObjectURL(preview); setPreview(''); setFile(null); }}><X size={18}/></button></div>}
        <button type="button" className="btn btn-secondary w-full" disabled={!file || reading || busy} onClick={scan}>{reading ? <><LoaderCircle className="spin" size={18}/>กำลังอ่าน {progress}%</> : <><Sparkles size={18}/>อ่านข้อความและกรอกให้อัตโนมัติ</>}</button>
        {autofilled && <p className="success-note"><CheckCircle2 size={18}/>กรอกข้อมูลที่ตรวจพบแล้ว กรุณาตรวจสอบอีกครั้ง</p>}
        {ocrText && <details className="ocr-details"><summary>ดูข้อความดิบที่อ่านได้</summary><pre>{ocrText}</pre></details>}
      </section>}
      <form className="card expense-fields" onSubmit={submit}><div className="step-heading"><span>{receipt ? '2' : <FileImage size={18}/>}</span><div><h2>รายละเอียดค่าใช้จ่าย</h2><p>ช่องที่มี * จำเป็นต้องกรอก</p></div></div>
        {editing && hasReceipt && <p className="info-note"><Camera size={18}/>รายการนี้มีรูปใบเสร็จแนบอยู่</p>}
        <div className="form-grid"><div className="full"><label htmlFor="title">ชื่อรายการหรือร้านค้า *</label><input id="title" value={form.title} onChange={change('title')} required maxLength={120} placeholder="เช่น อาหารกลางวัน ร้านกาแฟ"/></div><div><label htmlFor="amount">จำนวนเงิน (บาท) *</label><input id="amount" value={form.amount} onChange={change('amount')} type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" required placeholder="0.00"/></div><div><label htmlFor="date">วันที่ *</label><input id="date" value={form.date} onChange={change('date')} type="date" required/></div><div className="full"><label htmlFor="category">หมวดหมู่ *</label><select id="category" value={form.category} onChange={change('category')}>{categories.map(category => <option value={category} key={category}>{categoryLabel(category)}</option>)}</select></div><div className="full"><label htmlFor="note">หมายเหตุ</label><textarea id="note" value={form.note} onChange={change('note')} maxLength={2000} rows={4} placeholder="รายละเอียดเพิ่มเติม เช่น ซื้อสำหรับงานกลุ่ม"/><small className="char-count">{form.note.length}/2,000</small></div></div>
        {receipt && demo && <p className="info-note">โหมดทดลองอ่าน OCR ได้ แต่ต้องเข้าสู่ระบบก่อนบันทึกรูป</p>}
        <div className="form-actions"><Link className="btn btn-secondary" href="/dashboard">ยกเลิก</Link><button disabled={busy || reading || (receipt && demo)} className="btn btn-primary">{busy ? <><LoaderCircle className="spin" size={18}/>กำลังบันทึก…</> : <><Save size={18}/>{editing ? 'บันทึกการแก้ไข' : 'บันทึกรายจ่าย'}</>}</button></div>
      </form>
    </div>
  </>;
}
