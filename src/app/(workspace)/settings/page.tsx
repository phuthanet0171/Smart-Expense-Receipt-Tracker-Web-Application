'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AtSign, BellRing, KeyRound, LoaderCircle, Save, ShieldCheck, UserRound, WalletCards } from 'lucide-react';
import { getProfile, updateEmail, updatePassword, updateProfile } from '@/lib/profile';
import { isDemoMode } from '@/lib/supabase';
import { thaiError } from '@/lib/errors';

export default function SettingsPage() {
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(''); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  const demo = isDemoMode();
  useEffect(() => { getProfile().then(profile => { setName(profile.display_name); setEmail(profile.email); setBudget(profile.monthly_budget ? String(profile.monthly_budget) : ''); }).catch(error => setError(error.message)).finally(() => setLoading(false)); }, []);
  async function run(key: string, task: () => Promise<void>, success: string) { setBusy(key); setError(''); setMessage(''); try { await task(); setMessage(success); } catch (error) { setError(thaiError(error, 'บันทึกไม่สำเร็จ')); } finally { setBusy(''); } }
  if (loading) return <div className="state-page"><span className="spinner"/>กำลังโหลดการตั้งค่า…</div>;
  return <><header className="page-heading compact"><div><p className="eyebrow">บัญชีและการตั้งค่า</p><h1>ตั้งค่าโปรไฟล์</h1><p>จัดการข้อมูลส่วนตัว ความปลอดภัย และงบประมาณของคุณ</p></div></header>{error && <p role="alert" className="alert alert-error">{error}</p>}{message && <p role="status" className="alert alert-success">{message}</p>}
    <div className="settings-layout"><section className="card settings-card"><div className="settings-title"><div><UserRound/></div><span><h2>ข้อมูลโปรไฟล์</h2><p>ข้อมูลที่ใช้แสดงภายในแอป</p></span></div><form className="form-stack" onSubmit={(event: FormEvent) => { event.preventDefault(); run('profile', () => updateProfile(name, budget ? Number(budget) : null), 'บันทึกโปรไฟล์เรียบร้อยแล้ว'); }}><div><label htmlFor="name">ชื่อที่แสดง</label><input id="name" value={name} onChange={event => setName(event.target.value)} minLength={2} maxLength={60} required/></div><div><label htmlFor="budget">งบประมาณต่อเดือน (บาท)</label><div className="input-wrap"><WalletCards size={18}/><input id="budget" value={budget} onChange={event => setBudget(event.target.value)} type="number" inputMode="decimal" min="1" step="0.01" placeholder="เช่น 15000"/></div><small className="field-help">เว้นว่างได้ หากยังไม่ต้องการตั้งงบประมาณ</small></div><button className="btn btn-primary" disabled={Boolean(busy)}>{busy === 'profile' ? <LoaderCircle className="spin" size={18}/> : <Save size={18}/>}บันทึกโปรไฟล์</button></form></section>
      <section className="card settings-card"><div className="settings-title"><div><AtSign/></div><span><h2>เปลี่ยนอีเมล</h2><p>ระบบอาจส่งอีเมลยืนยันไปยังที่อยู่เดิมและใหม่</p></span></div><form className="form-stack" onSubmit={(event: FormEvent) => { event.preventDefault(); run('email', () => updateEmail(email), 'ส่งคำขอเปลี่ยนอีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย'); }}><div><label htmlFor="email">อีเมลใหม่</label><input id="email" value={email} onChange={event => setEmail(event.target.value)} type="email" required disabled={demo}/></div><button className="btn btn-secondary" disabled={demo || Boolean(busy)}>{busy === 'email' ? <LoaderCircle className="spin" size={18}/> : <AtSign size={18}/>}เปลี่ยนอีเมล</button>{demo && <small className="field-help">เข้าสู่ระบบเพื่อใช้ฟังก์ชันนี้</small>}</form></section>
      <PasswordCard busy={busy} run={run} disabled={demo}/>
      <section className="card security-note"><ShieldCheck size={28}/><div><h2>ข้อมูลของคุณเป็นส่วนตัว</h2><p>รายการและใบเสร็จถูกจำกัดสิทธิ์ตามบัญชีด้วย Row Level Security รูปใบเสร็จเปิดผ่านลิงก์ชั่วคราวเท่านั้น</p></div></section>
    </div>
  </>;
}

function PasswordCard({ busy, run, disabled }: { busy: string; run: (key: string, task: () => Promise<void>, success: string) => void; disabled: boolean }) {
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  return <section className="card settings-card"><div className="settings-title"><div><KeyRound/></div><span><h2>เปลี่ยนรหัสผ่าน</h2><p>ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษรและไม่ซ้ำกับบริการอื่น</p></span></div><form className="form-stack" onSubmit={(event: FormEvent) => { event.preventDefault(); if (password !== confirm) return run('password', async () => { throw new Error('รหัสผ่านทั้งสองช่องไม่ตรงกัน'); }, ''); run('password', async () => { await updatePassword(password); setPassword(''); setConfirm(''); }, 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว'); }}><div><label htmlFor="new-password">รหัสผ่านใหม่</label><input id="new-password" value={password} onChange={event => setPassword(event.target.value)} type="password" minLength={8} autoComplete="new-password" required disabled={disabled}/></div><div><label htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label><input id="confirm-password" value={confirm} onChange={event => setConfirm(event.target.value)} type="password" minLength={8} autoComplete="new-password" required disabled={disabled}/></div><button className="btn btn-secondary" disabled={disabled || Boolean(busy)}>{busy === 'password' ? <LoaderCircle className="spin" size={18}/> : <KeyRound size={18}/>}เปลี่ยนรหัสผ่าน</button></form><div className="session-note"><BellRing size={17}/>หลังเปลี่ยนรหัสผ่าน ควรเข้าสู่ระบบใหม่บนอุปกรณ์อื่น</div></section>;
}
