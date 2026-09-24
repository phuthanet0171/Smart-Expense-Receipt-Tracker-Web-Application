# Pocket — Smart Expense & Receipt Tracker

เว็บจัดการรายจ่ายภาษาไทยสำหรับพอร์ต Full Stack สร้างด้วย Next.js, TypeScript, Tailwind CSS, Supabase และ Tesseract.js รองรับคอมพิวเตอร์และมือถือ

## ฟีเจอร์

- สมัครสมาชิกและเข้าสู่ระบบด้วย Supabase Auth
- แก้ชื่อที่แสดง อีเมล รหัสผ่าน และงบประมาณรายเดือน
- เพิ่ม แก้ไข ลบ ค้นหา กรอง และส่งออกรายจ่ายเป็น CSV
- Dashboard พร้อมกราฟรายสัปดาห์ สัดส่วนหมวดหมู่ และงบคงเหลือ
- เก็บรูปใบเสร็จแบบ private ใน Supabase Storage
- OCR ภาษาไทยและอังกฤษ พร้อมเดาชื่อร้าน ยอด วันที่ และหมวดหมู่
- UI ภาษาไทยและเมนูด้านล่างที่เหมาะกับมือถือ
- โหมดทดลองโดยเก็บข้อมูลในเบราว์เซอร์

## เริ่มใช้งาน

ต้องมี Node.js 20.9 ขึ้นไป เปิด terminal ในโฟลเดอร์โปรเจกต์แล้วรัน:

```powershell
npm ci
```

Command Prompt:

```bat
copy .env.example .env.local
```

PowerShell:

```powershell
Copy-Item .env.example .env.local
```

จากนั้นรัน `npm run dev` และเปิด http://localhost:3000

หาก `npm ci` แจ้ง `EPERM` ให้หยุด dev server เดิมด้วย `Ctrl+C` และปิดโปรแกรมที่กำลังใช้ไฟล์ใน `node_modules` แล้วลองใหม่

## ตั้งค่า Supabase

1. สร้าง Supabase project และเปิด SQL Editor
2. โปรเจกต์ใหม่ให้รัน `supabase/schema.sql`
3. โปรเจกต์ที่เคยใช้ schema รุ่นแรกให้รัน `supabase/migrations/20260924_quality_upgrade.sql`
4. โปรเจกต์เดิมให้รัน `supabase/migrations/20260925_receipt_intelligence.sql` เพื่อเพิ่มข้อมูลใบเสร็จและรายการสินค้า
5. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ Project URL และ publishable key หรือ legacy anon key

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

ห้ามใส่ `service_role` หรือ secret key ในตัวแปร `NEXT_PUBLIC_*` และห้าม commit `.env.local`

ใน Authentication → URL Configuration ให้ตั้ง Site URL เป็น `http://localhost:3000` และเพิ่ม Redirect URLs สำหรับ `/dashboard`, `/reset-password` และ `/settings` ทั้ง local และ production

## OCR

OCR ทำงานในเบราว์เซอร์ด้วยโมเดล `tha+eng` โดยไม่ส่งรูปไป paid AI API ระบบจะ:

1. ขยายภาพ ปรับเป็นขาวดำ เพิ่ม contrast และเติมขอบขาว
2. หมุนภาพอัตโนมัติและอ่านข้อความทั้งใบ
3. หากยังไม่มั่นใจ จะอ่านบริเวณที่มักมียอดเงินซ้ำด้วยโหมดข้อความกระจาย
4. ให้น้ำหนัก “ยอดที่ต้องชำระ”, “ยอดสุทธิ” และ “TOTAL DUE” สูงกว่า VAT เงินสดรับ เงินทอน ส่วนลด เลขมิเตอร์ และจำนวนหน่วย
5. ตรวจความสัมพันธ์ `ยอดรวม − ส่วนลด = ยอดสุทธิ` แม้ OCR อ่านชื่อหัวข้อไม่ครบ
6. ตรวจบรรทัดสรุปจำนวนสินค้า เช่น `6 ชิ้น 100.00` และการพิมพ์ยอดซ้ำในส่วนรับชำระ
7. แสดงยอดที่เป็นไปได้หลายค่าให้แตะเลือกก่อนบันทึก

ระบบวันที่รองรับ ค.ศ., พ.ศ. สี่หลัก, พ.ศ. แบบสองหลัก, เลขไทย, วันที่ ISO, ชื่อเดือนอังกฤษ และชื่อหรือตัวย่อเดือนไทยตั้งแต่ `ม.ค.` ถึง `ธ.ค.` หากพบหลายวันที่ ระบบจะให้น้ำหนักวันที่ทำรายการเหนือวันครบกำหนดและรอบบิล พร้อมแสดงตัวเลือกให้ผู้ใช้ตรวจสอบก่อนบันทึก วันที่ที่เป็นไปไม่ได้จะถูกปฏิเสธ

ก่อนสแกน ผู้ใช้สามารถลากภาพเพื่อครอบใบเสร็จ ซูม หมุน และจัดความเอียงอัตโนมัติ ระบบตรวจความละเอียด แสง contrast และความคมชัด พร้อมแจ้งเมื่อควรถ่ายใหม่ ผลการสแกนเก็บเลขใบเสร็จ เลขผู้เสียภาษี สาขา เวลา ยอดก่อนส่วนลด ส่วนลด ภาษี วิธีชำระ รายการสินค้า ข้อความ OCR คุณภาพภาพ และคะแนนความมั่นใจของแต่ละช่องในตาราง `receipts` และ `receipt_items`

รองรับ JPG, PNG และ WebP ขนาดไม่เกิน 5 MB ควรถ่ายให้กระดาษเต็มภาพ วางตรง แสงสม่ำเสมอ และเห็นยอดชัด ผู้ใช้ยังควรเทียบยอดกับรูปก่อนบันทึก เพราะ Tesseract อาจอ่านภาพเบลอ กระดาษยับ หรือฟอนต์เฉพาะผิดได้

## ตรวจสอบคุณภาพ

```powershell
npm test
npm run lint
npm run build
```

ชุดทดสอบ OCR ครอบคลุมบิลค่าไฟ, ใบเสร็จ 7-Eleven, ยอดที่อยู่บรรทัดถัดไป และกรณีที่ระบบมีความมั่นใจต่ำ

## ความปลอดภัย

- ตาราง `profiles` และ `expenses` เปิด Row Level Security
- ผู้ใช้เข้าถึงเฉพาะข้อมูลและไฟล์ในโฟลเดอร์ user ID ของตน
- Bucket `receipts` เป็น private และเปิดรูปด้วย signed URL ชั่วคราว
- OCR ทำงานฝั่ง client รูปจะไม่ออกจากอุปกรณ์จนกดบันทึก

## เส้นทางสำคัญ

- `/register`, `/login`, `/forgot-password`, `/reset-password`
- `/dashboard`
- `/expenses/new`, `/expenses/[id]/edit`
- `/receipts/upload`
- `/settings`
