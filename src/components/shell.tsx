'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Camera, CircleUserRound, LayoutDashboard, LogOut, PlusCircle, Settings } from 'lucide-react';
import { getProfile } from '@/lib/profile';
import { configIncomplete, isDemoMode, stopDemoMode, supabase } from '@/lib/supabase';
import { thaiError } from '@/lib/errors';

const navigation = [
  { href: '/dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
  { href: '/expenses/new', label: 'เพิ่มรายจ่าย', icon: PlusCircle },
  { href: '/receipts/upload', label: 'สแกนใบเสร็จ', icon: Camera },
  { href: '/settings', label: 'ตั้งค่า', icon: Settings },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter();
  const [ready, setReady] = useState(!supabase);
  const [name, setName] = useState('ผู้ใช้ทดลอง');
  const [email, setEmail] = useState('โหมดทดลอง');
  const [error, setError] = useState('');
  const demo = isDemoMode();
  useEffect(() => {
    let active = true;
    const currentDemo = isDemoMode();
    const sessionTimeout = supabase && !currentDemo ? window.setTimeout(() => { if (active) { setError('ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ กรุณาเข้าสู่ระบบใหม่'); router.replace('/login'); } }, 6000) : undefined;
    async function initialize() {
      try {
        if (supabase && !currentDemo) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (!data.session) { router.replace('/login'); return; }
          window.clearTimeout(sessionTimeout);
          if (active) setReady(true);
        }
        const profile = await getProfile();
        if (active) { setName(profile.display_name); setEmail(profile.email); setReady(true); }
      } catch (error) { if (active) { setError(thaiError(error, 'เปิดพื้นที่ของคุณไม่สำเร็จ')); router.replace('/login'); } }
    }
    initialize();
    if (!supabase || currentDemo) return () => { active = false; };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (!session) router.replace('/login'); });
    return () => { active = false; window.clearTimeout(sessionTimeout); subscription.unsubscribe(); };
  }, [router, pathname]);
  useEffect(() => {
    const refreshProfile = () => { getProfile().then(profile => { setName(profile.display_name); setEmail(profile.email); }).catch(() => undefined); };
    window.addEventListener('pocket-profile-updated', refreshProfile);
    return () => window.removeEventListener('pocket-profile-updated', refreshProfile);
  }, []);

  if (configIncomplete) return <main className="state-page">กรุณาตั้งค่า URL และ key ของ Supabase ให้ครบทั้งสองค่าใน .env.local แล้วเริ่มแอปใหม่</main>;
  if (!ready) return <main className="state-page" role="status"><span className="spinner"/>{error || 'กำลังเปิดพื้นที่ของคุณ…'}</main>;
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/dashboard" className="brand brand-large"><span>◈</span> pocket.</Link>
      <p className="sidebar-label">เมนูหลัก</p>
      <nav className="desktop-nav">{navigation.map(item => <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)}/>)}</nav>
      <div className="sidebar-tip"><strong>ใช้จ่ายอย่างรู้ตัว</strong><p>บันทึกวันนี้ เพื่อเห็นภาพการเงินที่ชัดขึ้นทุกวัน</p></div>
      <div className="account-summary"><div className="avatar"><CircleUserRound size={22}/></div><div className="min-w-0"><strong>{name}</strong><span>{email}</span></div><button className="icon-button" aria-label={demo ? 'ออกจากโหมดทดลอง' : 'ออกจากระบบ'} title={demo ? 'ออกจากโหมดทดลอง' : 'ออกจากระบบ'} onClick={async () => { if (demo) { stopDemoMode(); router.replace('/login'); return; } const { error } = await supabase!.auth.signOut(); if (error) setError(error.message); else router.replace('/login'); }}><LogOut size={18}/></button></div>
    </aside>
    <div className="app-content">
      <header className="topbar"><Link href="/dashboard" className="brand mobile-brand"><span>◈</span> pocket.</Link><div><span className="status-dot"/>{demo ? 'โหมดทดลอง' : 'เชื่อมต่อแล้ว'}</div></header>
      <main className="page-container">{demo && <div className="demo-banner"><strong>โหมดทดลอง</strong><span>ข้อมูลเก็บในเบราว์เซอร์นี้เท่านั้น และยังไม่สามารถเก็บรูปใบเสร็จได้</span></div>}{error && <p role="alert" className="alert alert-error">{error}</p>}{children}</main>
    </div>
    <nav className="bottom-nav">{navigation.map(item => <NavLink key={item.href} {...item} active={pathname.startsWith(item.href)}/>)}</nav>
  </div>;
}

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: typeof LayoutDashboard; active: boolean }) {
  return <Link href={href} className={active ? 'nav-link active' : 'nav-link'}><Icon size={20}/><span>{label}</span></Link>;
}
