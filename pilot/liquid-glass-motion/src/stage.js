// Сцена → три слоя: under (преломляется), glass (WebGL-проход), over (резкий текст поверх стекла).
// Кадр детерминирован: зависит только от номера кадра и опций.
import { W, H, FPS, safe, color } from './tokens.js';
import { GlassPass } from './glass.js';
import { drawFlatGlass, demoLayers } from './components.js';
import lensScene from './scenes/lens.js';
import layersScene from './scenes/layers.js';
import versionsScene from './scenes/versions.js';

export const scenes = { lens: lensScene, layers: layersScene, versions: versionsScene };
const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };

export class Stage {
  constructor(out) {
    this.out = out; out.width = W; out.height = H;
    this.under = mk(); this.over = mk(); this.glc = mk();
    try { this.pass = new GlassPass(this.glc); } catch (e) { this.pass = null; this.glError = String(e); }
  }
  static async loadFonts() {
    await Promise.all(['400 100px "Bebas Neue Cyrillic"', '600 100px "Caveat"', '400 100px "Inter"', '600 100px "Inter"']
      .map(f => document.fonts.load(f, 'АБВЁЙЩЫЮЯ')));
    const ok = ['"Bebas Neue Cyrillic"', '"Caveat"', '"Inter"'].every(f => document.fonts.check(`40px ${f}`, 'ЁЖЩ'));
    demoLayers();
    return ok;
  }
  // opts: {optics: true|false, debug: bool}
  render(id, frame, opts = {}) {
    const sc = scenes[id], t = frame / FPS;
    const optics = opts.optics !== false && !!this.pass;
    const u = this.under.getContext('2d'), o = this.over.getContext('2d'), out = this.out.getContext('2d');
    u.setTransform(1, 0, 0, 1, 0, 0); o.setTransform(1, 0, 0, 1, 0, 0);
    u.clearRect(0, 0, W, H); o.clearRect(0, 0, W, H);
    const ctx = { under: u, over: o, glass: [], audit: [], t, frame, optics };
    sc.draw(ctx, t);
    if (optics) { this.pass.render(this.under, ctx.glass); out.drawImage(this.glc, 0, 0); }
    else { out.drawImage(this.under, 0, 0); drawFlatGlass(out, ctx.glass); }
    out.drawImage(this.over, 0, 0);
    if (opts.debug) drawSafe(out, ctx.audit);
    return { audit: ctx.audit, glass: ctx.glass.length, optics };
  }
}

export function checkAudit(audit) {
  const r = safe.rect, bad = [];
  for (const b of audit) if (b.x0 < r.x0 - 0.5 || b.y0 < r.y0 - 0.5 || b.x1 > r.x1 + 0.5 || b.y1 > r.y1 + 0.5) bad.push(b);
  return bad;
}

function drawSafe(c, audit) {
  c.save();
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.beginPath(); c.rect(0, 0, W, H);
  safe.polygon.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  c.fill('evenodd');
  c.lineWidth = 4; c.strokeStyle = '#00E5FF'; c.setLineDash([18, 10]);
  c.beginPath(); safe.polygon.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.stroke();
  c.setLineDash([]); c.strokeStyle = 'rgba(255,230,0,0.9)'; c.lineWidth = 2;
  const r = safe.rect; c.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  const bad = new Set(checkAudit(audit));
  for (const b of audit) { c.strokeStyle = bad.has(b) ? '#FF2D2D' : 'rgba(0,255,120,0.85)'; c.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0); }
  c.font = '600 24px "Inter"'; c.fillStyle = '#00E5FF';
  c.fillText(`DEBUG · safe polygon · ${bad.size ? bad.size + ' OUTSIDE' : 'all critical boxes inside'}`, 70, 225);
  c.restore();
}
