/* ════════════════════════════════════════════════════════════════════════
   szegedisystem.hu — site.js
   ────────────────────────────────────────────────────────────────────────
   Procedural cyberpunk hero: vapor floor + drifting katakana + starfield
   + rotating 3D wireframe octahedron. Scroll = accelerate / zoom in.

   The rest: reveal-on-scroll, night-mode toggle at the glitch transition,
   custom cursor, magnetic email.
   ════════════════════════════════════════════════════════════════════════ */

(() => {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const TAU = Math.PI * 2;

  /* ─────────────────────────────────────────────────────────────────────
     HERO CANVAS — procedural scene
     ───────────────────────────────────────────────────────────────────── */
  const hero    = $('#hero');
  const canvas  = $('#hero-canvas');
  const ctx     = canvas.getContext('2d');
  const rotEl   = $('#frame-counter');     // re-purposed: shows rotation in rad
  const sBar    = $('#scrub-bar');
  const sPct    = $('#scrub-pct');
  const dpr     = Math.min(2, window.devicePixelRatio || 1);

  function sizeCanvas(){
    const r = canvas.getBoundingClientRect();
    canvas.width  = Math.max(1, Math.floor(r.width  * dpr));
    canvas.height = Math.max(1, Math.floor(r.height * dpr));
  }

  /* — stars — */
  const STAR_COUNT = 110;
  const stars = Array.from({length: STAR_COUNT}, () => ({
    x: Math.random(),                 // 0..1 (of width)
    y: Math.random() * 0.55,          // 0..0.55 (only above horizon)
    r: Math.random() * 1.4 + 0.3,
    a: Math.random() * 0.6 + 0.2,
    tw: Math.random() * TAU,          // twinkle phase
    tws: 0.6 + Math.random() * 1.4,   // twinkle speed
    hue: Math.random() < 0.18 ? 'magenta' : Math.random() < 0.3 ? 'cyan' : 'white'
  }));

  /* — drifting katakana strips — */
  const KANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ';
  function randKana(n){
    let s = '';
    for (let i = 0; i < n; i++) s += KANA[(Math.random() * KANA.length) | 0];
    return s;
  }
  const STRIPS = [
    { y: 0.18, size: 22, speed: 18,  text: randKana(60), opacity: .22, color:'magenta' },
    { y: 0.30, size: 14, speed: 38,  text: randKana(80), opacity: .28, color:'cyan'    },
    { y: 0.46, size: 11, speed: 22,  text: randKana(100),opacity: .18, color:'magenta' },
  ];

  /* — octahedron geometry (6 verts, 12 edges) — */
  const OCT_V = [
    [ 1, 0, 0], [-1, 0, 0],
    [ 0, 1, 0], [ 0,-1, 0],
    [ 0, 0, 1], [ 0, 0,-1],
  ];
  const OCT_E = [
    [0,2],[0,3],[0,4],[0,5],
    [1,2],[1,3],[1,4],[1,5],
    [2,4],[2,5],[3,4],[3,5],
  ];

  function rotY(p, a){ const c=Math.cos(a),s=Math.sin(a);
    return [p[0]*c + p[2]*s, p[1], -p[0]*s + p[2]*c]; }
  function rotX(p, a){ const c=Math.cos(a),s=Math.sin(a);
    return [p[0], p[1]*c - p[2]*s, p[1]*s + p[2]*c]; }

  /* — colors — */
  const COL = {
    magenta:'#ff2d8a', cyan:'#00e5ff', violet:'#7a4dff',
    white:  '#f5edff', ink:'#110a16',  cream:'#efe9dd'
  };

  /* — scroll-derived params (smoothed) — */
  let progress         = 0;     // smoothed value used by drawers
  let targetProgress   = 0;     // raw scroll-derived target (lerped toward each frame)
  let lastFrameT       = performance.now();
  let floorPhase       = 0;     // accumulator: independent of scroll speed jumps
  let rotAccum         = 0;     // accumulator: rotation in radians, smooth across frames

  function update(){
    const r = hero.getBoundingClientRect();
    targetProgress = Math.min(1, Math.max(0, -r.top / r.height));
  }

  /* — drawing — */
  function drawSky(w, h){
    // vertical atmosphere gradient (cream → dusty pink → deep magenta hint)
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0,    '#efe9dd');
    g.addColorStop(0.45, '#e7d5dd');
    g.addColorStop(0.62, '#caa6cf');
    g.addColorStop(0.85, '#7a3a86');
    g.addColorStop(1,    '#3a1646');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawStars(t, w, h){
    for (const s of stars){
      const a = s.a * (0.55 + 0.45 * Math.sin(t * 0.001 * s.tws + s.tw));
      ctx.globalAlpha = a;
      ctx.fillStyle = s.hue === 'magenta' ? COL.magenta : s.hue === 'cyan' ? COL.cyan : COL.white;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r * dpr, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSun(w, h){
    // setting magenta sun above horizon
    const cx = w * 0.5, cy = h * 0.55;
    const R = Math.min(w, h) * 0.28;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0,   'rgba(255, 90, 170, 0.95)');
    g.addColorStop(0.45,'rgba(255, 45, 138, 0.65)');
    g.addColorStop(1,   'rgba(255, 45, 138, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // hard disc center
    ctx.fillStyle = '#ff7fb4';
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.42, 0, TAU); ctx.fill();

    // horizontal slats (vapor sun) — slats below horizon line are clipped
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, w, h * 0.62);
    ctx.clip();
    ctx.fillStyle = 'rgba(58, 22, 70, 0.85)';
    const slat = Math.max(4, Math.round(R * 0.045));
    for (let i = 0; i < 7; i++){
      const y = cy + R*0.05 + i * slat * 2;
      ctx.fillRect(cx - R, y, R*2, slat);
    }
    ctx.restore();
  }

  function drawHorizon(w, h){
    const y = h * 0.62;
    // glow band
    const g = ctx.createLinearGradient(0, y - 6*dpr, 0, y + 6*dpr);
    g.addColorStop(0,   'rgba(0,229,255,0)');
    g.addColorStop(0.5, 'rgba(0,229,255,0.9)');
    g.addColorStop(1,   'rgba(0,229,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 6*dpr, w, 12*dpr);
    // hard line
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  function drawFloor(t, w, h){
    const horizon = h * 0.62;

    // perspective floor: draw horizontal scanlines getting closer, plus radial verticals
    ctx.save();
    // mask to below horizon
    ctx.beginPath(); ctx.rect(0, horizon, w, h - horizon); ctx.clip();

    // gradient underlay
    const g = ctx.createLinearGradient(0, horizon, 0, h);
    g.addColorStop(0,   'rgba(58,22,70,0.0)');
    g.addColorStop(0.4, 'rgba(58,22,70,0.6)');
    g.addColorStop(1,   '#0a0510');
    ctx.fillStyle = g;
    ctx.fillRect(0, horizon, w, h - horizon);

    ctx.strokeStyle = 'rgba(0,229,255,0.85)';
    ctx.lineWidth = 1 * dpr;

    // horizontal lines — wrap seamlessly by giving each row its own phase offset.
    // floorPhase is a module accumulator that ALWAYS advances by dt × speed, so
    // changing scroll-speed never causes a positional jump — only acceleration.
    const ROWS = 20;
    for (let i = 0; i < ROWS; i++){
      const tt = ((i / ROWS) + floorPhase) % 1;
      const e = Math.pow(tt, 2.2);                     // softer perspective
      const y = horizon + (h - horizon) * e;
      const alpha = Math.min(1, tt * 3) * Math.min(1, (1 - tt) * 6) * 0.85;
      ctx.globalAlpha = alpha;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // vertical perspective lines fanning from a vanishing point
    const vpX = w * 0.5, vpY = horizon;
    const COLS = 22;
    for (let i = 0; i <= COLS; i++){
      const u = i / COLS;
      const x = -w * 0.6 + (w * 2.2) * u;
      ctx.beginPath();
      ctx.moveTo(vpX, vpY);
      ctx.lineTo(x, h + 40*dpr);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawKanaStrips(t, w, h){
    ctx.save();
    ctx.font = '';
    ctx.textBaseline = 'middle';
    for (const s of STRIPS){
      ctx.font = `${s.size * dpr}px "Zen Kaku Gothic New", "Noto Sans JP", sans-serif`;
      ctx.fillStyle = s.color === 'cyan' ? COL.cyan : COL.magenta;
      ctx.globalAlpha = s.opacity;
      // marquee — repeat text for seamless scroll
      const measure = ctx.measureText(s.text).width;
      const offset = ((t * 0.001 * s.speed) * dpr) % measure;
      const y = s.y * h;
      // 3 copies side-by-side
      ctx.fillText(s.text, -offset, y);
      ctx.fillText(s.text, -offset + measure, y);
      ctx.fillText(s.text, -offset + measure * 2, y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawOctahedron(t, w, h){
    // rotation comes from a smooth accumulator updated in render() — never jumps
    // when scroll speed changes. X-wobble is progress-independent → tied to t.
    const ay = rotAccum;
    const ax = Math.sin(t * 0.0008) * 0.35 + 0.45;

    if (rotEl){
      const norm = ((ay % TAU) + TAU) % TAU;
      rotEl.textContent = norm.toFixed(3);
    }

    // camera dolly: scale increases with smoothed scroll
    const baseScale = Math.min(w, h) * 0.20;
    const scale = baseScale * (1 + progress * 1.4);
    const cx = w * 0.5;
    const cy = h * 0.52;

    // project all verts
    const verts2 = OCT_V.map(p => {
      let q = rotY(p, ay);
      q = rotX(q, ax);
      // perspective
      const z = q[2] + 3.2;
      const persp = 3.2 / z;
      return [cx + q[0] * scale * persp, cy + q[1] * scale * persp, z];
    });

    // edges sorted back→front by average z
    const edgesZ = OCT_E.map(([a, b]) => ({
      a, b, z: (verts2[a][2] + verts2[b][2]) / 2
    })).sort((p, q) => q.z - p.z);

    // soft glow pass
    ctx.save();
    ctx.lineCap = 'round';
    for (const e of edgesZ){
      const [a, b] = [verts2[e.a], verts2[e.b]];
      // glow
      ctx.strokeStyle = 'rgba(255,45,138,0.25)';
      ctx.lineWidth = 10 * dpr;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,229,255,0.20)';
      ctx.lineWidth = 5 * dpr;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    // hard edges
    for (const e of edgesZ){
      const [a, b] = [verts2[e.a], verts2[e.b]];
      const depth = (e.z - 2.2) / 2;     // 0 = front, 1 = back
      const front = 1 - Math.min(1, Math.max(0, depth));
      ctx.strokeStyle = `rgba(245,237,255,${0.35 + front * 0.55})`;
      ctx.lineWidth = (1.4 + front * 1.0) * dpr;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }

    // vertex dots
    for (const v of verts2){
      const depth = (v[2] - 2.2) / 2;
      const front = 1 - Math.min(1, Math.max(0, depth));
      ctx.fillStyle = front > 0.6 ? COL.magenta : COL.cyan;
      ctx.globalAlpha = 0.5 + front * 0.5;
      ctx.beginPath(); ctx.arc(v[0], v[1], (2 + front * 2) * dpr, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // center light
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.9);
    g.addColorStop(0,   'rgba(255,127,180,0.45)');
    g.addColorStop(1,   'rgba(255,127,180,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - scale*1.2, cy - scale*1.2, scale*2.4, scale*2.4);
  }

  function drawScanlines(w, h){
    // very subtle interlaced lines
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#000';
    for (let y = 0; y < h; y += 3 * dpr){
      ctx.fillRect(0, y, w, 1 * dpr);
    }
    ctx.globalAlpha = 1;
  }

  function drawGlitchSlice(t, w, h){
    // occasional horizontal RGB-split slice
    const phase = (t * 0.001) % 6;
    if (phase < 0.12 || (phase > 2.4 && phase < 2.5) || (phase > 4.1 && phase < 4.2)){
      const y = (Math.sin(t * 0.013) * 0.5 + 0.5) * h;
      const hSlice = 36 * dpr;
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = 'rgba(255,45,138,0.35)';
      ctx.fillRect(-8 * dpr, y, w, hSlice);
      ctx.fillStyle = 'rgba(0,229,255,0.30)';
      ctx.fillRect(8 * dpr, y + 4*dpr, w, hSlice - 8*dpr);
      ctx.restore();
    }
  }

  function render(now){
    // dt clamp: prevent huge jumps after tab is backgrounded
    const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameT) * 0.001));
    lastFrameT = now;

    // smooth scroll-driven progress (critical for octahedron not "snapping")
    progress += (targetProgress - progress) * Math.min(1, dt * 9);

    // integrated accumulators — speed responds to scroll, position never jumps
    const angularVel = 0.18 * (1 + progress * 1.0);        // rad/sec
    rotAccum += dt * angularVel;
    const floorSpeed = 0.004 + progress * 0.018;           // ~12× slower than prev
    floorPhase = (floorPhase + dt * floorSpeed) % 1;

    // HUD readouts (smoothed → no jitter)
    const pct = Math.round(progress * 100);
    if (sPct) sPct.textContent = String(pct).padStart(2,'0');
    if (sBar) {
      const W = (sBar.parentElement && sBar.parentElement.clientWidth) || 220;
      sBar.style.transform = `translateX(${progress * (W * 0.94)}px)`;
    }

    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    drawSky(w, h);
    drawStars(now, w, h);
    drawSun(w, h);
    drawKanaStrips(now, w, h);
    drawHorizon(w, h);
    drawFloor(now, w, h);
    drawOctahedron(now, w, h);
    drawGlitchSlice(now, w, h);
    drawScanlines(w, h);

    requestAnimationFrame(render);
  }

  /* ─────────────────────────────────────────────────────────────────────
     NIGHT MODE TRIGGER + GLOBAL SCROLL HAIRLINE
     ───────────────────────────────────────────────────────────────────── */
  const trans     = $('#transition');
  const scrubline = $('#scrubline');
  let rafQ = false;
  function onScroll(){
    if (rafQ) return;
    rafQ = true;
    requestAnimationFrame(() => {
      update();

      // night-mode threshold = transition top crosses 55% viewport
      const r = trans.getBoundingClientRect();
      document.body.classList.toggle('is-night', r.top < window.innerHeight * 0.55);

      // global scroll progress hairline
      const doc = document.documentElement;
      const scrolled = doc.scrollTop;
      const total = doc.scrollHeight - window.innerHeight;
      const gp = total > 0 ? scrolled / total : 0;
      scrubline.style.transform = `scaleX(${gp})`;

      rafQ = false;
    });
  }

  /* ─────────────────────────────────────────────────────────────────────
     REVEAL-ON-SCROLL
     ───────────────────────────────────────────────────────────────────── */
  function setupReveals(){
    const io = new IntersectionObserver((entries) => {
      for (const e of entries){
        if (e.isIntersecting){
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  }

  /* ─────────────────────────────────────────────────────────────────────
     CUSTOM CURSOR + MAGNETIC EMAIL
     ───────────────────────────────────────────────────────────────────── */
  function setupCursor(){
    if (matchMedia('(pointer:coarse)').matches) return;
    const cur = $('#cursor');
    document.body.classList.add('has-cursor');
    let tx = 0, ty = 0, cx = 0, cy = 0;
    document.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
    (function loop(){
      cx += (tx - cx) * 0.22;
      cy += (ty - cy) * 0.22;
      cur.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    })();

    const hot = 'a, button, [data-magnet], .strip, .prow, .plate';
    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(hot)) document.body.classList.add('cursor-hot');
    });
    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(hot)) document.body.classList.remove('cursor-hot');
    });

    $$('[data-magnet]').forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top  + r.height / 2);
        el.style.transform = `translate(${mx * 0.18}px, ${my * 0.28}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* Wheel scroll: native browser default. No JS hijack. */
  function setupSmoothScroll(){ return; }

  /* trap empty hash links */
  $$('.nav a, .chrome a, .socials a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === '#' || !href) a.addEventListener('click', e => e.preventDefault());
  });

  /* ─── boot ─────────────────────────────────────────────────────────── */
  window.addEventListener('resize', sizeCanvas);
  window.addEventListener('scroll', onScroll, { passive: true });
  sizeCanvas();
  setupReveals();
  setupCursor();
  setupSmoothScroll();
  onScroll();
  update();
  // synchronous first paint so the scene is visible immediately,
  // even if the tab is throttled / rAF is paused.
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSky(canvas.width, canvas.height);
  drawStars(performance.now(), canvas.width, canvas.height);
  drawSun(canvas.width, canvas.height);
  drawKanaStrips(performance.now(), canvas.width, canvas.height);
  drawHorizon(canvas.width, canvas.height);
  drawFloor(performance.now(), canvas.width, canvas.height);
  drawOctahedron(performance.now(), canvas.width, canvas.height);
  drawScanlines(canvas.width, canvas.height);
  requestAnimationFrame(render);
})();
