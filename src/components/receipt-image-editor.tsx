'use client';

import { PointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Check, Crop, RotateCcw, RotateCw, ScanLine } from 'lucide-react';

export type CropMetadata = { zoom: number; rotation: number; panX: number; panY: number; outputWidth: number; outputHeight: number };
type Props = { file: File; disabled?: boolean; onApply: (file: File, metadata: CropMetadata) => void };
type Point = { x: number; y: number };

function projectionScore(image: HTMLImageElement, angle: number) {
  const size = 320;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return 0;
  context.fillStyle = '#fff'; context.fillRect(0, 0, size, size);
  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight) * .92;
  context.translate(size / 2, size / 2); context.rotate(angle * Math.PI / 180);
  context.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
  const pixels = context.getImageData(0, 0, size, size).data;
  const rows = new Float32Array(size);
  for (let y = 0; y < size; y += 2) for (let x = 0; x < size; x += 2) {
    const index = (y * size + x) * 4;
    const gray = pixels[index] * .299 + pixels[index + 1] * .587 + pixels[index + 2] * .114;
    if (gray < 150) rows[y]++;
  }
  const mean = rows.reduce((sum, value) => sum + value, 0) / rows.length;
  return rows.reduce((sum, value) => sum + (value - mean) ** 2, 0);
}

export default function ReceiptImageEditor({ file, disabled, onApply }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ start: Point; origin: Point } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [applying, setApplying] = useState(false);
  const [imageVersion, setImageVersion] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.save();
    context.fillStyle = '#f5f3ee'; context.fillRect(0, 0, canvas.width, canvas.height);
    const radians = rotation * Math.PI / 180;
    const rotatedWidth = Math.abs(image.naturalWidth * Math.cos(radians)) + Math.abs(image.naturalHeight * Math.sin(radians));
    const rotatedHeight = Math.abs(image.naturalWidth * Math.sin(radians)) + Math.abs(image.naturalHeight * Math.cos(radians));
    const scale = Math.max(canvas.width / rotatedWidth, canvas.height / rotatedHeight) * zoom;
    context.translate(canvas.width / 2 + pan.x, canvas.height / 2 + pan.y);
    context.rotate(radians);
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(image, -image.naturalWidth * scale / 2, -image.naturalHeight * scale / 2, image.naturalWidth * scale, image.naturalHeight * scale);
    context.restore();
  }, [pan, rotation, zoom]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => { imageRef.current = image; setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); setImageVersion(value => value + 1); };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(draw, [draw, imageVersion]);

  function pointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { start: { x: event.clientX, y: event.clientY }, origin: pan };
  }
  function pointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current; if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = event.currentTarget.width / rect.width;
    setPan({ x: drag.origin.x + (event.clientX - drag.start.x) * scale, y: drag.origin.y + (event.clientY - drag.start.y) * scale });
  }
  function pointerUp() { dragRef.current = null; }
  function autoDeskew() {
    const image = imageRef.current; if (!image) return;
    let bestAngle = 0; let bestScore = -Infinity;
    for (let angle = -10; angle <= 10; angle += 1) {
      const score = projectionScore(image, angle);
      if (score > bestScore) { bestScore = score; bestAngle = angle; }
    }
    setRotation(bestAngle); setPan({ x: 0, y: 0 });
  }
  function apply() {
    const canvas = canvasRef.current; if (!canvas) return;
    setApplying(true);
    canvas.toBlob(blob => {
      setApplying(false);
      if (blob) onApply(new File([blob], `receipt-${Date.now()}.jpg`, { type: 'image/jpeg' }), { zoom, rotation, panX: Math.round(pan.x), panY: Math.round(pan.y), outputWidth: canvas.width, outputHeight: canvas.height });
    }, 'image/jpeg', .94);
  }

  return <div className="receipt-editor">
    <div className="editor-title"><Crop size={17}/><div><strong>จัดขอบใบเสร็จ</strong><span>ลากภาพให้ใบเสร็จเต็มกรอบ แล้วปรับความเอียง</span></div></div>
    <div className="crop-stage"><canvas ref={canvasRef} width={900} height={1200} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}/><div className="crop-guide" aria-hidden="true"/></div>
    <label className="editor-slider"><span>ซูม</span><input type="range" min="1" max="2.5" step=".01" value={zoom} onChange={event => setZoom(Number(event.target.value))}/></label>
    <label className="editor-slider"><span>ปรับเอียง</span><input type="range" min="-180" max="180" step=".2" value={rotation} onChange={event => setRotation(Number(event.target.value))}/><output>{rotation.toFixed(1)}°</output></label>
    <div className="editor-actions">
      <button type="button" className="btn btn-secondary" onClick={() => setRotation(value => value <= -90 ? value + 270 : value - 90)} aria-label="หมุนซ้าย"><RotateCcw size={17}/></button>
      <button type="button" className="btn btn-secondary" onClick={() => setRotation(value => value >= 90 ? value - 270 : value + 90)} aria-label="หมุนขวา"><RotateCw size={17}/></button>
      <button type="button" className="btn btn-secondary editor-auto" onClick={autoDeskew}><ScanLine size={17}/>จัดเอียงอัตโนมัติ</button>
      <button type="button" className="btn btn-primary editor-apply" disabled={disabled || applying} onClick={apply}><Check size={17}/>{applying ? 'กำลังเตรียม…' : 'ใช้ภาพนี้'}</button>
    </div>
  </div>;
}
