import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Pocket — เข้าใจทุกการใช้จ่าย',
    short_name: 'Pocket',
    description: 'บันทึกรายจ่าย สแกนใบเสร็จ และดูภาพรวมการเงิน',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f5f6f8',
    theme_color: '#7255d9',
    lang: 'th',
    icons: [{ src: '/pocket-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
