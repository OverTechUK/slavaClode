#!/usr/bin/env node
// Покадровый рендер сцен в MP4: headless Chromium (Playwright) → PNG → ffmpeg libx264 (CRF, без videoBitrate).
// Использование:
//   node tools/render.mjs --scene lens|layers|versions|all [--optics 0] [--crf 16] [--out out/]
//   node tools/render.mjs --scene lens --stills 0,45,120 [--debug 1]   # только PNG-кадры
//   node tools/render.mjs --serve                                       # вьюер на http://localhost:8123
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, l) => (v.startsWith('--') && a.push([v.slice(2), l[i + 1]?.startsWith('--') || l[i + 1] === undefined ? '1' : l[i + 1]]), a), []));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' };

function serve(port) {
  return new Promise(ok => {
    const s = createServer(async (req, res) => {
      try { const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
        if (!p.startsWith(ROOT)) throw 0;
        res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' }); res.end(await readFile(p.endsWith('/') ? p + 'index.html' : p));
      } catch { res.writeHead(404); res.end(); }
    }).listen(port, () => ok(s));
  });
}

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  for (const p of ['playwright', '/opt/node22/lib/node_modules/playwright']) { try { return req(p); } catch {} }
  throw new Error('playwright не найден: npm i -D playwright (браузер: системный Chromium)');
}

const port = +(args.port || 8123);
const server = await serve(port);
if (args.serve) { console.log(`вьюер: http://localhost:${port}/index.html`); await new Promise(() => {}); }

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--font-render-hinting=none'] });

async function openPage() {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto(`http://localhost:${port}/index.html?render=1`);
  await page.waitForFunction(() => window.LG?.ready, null, { timeout: 30000 });
  const info = await page.evaluate(() => ({ fontsOk: LG.fontsOk, glError: LG.glError, scenes: LG.scenes }));
  if (!info.fontsOk) throw new Error('шрифты бренда не загрузились — рендер остановлен');
  return { page, info, canvas: await page.$('#out') };
}

const shot = (canvas) => canvas.screenshot({ type: 'png', animations: 'disabled' });

async function renderScene(id) {
  const { page, info, canvas } = await openPage();
  const optics = args.optics !== '0', debug = args.debug === '1';
  const frames = Math.round(info.scenes[id].duration * 30);
  const outDir = resolve(ROOT, args.out || 'out'); await mkdir(outDir, { recursive: true });
  const o = { optics, debug };
  if (info.glError && optics) throw new Error('WebGL недоступен: ' + info.glError);

  if (args.stills) {
    const dir = join(outDir, 'frames'); await mkdir(dir, { recursive: true });
    for (const f of args.stills.split(',').map(Number)) {
      await page.evaluate(([s, f, o]) => LG.frame(s, f, o), [id, f, o]);
      const name = `${id}_${String(f).padStart(4, '0')}${debug ? '_debug' : ''}${optics ? '' : '_fallback'}.png`;
      await writeFile(join(dir, name), await shot(canvas)); console.log('кадр', name);
    }
    await page.close(); return;
  }

  const file = join(outDir, `${id}${optics ? '' : '_fallback'}${debug ? '_debug' : ''}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', args.crf || '16', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-movflags', '+faststart', '-r', '30', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const audit = []; const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    const r = await page.evaluate(([s, f, o]) => LG.frame(s, f, o), [id, f, o]);
    if (r.bad.length) audit.push({ frame: f, bad: r.bad });
    const png = await shot(canvas);
    if (!ff.stdin.write(png)) await new Promise(ok => ff.stdin.once('drain', ok));
    if (f % 60 === 0) console.log(`${id}: ${f}/${frames}`);
  }
  ff.stdin.end(); await new Promise((ok, no) => ff.on('close', c => (c ? no(new Error('ffmpeg ' + c)) : ok())));
  const report = { scene: id, file: file.replace(ROOT + '/', ''), frames, optics, seconds: (Date.now() - t0) / 1000,
    safeZone: { checkedFrames: frames, framesWithViolations: audit.length, violations: audit.slice(0, 20) } };
  await writeFile(file.replace(/\.mp4$/, '.audit.json'), JSON.stringify(report, null, 2));
  console.log(`${id}: готово ${report.seconds.toFixed(0)} c, нарушений safe-зоны: ${audit.length}`);
  await page.close();
}

try {
  const ids = (args.scene || 'all') === 'all' ? ['lens', 'layers', 'versions'] : args.scene.split(',');
  const conc = Math.max(1, Math.min(ids.length, +(args.concurrency || 2)));
  const queue = [...ids];
  await Promise.all(Array.from({ length: conc }, async () => { while (queue.length) await renderScene(queue.shift()); }));
} finally { await browser.close(); server.close(); }
