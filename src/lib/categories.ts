export const categories = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Other'] as const;

export type Category = (typeof categories)[number];

export const categoryMeta: Record<Category, { label: string; color: string; soft: string }> = {
  Food: { label: 'อาหารและเครื่องดื่ม', color: '#7c5ce5', soft: '#eee9ff' },
  Transport: { label: 'การเดินทาง', color: '#369b86', soft: '#e6f6f1' },
  Shopping: { label: 'ช้อปปิ้ง', color: '#d58b36', soft: '#fff2df' },
  Bills: { label: 'บิลและบริการ', color: '#527fc1', soft: '#eaf1fb' },
  Health: { label: 'สุขภาพ', color: '#c65d8d', soft: '#fbe9f1' },
  Other: { label: 'อื่น ๆ', color: '#7c8799', soft: '#eef1f5' },
};

export function categoryLabel(category: Category) {
  return categoryMeta[category].label;
}

export function guessCategory(text: string): Category {
  const value = text.toLowerCase();
  const rules: Array<[Category, RegExp]> = [
    ['Transport', /grab|bolt|taxi|bts|mrt|รถไฟ|ทางด่วน|ปั๊ม|น้ำมัน|parking|ขนส่ง/],
    ['Food', /7-eleven|seven|lotus|big c|tops|makro|cafe|coffee|กาแฟ|อาหาร|restaurant|kfc|mcdonald|starbucks|ข้าว|ชา|นม/],
    ['Bills', /electric|water bill|internet|mobile|ais|true|dtac|ค่าไฟ|ค่าน้ำ|อินเทอร์เน็ต|โทรศัพท์/],
    ['Health', /hospital|clinic|pharmacy|drug|โรงพยาบาล|คลินิก|ยา|สุขภาพ/],
    ['Shopping', /central|shopee|lazada|uniqlo|ห้าง|เสื้อ|รองเท้า|สินค้า/],
  ];
  return rules.find(([, rule]) => rule.test(value))?.[0] ?? 'Other';
}
