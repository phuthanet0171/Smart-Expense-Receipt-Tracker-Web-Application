'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Camera, Download, Edit3, FileImage, Plus, Search, Trash2, TrendingDown, WalletCards } from 'lucide-react';
import { categoryLabel, categoryMeta, categories, Category } from '@/lib/categories';
import { deleteExpense, Expense, exportExpensesCsv, listExpenses, money, receiptUrl, today } from '@/lib/expenses';
import { getProfile } from '@/lib/profile';
import { ConfirmDialog, Toast } from '@/components/feedback';
import { thaiError } from '@/lib/errors';

export default function Dashboard() {
  const [rows, setRows] = useState<Expense[]>([]);
  const [month, setMonth] = useState(today().slice(0, 7));
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [budget, setBudget] = useState<number | null>(null);

  async function load() {
    setLoading(true); setError('');
    try { setRows(await listExpenses({ month })); }
    catch (error) { setError(thaiError(error, 'โหลดข้อมูลไม่สำเร็จ')); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    listExpenses({ month }).then(data => { if (active) setRows(data); }).catch(error => { if (active) setError(thaiError(error, 'โหลดข้อมูลไม่สำเร็จ')); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month]);
  useEffect(() => { getProfile().then(profile => setBudget(profile.monthly_budget)).catch(() => undefined); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('th');
    return rows.filter(row => (category === 'all' || row.category === category) && (!term || row.title.toLocaleLowerCase('th').includes(term) || row.note.toLocaleLowerCase('th').includes(term)));
  }, [rows, category, search]);
  const total = filtered.reduce((sum, row) => sum + row.amount, 0);
  const average = filtered.length ? total / filtered.length : 0;
  const groups = categories.map(name => ({ name, total: filtered.filter(row => row.category === name).reduce((sum, row) => sum + row.amount, 0) })).sort((a, b) => b.total - a.total);
  const biggest = [...filtered].sort((a, b) => b.amount - a.amount)[0];
  const daysInMonth = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const weeks = [0, 1, 2, 3, 4].map(index => filtered.filter(row => { const day = Number(row.expense_date.slice(8, 10)); return day > index * 7 && day <= Math.min((index + 1) * 7, daysInMonth); }).reduce((sum, row) => sum + row.amount, 0));
  const maxWeek = Math.max(...weeks, 1);
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    try { await deleteExpense(deleting.id); setDeleting(null); setToast('ลบรายการเรียบร้อยแล้ว'); await load(); }
    catch (error) { setError(thaiError(error, 'ลบรายการไม่สำเร็จ')); }
    finally { setDeleteBusy(false); }
  }

  async function openReceipt(path: string) {
    const popup = window.open('about:blank', '_blank');
    try { const url = await receiptUrl(path); if (popup) popup.location.replace(url); else setError('เบราว์เซอร์ปิดกั้นหน้าต่างใหม่ กรุณาอนุญาต pop-up แล้วลองอีกครั้ง'); }
    catch (error) { popup?.close(); setError(thaiError(error, 'เปิดใบเสร็จไม่สำเร็จ')); }
  }

  return <>
    <header className="page-heading"><div><p className="eyebrow">ภาพรวมการเงินของฉัน</p><h1>ภาพรวมค่าใช้จ่าย</h1><p>{monthLabel} · อัปเดตจากรายการที่บันทึก</p></div><div className="heading-actions"><button className="btn btn-secondary hide-mobile" disabled={!filtered.length} onClick={() => exportExpensesCsv(filtered)}><Download size={18}/>ส่งออก CSV</button><Link href="/expenses/new" className="btn btn-primary"><Plus size={18}/>เพิ่มรายจ่าย</Link></div></header>
    {error && <p role="alert" className="alert alert-error">{error}</p>}
    <section className="filter-bar" aria-label="ตัวกรองรายการ"><div><label htmlFor="month">เดือน</label><input id="month" type="month" value={month} onChange={event => { if (event.target.value) { setLoading(true); setMonth(event.target.value); } }}/></div><div><label htmlFor="category">หมวดหมู่</label><select id="category" value={category} onChange={event => setCategory(event.target.value as Category | 'all')}><option value="all">ทุกหมวดหมู่</option>{categories.map(value => <option value={value} key={value}>{categoryLabel(value)}</option>)}</select></div><div className="filter-search"><label htmlFor="search">ค้นหา</label><div className="input-wrap"><Search size={18}/><input id="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="ชื่อร้านหรือหมายเหตุ"/></div></div><button className="btn btn-secondary mobile-export" disabled={!filtered.length} onClick={() => exportExpensesCsv(filtered)}><Download size={18}/>CSV</button></section>
    <section className="stats-grid"><StatCard icon={<WalletCards/>} label="ใช้จ่ายทั้งหมด" value={money(total)} caption={`${filtered.length} รายการ`} accent/><StatCard icon={<TrendingDown/>} label={budget ? 'งบประมาณคงเหลือ' : 'เฉลี่ยต่อรายการ'} value={budget ? money(budget - total) : money(average)} caption={budget ? `ใช้ไป ${Math.min(total / budget * 100, 999).toFixed(0)}% จาก ${money(budget)}` : biggest ? `สูงสุด ${money(biggest.amount)}` : 'ตั้งงบได้ที่หน้าตั้งค่า'}/><StatCard icon={<Camera/>} label="รายการที่มีใบเสร็จ" value={String(filtered.filter(row => row.receipt_path).length)} caption="ตรวจสอบย้อนหลังได้"/></section>
    <section className="insights-grid">
      <article className="card chart-card"><div className="section-heading"><div><h2>แนวโน้มรายสัปดาห์</h2><p>ยอดใช้จ่ายแบ่งตามช่วงของเดือน</p></div></div><div className="bar-chart" aria-label="กราฟค่าใช้จ่ายรายสัปดาห์">{weeks.map((value, index) => <div className="bar-column" key={index}><span className="bar-value">{value ? new Intl.NumberFormat('th-TH', { notation: 'compact' }).format(value) : '0'}</span><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(value / maxWeek * 100, value ? 8 : 0)}%` }}/></div><span>สัปดาห์ {index + 1}</span></div>)}</div></article>
      <article className="card category-card"><div className="section-heading"><div><h2>สัดส่วนตามหมวดหมู่</h2><p>เรียงจากยอดสูงสุด</p></div></div>{total > 0 && <div className="donut" style={{ background: donutGradient(groups, total) }}><div><strong>{filtered.length}</strong><span>รายการ</span></div></div>}<div className="category-list">{groups.map(group => <div key={group.name}><span className="category-dot" style={{ background: categoryMeta[group.name].color }}/><span>{categoryLabel(group.name)}</span><strong>{money(group.total)}</strong></div>)}</div></article>
    </section>
    <section className="card transactions-card"><div className="section-heading"><div><h2>รายการค่าใช้จ่าย</h2><p>{filtered.length ? `พบ ${filtered.length} รายการ` : 'รายการที่ตรงกับตัวกรองจะแสดงที่นี่'}</p></div><Link href="/receipts/upload" className="text-link"><Camera size={17}/>สแกนใบเสร็จ</Link></div>{loading ? <TransactionSkeleton/> : !filtered.length ? <EmptyState/> : <div className="transaction-list">{filtered.map(row => <article className="transaction-row" key={row.id}><div className="category-icon" style={{ color: categoryMeta[row.category].color, background: categoryMeta[row.category].soft }}>{categoryLabel(row.category).charAt(0)}</div><div className="transaction-main"><strong>{row.title}</strong><span>{formatDate(row.expense_date)} · {categoryLabel(row.category)}{row.note ? ` · ${row.note}` : ''}</span></div><strong className="transaction-amount">{money(row.amount)}</strong><div className="transaction-actions">{row.receipt_path && <button className="icon-button" aria-label="ดูใบเสร็จ" title="ดูใบเสร็จ" onClick={() => openReceipt(row.receipt_path!)}><FileImage size={18}/></button>}<Link className="icon-button" aria-label="แก้ไขรายการ" title="แก้ไข" href={`/expenses/${row.id}/edit`}><Edit3 size={18}/></Link><button className="icon-button danger-icon" aria-label="ลบรายการ" title="ลบ" onClick={() => setDeleting(row)}><Trash2 size={18}/></button></div></article>)}</div>}</section>
    {deleting && <ConfirmDialog title="ลบรายการนี้หรือไม่?" description={`“${deleting.title}” จำนวน ${money(deleting.amount)} จะถูกลบและไม่สามารถกู้คืนได้`} busy={deleteBusy} onCancel={() => setDeleting(null)} onConfirm={remove}/>} {toast && <Toast message={toast} onClose={() => setToast('')}/>} 
  </>;
}

function StatCard({ icon, label, value, caption, accent = false }: { icon: React.ReactNode; label: string; value: string; caption: string; accent?: boolean }) { return <article className={accent ? 'stat-card accent' : 'stat-card'}><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{caption}</small></div></article>; }
function EmptyState() { return <div className="empty-state"><div><Plus size={28}/></div><h3>ยังไม่มีรายการในช่วงนี้</h3><p>เพิ่มด้วยตัวเองหรือสแกนใบเสร็จเพื่อเริ่มดูภาพรวม</p><Link href="/expenses/new" className="btn btn-primary"><Plus size={18}/>เพิ่มรายการแรก</Link></div>; }
function TransactionSkeleton() { return <div className="skeleton-list" role="status" aria-label="กำลังโหลดข้อมูล">{[1, 2, 3].map(value => <div key={value}/>)}</div>; }
function formatDate(value: string) { return new Date(value + 'T12:00:00').toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); }
function donutGradient(groups: Array<{ name: Category; total: number }>, total: number) { let cursor = 0; const stops = groups.filter(group => group.total).map(group => { const start = cursor; cursor += group.total / total * 100; return `${categoryMeta[group.name].color} ${start}% ${cursor}%`; }); return `conic-gradient(${stops.join(',')})`; }
