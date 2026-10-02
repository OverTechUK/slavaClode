// Проба 2 · «Под капотом» (13 c, главный вариант).
// Собранный кадр → разнос по глубине на 4 слоя → по очереди открываем механизм → сборка → hold.
import { color } from '../tokens.js';
import { background, headline, demoLayers, demoBadge, breakdownLayer, glassLabel, text, env, prog, easeInOut, lerp } from '../components.js';

const LW = 600, LH = 732;                 // размер слоя в собранном виде
const A = { cx: 478, cy: 1010 };          // центр собранного кадра
const X = { cx: 380, offs: [330, 110, -110, -330] };   // разнос: снизу вверх
const LABELS = [
  ['Исходник', 'чистый план'],
  ['Маска', 'где работает эффект'],
  ['Эффект', 'свет по краю маски'],
  ['Титры', 'поверх всего'],
];
const HL0 = 4.6, HLD = 1.1;               // подсветка слоёв: старт и шаг

export default {
  id: 'layers', title: 'Под капотом', duration: 13,
  beats: { entry: 0.6, explode: 3.4, peak: 5.1, hold: 7.3, collapse: 9.9, end: 12.2, risk: 4.4 },
  draw(ctx, t, fallback = !ctx.optics) {
    background(ctx.under);
    const d = demoLayers();
    headline(ctx, { t, lines: ['ПОД КАПОТОМ'], size: 190, hand: '4 слоя', handAt: [640, 486, -0.06] });

    const fa = env(t, 0.5, 99, 0.6);
    // глубина: разнос 2.4–3.8, сборка 9.2–10.6; в fallback без 3D
    const depth = fallback ? 0 : easeInOut(prog(t, 2.4, 1.4)) * (1 - easeInOut(prog(t, 9.2, 1.4)));
    const active = t >= HL0 && t < HL0 + HLD * 4 ? Math.floor((t - HL0) / HLD) : -1;
    const imgs = [d.plate, d.mask, d.effect, d.titles];
    const anchors = [];
    imgs.forEach((img, i) => {
      let alpha = fa, blend = 'source-over';
      if (i === 1) alpha = fa * (fallback ? (active === 1 ? 1 : 0) : depth);   // маска видна только при разборе
      if (i === 2) blend = 'screen';
      if (fallback && active >= 0 && i > active && i !== 1) alpha = 0;        // fallback: последовательное включение
      const hl = active === i ? 1 : 0;
      const dim = active >= 0 && !hl && !fallback ? 0.55 : 0;
      anchors.push(breakdownLayer(ctx, { img, cx: lerp(A.cx, X.cx, depth), cy: A.cy, w: LW, h: LH, depth,
        offsetY: X.offs[i] * depth, alpha, blend, dim, glow: hl }));
    });
    ctx.audit.push({ tag: 'stack', x0: A.cx - LW / 2, y0: A.cy - LH / 2, x1: A.cx + LW / 2, y1: A.cy + LH / 2, soft: true });
    anchors.forEach(a => { const xs = a.corners.map(p => p[0]), ys = a.corners.map(p => p[1]);
      if (depth > 0.05) ctx.audit.push({ tag: 'layer-card', x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) }); });

    // стеклянные метки слоёв: появляются после разноса, уходят перед сборкой
    const la = fallback ? env(t, 3.6, 9.0, 0.5, 0.4) : env(t, 3.4, 9.0, 0.6, 0.4);
    LABELS.forEach(([ti, sub], i) => {
      const a = la * (fallback ? (active === i ? 1 : 0) : 1);
      const k = active === i ? 1 : 0;
      const y = fallback ? 1410 : anchors[i].anchor[1] - 50;
      const x = fallback ? 90 : 612 - k * 14;
      if (!fallback && a > 0) {             // связь слой → метка
        const o = ctx.over, [ax, ay] = anchors[i].anchor; o.save(); o.globalAlpha = a * (active < 0 || k ? 1 : 0.5);
        o.strokeStyle = k ? color.pink : color.cream; o.lineWidth = 2.5; o.beginPath(); o.moveTo(ax, ay); o.lineTo(x + 4, ay); o.stroke();
        o.fillStyle = color.pink; o.beginPath(); o.arc(ax, ay, 6, 0, 7); o.fill(); o.restore();
      }
      glassLabel(ctx, { x, y, w: fallback ? 560 : 274, h: 100, title: ti, sub, amount: a * (active < 0 || k ? 1 : 0.6),
        titleSize: 32, subSize: 21, mat: { glint: k ? 1.0 : 0.6 }, tag: `layer-${i}` });
    });

    // итог: собранный кадр + честная подпись
    demoBadge(ctx, A.cx - LW / 2 + 16, A.cy + LH / 2 - 54, fa * (1 - Math.min(1, depth * 3)));
    const na = env(t, 10.6, 99, 0.6);
    text(ctx, 'схема слоёв · не трекинг реального видео', A.cx, A.cy + LH / 2 + 56, { size: 24, fill: color.pink, alpha: na, align: 'center', tag: 'note' });
  },
};
