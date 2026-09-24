'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { thaiError } from '@/lib/errors';
export default function ResetPassword() {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const password = String(form.get('password')); if (password !== String(form.get('confirm'))) return setMessage('รหัสผ่านไม่ตรงกัน'); setBusy(true); try { if (!supabase) throw new Error('กรุณาเชื่อมต่อ Supabase ก่อน'); const { error } = await supabase.auth.updateUser({ password }); if (error) throw error; setMessage('เปลี่ยนรหัสผ่านเรียบร้อยแล้ว คุณสามารถกลับไปใช้งานได้'); } catch (error) { setMessage(thaiError(error, 'เปลี่ยนรหัสผ่านไม่สำเร็จ')); } finally { setBusy(false); } }
  return <main className="simple-auth"><section className="auth-card"><Link href="/" className="brand brand-large"><span>◈</span> pocket.</Link><h1>ตั้งรหัสผ่านใหม่</h1><p className="muted mb-8">เลือกรหัสผ่านที่คาดเดายากและไม่ซ้ำกับเว็บไซต์อื่น</p><form className="form-stack" onSubmit={submit}><div><label htmlFor="password">รหัสผ่านใหม่</label><input id="password" name="password" type="password" minLength={8} required/></div><div><label htmlFor="confirm">ยืนยันรหัสผ่านใหม่</label><input id="confirm" name="confirm" type="password" minLength={8} required/></div><button disabled={busy} className="btn btn-primary w-full">{busy ? 'กำลังบันทึก…' : 'บันทึกรหัสผ่านใหม่'}</button></form>{message && <p role="status" className="form-message">{message}</p>}<Link href="/dashboard" className="text-link block text-center mt-6">กลับหน้าภาพรวม</Link></section></main>;
}
