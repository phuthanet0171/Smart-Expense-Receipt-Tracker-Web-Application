# Pocket — Smart Expense & Receipt Tracker

เว็บจัดการรายจ่ายภาษาไทยสำหรับพอร์ต Full Stack สร้างด้วย Next.js, TypeScript, Tailwind CSS, Supabase และ Tesseract.js ออกแบบให้ใช้ได้ทั้งคอมพิวเตอร์และมือถือ

## ฟีเจอร์

- สมัครสมาชิกด้วยชื่อผู้ใช้งาน อีเมล รหัสผ่าน และยืนยันรหัสผ่าน
- เข้าสู่ระบบ ยืนยันอีเมล ลืมรหัสผ่าน และตั้งรหัสผ่านใหม่
- แก้ชื่อที่แสดง อีเมล รหัสผ่าน และงบประมาณรายเดือน
- เพิ่ม แก้ไข และลบรายการค่าใช้จ่าย
- เก็บรูปใบเสร็จแบบ private และเปิดผ่าน signed URL ชั่วคราว
- OCR ภาษาไทยและอังกฤษ พร้อมเดาชื่อร้าน ยอดรวม วันที่ และหมวดหมู่
- Dashboard ภาษาไทย พร้อมกราฟรายสัปดาห์ สัดส่วนหมวดหมู่ และงบคงเหลือ
- กรองตามเดือน/หมวดหมู่ ค้นหา และส่งออก CSV
- Responsive UI พร้อมเมนูด้านล่างสำหรับมือถือ
- โหมดทดลองเข้าได้ทันทีแม้ตั้งค่า Supabase แล้ว โดยแยกข้อมูลไว้ในเบราว์เซอร์
- Web App Manifest และ safe-area layout สำหรับติดตั้ง/ใช้งานบนมือถือ

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

จากนั้น:

```powershell
npm run dev
```

เปิด http://localhost:3000

หาก `npm ci` แจ้ง `EPERM` ให้ปิด dev server เดิมด้วย `Ctrl+C` รวมถึงโปรแกรมที่เปิดไฟล์ใน `node_modules` แล้วรันใหม่

## ตั้งค่า Supabase

1. สร้าง Supabase project
2. เปิด SQL Editor
3. โปรเจกต์ใหม่: รัน `supabase/schema.sql`
4. โปรเจกต์ที่เคยใช้ schema รุ่นแรก: รัน `supabase/migrations/20260924_quality_upgrade.sql` ไฟล์นี้สร้าง profiles และ policy เพิ่มเติมโดยรักษาข้อมูลรายจ่ายเดิม
5. ใส่ Project URL และ publishable key หรือ legacy anon key ใน `.env.local`

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

ห้ามใส่ `service_role` หรือ secret key ในตัวแปร `NEXT_PUBLIC_*` และห้าม commit `.env.local`

ใน Authentication → URL Configuration ให้ตั้ง:

- Site URL สำหรับ local: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/dashboard`, `http://localhost:3000/reset-password`, `http://localhost:3000/settings`
- เมื่อ deploy ให้เพิ่ม URL ของ production ทั้งสามเส้นทาง

ถ้าเปิด Confirm email ผู้ใช้ต้องยืนยันอีเมลก่อนเข้าสู่ระบบ การเปลี่ยนอีเมลอาจต้องยืนยันทั้งอีเมลเดิมและอีเมลใหม่ตามการตั้งค่าของ Supabase

## OCR

Tesseract.js ทำงานในเบราว์เซอร์และโหลดโมเดล `tha+eng` ตอนใช้งานครั้งแรก จากนั้น parser จะเดาข้อมูลสำคัญและกรอกฟอร์มให้ ผู้ใช้ต้องตรวจสอบก่อนบันทึกเสมอ เพราะรูปที่เอียง เบลอ หรือรูปแบบใบเสร็จที่ต่างกันอาจทำให้เดาผิด

รองรับ JPG, PNG และ WebP ขนาดไม่เกิน 5 MB รูปจะถูกอัปโหลดเข้า Supabase Storage เมื่อกดบันทึก ไม่ได้ถูกส่งไปยัง paid AI API

## ความปลอดภัย

- ตาราง profiles และ expenses เปิด Row Level Security
- ผู้ใช้เข้าถึงเฉพาะโปรไฟล์ รายจ่าย และไฟล์ในโฟลเดอร์ user ID ของตน
- Bucket `receipts` เป็น private
- ไม่ใช้ service role ใน browser
- ฟอร์มและฐานข้อมูลตรวจความยาวชื่อ จำนวนเงิน หมวดหมู่ และขนาดไฟล์
- การลบรายจ่ายลบแถวก่อน แล้วจึงลบรูปที่เกี่ยวข้อง เพื่อลดความเสี่ยงข้อมูลหลักค้างใน UI
- OCR ทำงานฝั่ง client รูปจะไม่ออกจากอุปกรณ์จนกดบันทึก

## ตรวจสอบก่อน deploy

```powershell
npm run lint
npm run build
npm start
```

ควรทดสอบด้วยบัญชี Supabase สองบัญชี เพื่อยืนยัน RLS ว่าบัญชีหนึ่งอ่าน แก้ หรือลบข้อมูลและรูปของอีกบัญชีไม่ได้ จากนั้นทดสอบสมัคร/ยืนยันอีเมล, reset password, เปลี่ยนอีเมล, เปลี่ยนรหัสผ่าน, OCR บนใบเสร็จจริง และหน้าจอมือถือ

## เส้นทางสำคัญ

- `/register`, `/login`, `/forgot-password`, `/reset-password`
- `/dashboard`
- `/expenses/new`, `/expenses/[id]/edit`
- `/receipts/upload`
- `/settings`

## แนวทางการออกแบบ

Dashboard และการตั้งงบยึดแนวคิดการมองสถานะได้ทันทีจาก [YNAB](https://www.ynab.com/features) ส่วนการค้นหา ตัวกรอง และการจัดการธุรกรรมบนมือถืออ้างอิงแนวทางจาก [Monarch Money](https://www.monarch.com/quicker-and-easier-transaction-review-and-more) โดยปรับให้เรียบง่ายและเหมาะกับผู้ใช้ภาษาไทย

## ข้อจำกัดที่ควรรู้

- OCR เป็นการเดา ไม่ใช่ข้อมูลที่รับรองความถูกต้อง
- Dashboard ดึงสูงสุด 500 รายการต่อเดือน ซึ่งเพียงพอสำหรับการใช้งานส่วนบุคคลทั่วไป
- การบันทึกรูปและแถวฐานข้อมูลเป็นคนละบริการ หากเกิดเหตุผิดปกติระหว่างสองขั้นตอน ระบบจะพยายามล้างไฟล์ที่เพิ่งอัปโหลด
- การใช้งานจริงขึ้นกับโควตาและเงื่อนไขของ Supabase/Vercel plan ที่เลือก
#   S m a r t - E x p e n s e  
 