'use client';
import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { thaiError } from '@/lib/errors';
export default function ForgotPassword() {
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try { if (!supabase) throw new Error('กรุณาเชื่อมต่อ Supabase ก่อน'); const email = String(new FormData(event.currentTarget).get('email')); const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' }); if (error) throw error; setMessage('ส่งลิงก์ตั้งรหัสผ่านใหม่แล้ว กรุณาตรวจสอบอีเมล'); }
    catch (error) { setMessage(thaiError(error, 'ส่งอีเมลไม่สำเร็จ')); } finally { setBusy(false); }
  }
  return <SimpleAuth title="ลืมรหัสผ่าน" description="กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ให้"><form className="form-stack" onSubmit={submit}><div><label htmlFor="email">อีเมล</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="name@example.com"/></div><button disabled={busy} className="btn btn-primary w-full">{busy ? 'กำลังส่ง…' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}</button></form>{message && <p role="status" className="form-message">{message}</p>}<Link href="/login" className="text-link block text-center mt-6">กลับไปเข้าสู่ระบบ</Link></SimpleAuth>;
}
function SimpleAuth({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <main className="simple-auth"><section className="auth-card"><Link href="/" className="brand brand-large"><span>◈</span> pocket.</Link><h1>{title}</h1><p className="muted mb-8">{description}</p>{children}</section></main>; }
