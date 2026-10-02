// Переиспользуемые компоненты пилота: стеклянная метка, линза, слой разбора, связь этапов.
// Каждый компонент: добавляет форму стекла в ctx.glass (преломляет нижний слой),
// рисует резкий текст в ctx.over и регистрирует критичные рамки в ctx.audit (safe-zone gate).
// Это компоненты пилота, НЕ зарегистрированные адаптеры ThrendEffects.
import { color, font, glass as G, motion } from './tokens.js';

// ---------- время и сглаживание ----------
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const easeInOut = k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeOut = k => 1 - Math.pow(1 - k, 3);
export const prog = (t, t0, dur) => clamp((t - t0) / dur);
// огибающая вход → hold → выход; 0..1
export function env(t, tIn, tOut, enter = motion.enter, exit = motion.exit) {
  if (t < tIn || t > tOut + exit) return 0;
  if (t < tIn + enter) return easeOut((t - tIn) / enter);
  if (t <= tOut) return 1;
  return 1 - easeInOut((t - tOut) / exit);
}

// ---------- текст ----------
export function setFont(c, fam, size, weight = 400) { c.font = `${weight} ${size}px ${fam}`; }
export function text(ctx, s, x, y, { fam = font.body, size = 28, weight = 400, fill = color.cream,
  alpha = 1, align = 'left', critical = true, tag = 'text', layer = 'over', maxW } = {}) {
  if (alpha <= 0.001) return;
  const c = ctx[layer];
  setFont(c, fam, size, weight);
  if (maxW) while (c.measureText(s).width > maxW && size > 10) { size -= 1; setFont(c, fam, size, weight); }
  c.save(); c.globalAlpha = alpha; c.fillStyle = fill; c.textAlign = align; c.textBaseline = 'alphabetic';
  c.fillText(s, x, y); c.restore();
  if (critical && alpha > 0.2) {
    const m = c.measureText(s), w = m.width;
    const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.audit.push({ tag: `${tag}:${s}`, x0, y0: y - m.actualBoundingBoxAscent, x1: x0 + w, y1: y + m.actualBoundingBoxDescent });
  }
  return size;
}

// Заголовок: Bebas, плотные строки, акцентная строка розовая, один Caveat-акцент.
export function headline(ctx, { lines, accent = [], hand, handAt, t, tIn = 0.1, x = 70, y = 270, size = 168 }) {
  const lh = size * 0.9;
  lines.forEach((s, i) => {
    const k = easeOut(prog(t, tIn + i * 0.12, 0.55));
    ctx.over.save(); ctx.over.translate(0, (1 - k) * 26);
    text(ctx, s, x, y + size * 0.78 + i * lh, { fam: font.head, size, fill: accent.includes(i) ? color.pink : color.cream,
      alpha: k, tag: 'head', maxW: 817 });
    ctx.over.restore();
  });
  if (hand) {
    const k = easeOut(prog(t, tIn + 0.5, 0.6));
    const [hx, hy, rot = -0.06] = handAt;
    ctx.over.save(); ctx.over.translate(hx, hy); ctx.over.rotate(rot);
    ctx.over.beginPath(); ctx.over.rect(-10, -80, 20 + 400 * k, 120); ctx.over.clip(); // «пишется» слева направо
    text(ctx, hand, 0, 0, { fam: font.hand, size: 78, weight: 600, fill: color.pink, critical: false });
    ctx.over.restore();
    // рамка Caveat с учётом поворота — приближённо
    setFont(ctx.over, font.hand, 78, 600);
    const w = ctx.over.measureText(hand).width;
    if (k > 0.2) ctx.audit.push({ tag: `hand:${hand}`, x0: hx, y0: hy - 62 + Math.min(0, Math.sin(rot) * w), x1: hx + w * Math.cos(rot), y1: hy + 22 + Math.max(0, Math.sin(rot) * w) });
  }
  return y + size * 0.78 + (lines.length - 1) * lh;
}

// ---------- стекло ----------
// Стеклянная метка: панель-стекло + резкая подпись поверх.
export function glassLabel(ctx, { x, y, w, h, title, sub, amount = 1, radius = 28, align = 'left',
  titleSize = 34, subSize = 24, mat = {}, tag = 'label' }) {
  if (amount <= 0.001) return;
  const s = lerp(0.92, 1, amount);
  ctx.glass.push({ x: x + w / 2, y: y + h / 2, w: w * s, h: h * s, radius, amount, ...mat });
  const pad = 26, tx = align === 'center' ? x + w / 2 : x + pad;
  const hasSub = !!sub;
  const ty = hasSub ? y + h / 2 - 4 : y + h / 2 + titleSize * 0.36;
  text(ctx, title, tx, ty, { size: titleSize, weight: 600, alpha: amount, align, tag, maxW: w - pad * 2 });
  if (hasSub) text(ctx, sub, tx, ty + subSize + 10, { size: subSize, fill: color.pink, alpha: amount, align, tag, maxW: w - pad * 2 });
  ctx.audit.push({ tag: `${tag}-panel`, x0: x, y0: y, x1: x + w, y1: y + h, soft: amount < 0.95 });
}

// Линза разбора: круглое стекло с локальным увеличением.
export function lens(ctx, { x, y, r, amount = 1, magnify = 0.32, mat = {} }) {
  if (amount <= 0.001) return;
  const rr = r * lerp(0.6, 1, amount);
  ctx.glass.push({ x, y, w: rr * 2, h: rr * 2, radius: rr, amount, magnify, bevel: 34, strength: 34, shadow: 0.32, ...mat });
  ctx.audit.push({ tag: 'lens', x0: x - rr, y0: y - rr, x1: x + rr, y1: y + rr, soft: amount < 0.95 });
}

// Связь этапов: стеклянная капсула вдоль отрезка + опционально бегущий импульс.
export function stageLink(ctx, { from, to, amount = 1, thick = 22, pulse = -1, mat = {} }) {
  if (amount <= 0.001) return;
  const [ax, ay] = from, bx = lerp(ax, to[0], amount), by = lerp(ay, to[1], amount);
  const len = Math.hypot(bx - ax, by - ay); if (len < 2) return;
  ctx.glass.push({ x: (ax + bx) / 2, y: (ay + by) / 2, w: len + thick, h: thick, radius: thick / 2,
    angle: Math.atan2(by - ay, bx - ax), amount: 1, bevel: thick / 2, strength: 9, magnify: 0, chroma: 1.1, shadow: 0.18, tint: 0.04, ...mat });
  if (pulse >= 0 && pulse <= 1) {
    const px = lerp(ax, bx, pulse), py = lerp(ay, by, pulse), c = ctx.over;
    c.save(); const g = c.createRadialGradient(px, py, 0, px, py, 18);
    g.addColorStop(0, 'rgba(248,237,240,0.95)'); g.addColorStop(1, 'rgba(244,184,199,0)');
    c.fillStyle = g; c.beginPath(); c.arc(px, py, 18, 0, 7); c.fill(); c.restore();
  }
}

// Слой разбора: рисует canvas слоя в нижний слой через аффинное преобразование «по глубине».
// depth: 0 — собран, 1 — разнесён; k — масштаб; y — вертикальный сдвиг.
export function breakdownLayer(ctx, { img, cx, cy, w, h, depth = 0, offsetY = 0, dim = 0, glow = 0, blend = 'source-over', alpha = 1 }) {
  const c = ctx.under;
  const sy = lerp(1, 0.46, depth), sk = lerp(0, -0.42, depth), sc = lerp(1, 0.66, depth);
  c.save();
  c.translate(cx, cy + offsetY);
  c.transform(sc, 0, sk * sc, sy * sc, 0, 0);
  c.globalAlpha = alpha;
  c.globalCompositeOperation = blend;
  c.drawImage(img, -w / 2, -h / 2, w, h);
  c.globalCompositeOperation = 'source-over';
  if (dim > 0) { c.fillStyle = `rgba(36,11,22,${dim})`; c.fillRect(-w / 2, -h / 2, w, h); }
  // контур карточки слоя
  c.globalAlpha = alpha * lerp(0, 1, depth);
  c.lineWidth = 3 / sc; c.strokeStyle = glow > 0 ? `rgba(244,184,199,${0.5 + 0.5 * glow})` : 'rgba(248,237,240,0.35)';
  c.strokeRect(-w / 2, -h / 2, w, h);
  c.restore();
  // проекция центра правого края (для привязки метки) и рамка
  const pt = (u, v) => [cx + sc * u + sk * sc * v, cy + offsetY + sy * sc * v];
  const cs = [pt(-w / 2, -h / 2), pt(w / 2, -h / 2), pt(w / 2, h / 2), pt(-w / 2, h / 2)];
  return { anchor: pt(w / 2, 0), corners: cs };
}

// Простая резервная версия стекла (optics=0): плоская панель без преломления.
export function drawFlatGlass(c, shapes) {
  for (const s of shapes) {
    const a = s.amount ?? 1; if (a <= 0.001) continue;
    c.save(); c.translate(s.x, s.y); c.rotate(s.angle || 0);
    const r = Math.min(s.radius ?? G.radius, s.w / 2, s.h / 2);
    c.beginPath(); c.roundRect(-s.w / 2, -s.h / 2, s.w, s.h, r);
    c.fillStyle = `rgba(112,42,66,${0.55 * a})`; c.fill();
    c.lineWidth = 2; c.strokeStyle = `rgba(244,184,199,${0.8 * a})`; c.stroke();
    c.restore();
  }
}

// ---------- авторский демонстрационный кадр (графическая схема, не скринкаст) ----------
function subject(c, w, h) {
  c.beginPath();
  c.arc(w * 0.56, h * 0.40, w * 0.12, 0, Math.PI * 2);
  c.moveTo(w * 0.24, h * 1.02);
  c.bezierCurveTo(w * 0.26, h * 0.70, w * 0.36, h * 0.58, w * 0.56, h * 0.57);
  c.bezierCurveTo(w * 0.76, h * 0.58, w * 0.86, h * 0.70, w * 0.88, h * 1.02);
  c.closePath();
}
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

let cache = null;
export function demoLayers(w = 820, h = 1000) {
  if (cache) return cache;
  // 1. Исходник: план с фоном, полосами и фигурой
  const plate = mk(w, h), p = plate.getContext('2d');
  let g = p.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#4a1a2e'); g.addColorStop(1, '#1c0811');
  p.fillStyle = g; p.fillRect(0, 0, w, h);
  g = p.createRadialGradient(w * 0.2, h * 0.22, 10, w * 0.2, h * 0.22, w * 0.5);
  g.addColorStop(0, 'rgba(244,184,199,0.55)'); g.addColorStop(1, 'rgba(244,184,199,0)');
  p.fillStyle = g; p.fillRect(0, 0, w, h);
  p.strokeStyle = 'rgba(248,237,240,0.22)'; p.lineWidth = 3;
  for (let i = -h; i < w; i += 46) { p.beginPath(); p.moveTo(i, h); p.lineTo(i + h * 0.7, 0); p.stroke(); }
  p.strokeStyle = 'rgba(248,237,240,0.12)'; p.lineWidth = 2;
  for (let y = h * 0.78; y < h; y += 34) { p.beginPath(); p.moveTo(0, y); p.lineTo(w, y); p.stroke(); }
  p.fillStyle = '#2a0d19'; subject(p, w, h); p.fill();
  p.fillStyle = 'rgba(112,42,66,0.6)'; p.beginPath(); p.arc(w * 0.53, h * 0.38, w * 0.05, 0, 7); p.fill();
  // 2. Маска: где действует эффект
  const mask = mk(w, h), m = mask.getContext('2d');
  m.fillStyle = color.base; m.fillRect(0, 0, w, h);
  m.fillStyle = color.cream; subject(m, w, h); m.fill();
  // 3. Эффект: контровой розовый свет по краю маски
  const effect = mk(w, h), e = effect.getContext('2d');
  e.save(); subject(e, w, h); e.lineWidth = 16; e.strokeStyle = color.pink; e.shadowColor = color.pink; e.shadowBlur = 40;
  e.stroke(); e.stroke(); e.restore();
  e.save(); subject(e, w, h); e.clip(); e.globalCompositeOperation = 'destination-out';
  e.fillStyle = 'rgba(0,0,0,0.65)'; e.translate(14, 10); subject(e, w, h); e.fill(); e.restore();
  // 4. Титры
  const titles = mk(w, h), t = titles.getContext('2d');
  setFont(t, font.head, 120); t.fillStyle = color.cream; t.fillText('ВЕЧЕРНИЙ', 48, 160);
  t.fillStyle = color.pink; t.fillText('СВЕТ', 48, 268);
  setFont(t, font.body, 30, 500); t.fillStyle = color.cream; t.fillText('эпизод 01 · демо-титр', 52, 320);
  // собранный кадр
  const comp = mk(w, h), q = comp.getContext('2d');
  q.drawImage(plate, 0, 0); q.globalCompositeOperation = 'screen'; q.drawImage(effect, 0, 0);
  q.globalCompositeOperation = 'source-over'; q.drawImage(titles, 0, 0);
  cache = { plate, mask, effect, titles, comp, w, h };
  return cache;
}

// Плашка «ДЕМО-КАДР · СХЕМА» — обязательна на всех показах демонстрационного кадра.
export function demoBadge(ctx, x, y, alpha = 1, label = 'ДЕМО-КАДР · ГРАФИЧЕСКАЯ СХЕМА') {
  if (alpha <= 0.01) return;
  const c = ctx.over; setFont(c, font.body, 20, 600);
  const w = c.measureText(label).width + 28;
  c.save(); c.globalAlpha = alpha; c.fillStyle = 'rgba(36,11,22,0.82)';
  c.beginPath(); c.roundRect(x, y, w, 38, 19); c.fill();
  c.strokeStyle = 'rgba(244,184,199,0.6)'; c.lineWidth = 1.5; c.stroke(); c.restore();
  text(ctx, label, x + 14, y + 26, { size: 20, weight: 600, fill: color.pink, alpha, tag: 'badge' });
}

// Фон сцены: тёмная база с локальным винным светом (full bleed).
export function background(c, t = 0) {
  c.fillStyle = color.base; c.fillRect(0, 0, 1080, 1920);
  const g = c.createRadialGradient(820, 520, 40, 820, 520, 1100);
  g.addColorStop(0, 'rgba(112,42,66,0.75)'); g.addColorStop(1, 'rgba(112,42,66,0)');
  c.fillStyle = g; c.fillRect(0, 0, 1080, 1920);
}
