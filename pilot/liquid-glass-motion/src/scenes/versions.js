// Проба 3 · «Один исходник → три версии» (10 c). Миниатюра ветвится на три подачи, затем
// импульсы возвращаются к общему источнику. Иллюстрация устройства монтажа, не обещание результата.
import { color, font } from '../tokens.js';
import { background, headline, demoLayers, demoBadge, stageLink, glassLabel, text, env, prog, easeInOut, easeOut, lerp } from '../components.js';

const SRC = { x: 358, y: 640, w: 240, h: 293 };
const TW = 250, TH = 400, TY = 1110;
const TX = [70, 353, 636];
const HOOKS = [['ПОЧЕМУ', 'СВЕТИТСЯ?'], ['ДО И', 'ПОСЛЕ'], ['ГДЕ', 'ОШИБКА?']];
const CHIPS = ['хук: вопрос', 'хук: сравнение', 'хук: ошибка'];

function thumb(ctx, i, r, a, ring) {
  const d = demoLayers(), c = ctx.under;
  c.save(); c.globalAlpha = a; c.beginPath(); c.roundRect(r.x, r.y, r.w, r.h, 16); c.clip();
  c.fillStyle = color.base; c.fillRect(r.x, r.y, r.w, r.h);
  if (i === 0) c.drawImage(d.plate, 120, 220, 600, 780, r.x, r.y, r.w, r.h), c.globalCompositeOperation = 'screen',
    c.drawImage(d.effect, 120, 220, 600, 780, r.x, r.y, r.w, r.h);
  if (i === 1) { c.drawImage(d.plate, 120, 220, 600, 780, r.x, r.y, r.w, r.h);
    c.beginPath(); c.rect(r.x + r.w / 2, r.y, r.w / 2, r.h); c.clip(); c.globalCompositeOperation = 'screen';
    c.drawImage(d.effect, 120, 220, 600, 780, r.x, r.y, r.w, r.h); }
  if (i === 2) { c.drawImage(d.plate, 520, 500, 300, 400, r.x, r.y, r.w, r.h); c.globalCompositeOperation = 'screen';
    c.drawImage(d.effect, 520, 500, 300, 400, r.x, r.y, r.w, r.h); }
  // затемнение сверху под хук — читаемость
  c.globalCompositeOperation = 'source-over';
  const g = c.createLinearGradient(0, r.y, 0, r.y + r.h * 0.45); g.addColorStop(0, 'rgba(36,11,22,0.85)'); g.addColorStop(1, 'rgba(36,11,22,0)');
  c.fillStyle = g; c.fillRect(r.x, r.y, r.w, r.h);
  c.restore();
  c.save(); c.globalAlpha = a;
  if (i === 1) { c.strokeStyle = color.cream; c.lineWidth = 2; c.beginPath(); c.moveTo(r.x + r.w / 2, r.y); c.lineTo(r.x + r.w / 2, r.y + r.h); c.stroke(); }
  c.lineWidth = ring > 0 ? 3 : 1.5; c.strokeStyle = ring > 0 ? `rgba(244,184,199,${0.4 + 0.6 * ring})` : 'rgba(248,237,240,0.35)';
  c.beginPath(); c.roundRect(r.x, r.y, r.w, r.h, 16); c.stroke(); c.restore();
}

export default {
  id: 'versions', title: 'Один исходник → три подачи', duration: 10,
  beats: { entry: 0.9, branch: 3.0, peak: 4.0, hold: 5.6, link: 7.5, end: 9.5, risk: 3.6 },
  draw(ctx, t) {
    background(ctx.under);
    const d = demoLayers();
    headline(ctx, { t, lines: ['ОДИН ИСХОДНИК', 'ТРИ ПОДАЧИ'], accent: [1], size: 140 });
    // Caveat-акцент рядом с источником (свой кегль, чтобы уложиться в safe-зону)
    {
      const k = easeOut(prog(t, 3.4, 0.6)), o = ctx.over;
      o.save(); o.translate(626, 800); o.rotate(-0.07); o.beginPath(); o.rect(-10, -80, 20 + 300 * k, 120); o.clip();
      text(ctx, 'меняем хук', 0, 0, { fam: font.hand, size: 62, weight: 600, fill: color.pink, critical: false }); o.restore();
      if (k > 0.2) ctx.audit.push({ tag: 'hand:меняем хук', x0: 626, y0: 742 - 18, x1: 626 + 250, y1: 820 });
    }

    // источник
    const sa = env(t, 0.8, 99, 0.6), ring = env(t, 6.9, 99, 0.5);
    const c = ctx.under; c.save(); c.globalAlpha = sa; c.beginPath(); c.roundRect(SRC.x, SRC.y, SRC.w, SRC.h, 16); c.clip();
    c.drawImage(d.comp, SRC.x, SRC.y, SRC.w, SRC.h); c.restore();
    c.save(); c.globalAlpha = sa; c.lineWidth = 2 + 2 * ring; c.strokeStyle = ring ? `rgba(244,184,199,${0.5 + 0.5 * ring})` : 'rgba(248,237,240,0.4)';
    c.beginPath(); c.roundRect(SRC.x, SRC.y, SRC.w, SRC.h, 16); c.stroke(); c.restore();
    ctx.audit.push({ tag: 'source', x0: SRC.x, y0: SRC.y, x1: SRC.x + SRC.w, y1: SRC.y + SRC.h, soft: sa < 0.95 });
    demoBadge(ctx, SRC.x - 4, SRC.y - 52, sa, 'ДЕМО-КАДР · СХЕМА');

    // ветвление: связи 1.8–3.0, миниатюры вылетают из источника 2.2–3.4
    const from = [SRC.x + SRC.w / 2, SRC.y + SRC.h];
    TX.forEach((tx, i) => {
      const chipY = TY - 74, to = [tx + TW / 2, chipY];
      const la = easeInOut(prog(t, 1.8 + i * 0.15, 0.9));
      // импульс от миниатюры обратно к источнику 6.8–7.8
      const pk = prog(t, 6.8 + i * 0.08, 1.0), pulse = pk > 0 && pk < 1 ? 1 - easeInOut(pk) : -1;
      // связь ведёт от источника к метке изменения
      stageLink(ctx, { from, to: [to[0], to[1] - 6], amount: la, pulse });
      const k = easeInOut(prog(t, 2.2 + i * 0.15, 1.1));
      const r = { x: lerp(SRC.x, tx, k), y: lerp(SRC.y, TY, k), w: lerp(SRC.w, TW, k), h: lerp(SRC.h, TH, k) };
      if (k > 0) {
        thumb(ctx, i, r, Math.min(1, k * 3), ring);
        const ha = easeOut(prog(t, 3.0 + i * 0.15, 0.5));
        HOOKS[i].forEach((s, j) => text(ctx, s, r.x + 18, r.y + 72 + j * 58, { fam: font.head, size: 66, alpha: ha,
          fill: j ? color.pink : color.cream, tag: `hook${i}`, maxW: TW - 30 }));
        ctx.audit.push({ tag: `thumb${i}`, x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h, soft: k < 0.98 });
      }
      glassLabel(ctx, { x: tx, y: chipY, w: TW, h: 56, title: CHIPS[i], amount: env(t, 3.2 + i * 0.15, 99, 0.5),
        titleSize: 24, radius: 28, align: 'center', tag: `chip${i}` });
    });
    glassLabel(ctx, { x: 76, y: 740, w: 262, h: 100, title: 'общий', sub: 'исходник', amount: ring, titleSize: 32, subSize: 24, tag: 'common' });
  },
};
