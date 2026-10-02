// WebGL-проход стекла: преломляет реально нарисованный нижний слой (canvas `under`)
// в каждом кадре. Не backdrop-blur: выборка смещается по нормали скруглённого края.
import { glass as G, color } from './tokens.js';

const MAX = 16;

const VS = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const FS = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform int u_n;
uniform vec4 u_geo[${MAX}];   // cx, cy, hw, hh
uniform vec4 u_shp[${MAX}];   // radius, angle, bevel, strength
uniform vec4 u_opt[${MAX}];   // magnify, chroma, glint, amount
uniform vec4 u_mat[${MAX}];   // tint, rim, shadow, frost
uniform vec3 u_wine;
uniform vec3 u_pink;

float sdRR(vec2 q, vec2 b, float r){
  r = min(r, min(b.x, b.y));
  vec2 d = abs(q) - b + r;
  return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - r;
}
vec3 tex(vec2 p){ return texture2D(u_tex, vec2(p.x/u_res.x, 1. - p.y/u_res.y)).rgb; }

void main(){
  vec2 p = vec2(gl_FragCoord.x, u_res.y - gl_FragCoord.y);
  vec3 base = tex(p);
  vec3 col = base;
  float shade = 0.;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= u_n) break;
    vec4 g = u_geo[i]; vec4 s = u_shp[i]; vec4 o = u_opt[i]; vec4 m = u_mat[i];
    float amt = o.w;
    if (amt <= 0.001) continue;
    float ca = cos(s.y), sa = sin(s.y);
    vec2 d0 = p - g.xy;
    vec2 q = vec2(ca*d0.x + sa*d0.y, -sa*d0.x + ca*d0.y);
    float d = sdRR(q, g.zw, s.x);
    // мягкая тень снаружи (смещена вниз)
    vec2 qs = q - vec2(0., 14.);
    float ds = sdRR(qs, g.zw, s.x);
    shade = max(shade, m.z * amt * (1. - smoothstep(0., 46., ds)) * step(0., d));
    if (d > 1.) continue;
    float aa = clamp(0.5 - d, 0., 1.);
    // нормаль края
    float e = 1.;
    vec2 n = vec2(sdRR(q+vec2(e,0.),g.zw,s.x)-sdRR(q-vec2(e,0.),g.zw,s.x),
                  sdRR(q+vec2(0.,e),g.zw,s.x)-sdRR(q-vec2(0.,e),g.zw,s.x));
    n = length(n) > 0. ? normalize(n) : vec2(0.);
    vec2 nw = vec2(ca*n.x - sa*n.y, sa*n.x + ca*n.y);
    float bevel = max(s.z, 1.);
    float edge = clamp(1. + d / bevel, 0., 1.);      // 1 на краю, 0 в центре
    float prof = edge*edge*(3.-2.*edge);              // округлый профиль
    float disp = s.w * prof * amt;
    // увеличение к центру + смещение внутрь по нормали
    vec2 sp = g.xy + d0 * (1. - o.x * amt) - nw * disp;
    float ch = o.y * prof * amt * 2.2;
    vec3 r = vec3(tex(sp - nw*ch).r, tex(sp).g, tex(sp + nw*ch).b);
    // тело: прозрачное, лёгкий винный тон
    r = mix(r, u_wine, m.x * amt);
    // кромка
    float rimL = (1. - smoothstep(0., 2.2, abs(d + 1.2))) * m.y;
    // блик: свет сверху-слева, винно-розовый, на скруглённом крае
    vec2 L = normalize(vec2(-0.55, -0.83));
    float gl = pow(max(dot(nw, L), 0.), 2.) * prof * o.z;
    float gl2 = pow(max(dot(nw, -L), 0.), 3.) * prof * o.z * 0.35;
    r += u_pink * (gl * 0.55 + gl2 * 0.4) * amt + vec3(1.,.93,.95) * rimL * 0.35 * amt;
    // внутренняя тень у нижнего края — объём
    r *= 1. - 0.10 * prof * max(dot(nw, vec2(0.,1.)), 0.) * amt;
    col = mix(col, r, aa);
    shade = 0.;
  }
  col *= 1. - shade;
  gl_FragColor = vec4(col, 1.);
}`;

const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);

export class GlassPass {
  constructor(canvas) {
    const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false });
    if (!gl) throw new Error('WebGL недоступен — используйте fallback');
    this.gl = gl;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr); gl.useProgram(pr); this.pr = pr;
    const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    this.t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    this.u = n => gl.getUniformLocation(pr, n);
    gl.uniform3fv(this.u('u_wine'), hex(color.wine));
    gl.uniform3fv(this.u('u_pink'), hex(color.pink));
  }

  // shapes: [{x,y,w,h,radius,angle, ...переопределения материала, amount}]
  render(under, shapes) {
    const gl = this.gl, c = gl.canvas;
    gl.viewport(0, 0, c.width, c.height);
    gl.bindTexture(gl.TEXTURE_2D, this.t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, under);
    const list = shapes.filter(s => (s.amount ?? 1) > 0.001).slice(0, MAX);
    const geo = [], shp = [], opt = [], mat = [];
    for (const s of list) {
      const P = { ...G, ...s };
      geo.push(s.x, s.y, s.w / 2, s.h / 2);
      shp.push(P.radius, P.angle || 0, P.bevel, P.strength);
      opt.push(P.magnify, P.chroma, P.glint, P.amount ?? 1);
      mat.push(P.tint, P.rim, P.shadow, P.frost);
    }
    while (geo.length < MAX * 4) { geo.push(0, 0, 0, 0); shp.push(0, 0, 1, 0); opt.push(0, 0, 0, 0); mat.push(0, 0, 0, 0); }
    gl.uniform2f(this.u('u_res'), c.width, c.height);
    gl.uniform1i(this.u('u_n'), list.length);
    gl.uniform4fv(this.u('u_geo'), geo); gl.uniform4fv(this.u('u_shp'), shp);
    gl.uniform4fv(this.u('u_opt'), opt); gl.uniform4fv(this.u('u_mat'), mat);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
