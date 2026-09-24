import assert from 'node:assert/strict';
import test from 'node:test';
import { thaiError } from './errors';

test('แสดงข้อความจาก Supabase object แทน object Object', () => {
  assert.equal(thaiError({ message: 'บันทึกข้อมูลไม่สำเร็จ', details: 'รายละเอียดทดสอบ', code: 'TEST01' }), 'บันทึกข้อมูลไม่สำเร็จ — รายละเอียดทดสอบ — TEST01');
});

test('แนะนำ migration เมื่อไม่พบฟังก์ชันฐานข้อมูลใบเสร็จ', () => {
  assert.match(thaiError({ message: 'Could not find the function public.save_receipt_analysis in the schema cache', code: 'PGRST202' }), /20260925_receipt_intelligence\.sql/);
});

test('แปลข้อผิดพลาด RLS เป็นข้อความที่ทำตามได้', () => {
  assert.match(thaiError({ message: 'new row violates row-level security policy', code: '42501' }), /เข้าสู่ระบบใหม่/);
});
