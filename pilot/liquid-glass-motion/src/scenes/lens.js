// Проба 1 · «Линза разбора» (10 c). Линза едет к детали, увеличивает, замирает для чтения, уходит.
import { color } from '../tokens.js';
import { background, headline, demoLayers, demoBadge, lens, glassLabel, env, prog, easeInOut, easeOut, lerp } from '../components.js';

const F = { x: 110, y: 600, w: 738, h: 900 };              // демонстрационный кадр
const TARGET = [F.x + 0.795 * F.w, F.y + 0.655 * F.h];      // контровой свет на плече
const START = [300, 1330];

export default {
  id: 'lens', title: 'Линза разбора', duration: 10,
  beats: { entry: 0.5, move: 2.8, peak: 3.9, hold: 5.6, exit: 8.1, end: 9.5, risk: 4.4 },
  draw(ctx, t) {
    background(ctx.under);
    const d = demoLayers();
    const fa = easeOut(prog(t, 0.4, 0.6));
    const c = ctx.under; c.save(); c.globalAlpha = fa;
    c.beginPath(); c.roundRect(F.x, F.y, F.w, F.h, 22); c.clip();
    // кадр вписан по ширине, обрезка снизу
    c.drawImage(d.comp, 0, 0, d.w, d.w * F.h / F.w, F.x, F.y, F.w, F.h); c.restore();
    ctx.audit.push({ tag: 'demo-frame', x0: F.x, y0: F.y, x1: F.x + F.w, y1: F.y + F.h, soft: fa < 0.95 });
    demoBadge(ctx, F.x + F.w - 412, F.y + 18, fa);

    headline(ctx, { t, lines: ['ПОЧЕМУ КАДР', 'РАБОТАЕТ'], accent: [1], size: 150, hand: 'разберём', handAt: [560, 528, -0.07] });

    // линза: вход 1.6, движение 2.2–3.4, увеличение 3.2–3.8, hold до 7.9, выход 7.9–8.5
    const a = env(t, 1.6, 7.9, 0.6, 0.6);
    const k = easeInOut(prog(t, 2.2, 1.2));
    const x = lerp(START[0], TARGET[0], k), y = lerp(START[1], TARGET[1], k);
    const mag = lerp(0.04, 0.34, easeInOut(prog(t, 3.2, 0.6))) * (t > 7.9 ? 1 - easeInOut(prog(t, 7.9, 0.4)) : 1);
    lens(ctx, { x, y, r: 150, amount: a, magnify: mag });

    // пояснение: стеклянная метка + выноска
    const la = env(t, 3.8, 7.6, 0.6, 0.5);
    if (la > 0) {
      const o = ctx.over; o.save(); o.globalAlpha = la; o.strokeStyle = color.cream; o.lineWidth = 2.5;
      o.beginPath(); o.moveTo(x - 110, y + 104); o.lineTo(380, 1398); o.stroke();
      o.fillStyle = color.pink; o.beginPath(); o.arc(x - 110, y + 104, 6, 0, 7); o.fill(); o.restore();
    }
    glassLabel(ctx, { x: 90, y: 1398, w: 560, h: 116, title: 'Контровой свет', sub: 'отделяет фигуру от фона', amount: la, tag: 'callout' });
  },
};
