'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { configIncomplete, startDemoMode, stopDemoMode, supabase } from '@/lib/supabase';
import { thaiError } from '@/lib/errors';

export default function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const values = new FormData(event.currentTarget);
    const displayName = String(values.get('display_name') || '').trim();
    const email = String(values.get('email')).trim();
    const password = String(values.get('password'));
    const confirmation = String(values.get('confirm_password') || '');
    if (register && displayName.length < 2) return setMessage('กรุณากรอกชื่อผู้ใช้งานอย่างน้อย 2 ตัวอักษร');
    if (register && password !== confirmation) return setMessage('รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน');
    if (!supabase) return setMessage(configIncomplete ? 'ตั้งค่า Supabase ให้ครบทั้ง URL และ key' : 'ยังไม่ได้เชื่อม Supabase คุณสามารถใช้โหมดทดลองได้');
    setBusy(true);
    try {
      const { data, error } = register
        ? await supabase.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin + '/dashboard' } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) { stopDemoMode(); router.replace('/dashboard'); }
      else setMessage('สมัครสำเร็จแล้ว กรุณาเปิดอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบ');
    } catch (error) {
      setMessage(thaiError(error, 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่'));
    } finally { setBusy(false); }
  }

  return <main className="auth-layout">
    <section className="auth-story">
      <Link href="/" className="brand brand-large"><span>◈</span> pocket.</Link>
      <div>
        <p className="eyebrow">เข้าใจเงินของคุณในทุกวัน</p>
        <h1>ใช้จ่ายอย่างรู้ตัว<br/>และสบายใจกว่าเดิม</h1>
        <p>บันทึกรายจ่าย อ่านใบเสร็จ และดูภาพรวมทั้งหมด<br/>ในพื้นที่ส่วนตัวที่เรียบง่าย</p>
      </div>
      <p className="auth-footnote">ผู้ช่วยจัดการรายจ่ายและใบเสร็จของคุณ</p>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <Link href="/" className="brand mobile-brand"><span>◈</span> pocket.</Link>
        <p className="eyebrow">{register ? 'เริ่มต้นใช้งานฟรี' : 'ยินดีต้อนรับกลับมา'}</p>
        <h2>{register ? 'สร้างบัญชีของคุณ' : 'เข้าสู่ระบบ'}</h2>
        <p className="muted">{register ? 'ใช้เวลาไม่ถึงหนึ่งนาที' : 'จัดการค่าใช้จ่ายของคุณต่อจากครั้งก่อน'}</p>
        <form className="form-stack" onSubmit={submit}>
          {register && <Field icon={<UserRound size={18}/>} label="ชื่อผู้ใช้งาน" name="display_name" autoComplete="name" placeholder="ชื่อที่ต้องการให้แสดง" minLength={2}/>} 
          <Field icon={<Mail size={18}/>} label="อีเมล" name="email" type="email" autoComplete="email" placeholder="name@example.com"/>
          <div>
            <label htmlFor="password">รหัสผ่าน</label>
            <div className="input-wrap"><LockKeyhole size={18}/><input id="password" name="password" type={showPassword ? 'text' : 'password'} minLength={8} autoComplete={register ? 'new-password' : 'current-password'} required placeholder="อย่างน้อย 8 ตัวอักษร"/><button type="button" className="icon-button" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div>
          </div>
          {register && <Field icon={<LockKeyhole size={18}/>} label="ยืนยันรหัสผ่าน" name="confirm_password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" minLength={8}/>} 
          {!register && <div className="text-right"><Link className="text-link text-sm" href="/forgot-password">ลืมรหัสผ่าน?</Link></div>}
          <button disabled={busy} className="btn btn-primary w-full">{busy ? 'กำลังดำเนินการ…' : register ? 'สร้างบัญชี' : 'เข้าสู่ระบบ'}</button>
        </form>
        {message && <p role="status" className="form-message">{message}</p>}
        <p className="auth-switch">{register ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'} <Link className="text-link" href={register ? '/login' : '/register'}>{register ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}</Link></p>
        {!configIncomplete && <button className="btn btn-secondary w-full mt-4" onClick={() => { startDemoMode(); router.push('/dashboard'); }}>ทดลองใช้โดยไม่สมัครสมาชิก</button>}
      </div>
    </section>
  </main>;
}

function Field({ icon, label, name, type = 'text', ...props }: { icon: React.ReactNode; label: string; name: string; type?: string; [key: string]: unknown }) {
  return <div><label htmlFor={name}>{label}</label><div className="input-wrap">{icon}<input id={name} name={name} type={type} required {...props}/></div></div>;
}
