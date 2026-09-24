import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Pocket — เข้าใจทุกการใช้จ่าย', description: 'บันทึกรายจ่าย สแกนใบเสร็จ และดูภาพรวมการเงินของคุณในที่เดียว' };
export const viewport: Viewport = { themeColor: '#7255d9', width: 'device-width', initialScale: 1, viewportFit: 'cover' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="th"><body>{children}</body></html>; }
