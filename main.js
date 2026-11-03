/* ==========================================================
   Tactile — UI micro-interaction lab
   ========================================================== */
(() => {
  'use strict';

  const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const G = window.gsap;
  if (G && window.ScrollTrigger) G.registerPlugin(window.ScrollTrigger);
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);

  function onVisible(el, cb) {
    if (!('IntersectionObserver' in window)) { cb(true); return; }
    new IntersectionObserver((es) => es.forEach((e) => cb(e.isIntersecting)), { rootMargin: '120px' }).observe(el);
  }
  function safe(fn) { try { fn(); } catch (err) { /* one broken demo must not take down the rest */ } }

  /* --------------------------------------------------------
     Hero headline: split, rise in, then "press" under cursor
     -------------------------------------------------------- */
  function initHero() {
    const words = $$('.hero-visual .w');
    const chars = [];
    words.forEach((w) => {
      const text = w.textContent;
      w.textContent = '';
      [...text].forEach((ch, i) => {
        const s = document.createElement('span');
        s.className = 'c';
        s.textContent = ch;
        s.style.setProperty('--i', i);
        w.appendChild(s);
        chars.push(s);
      });
    });
    if (!G || RM) return;

    const intro = G.timeline({ delay: 0.15 });
    intro.from(chars, { yPercent: 115, rotate: 7, duration: 1.1, ease: 'expo.out', stagger: 0.028 })
      .from('.eyebrow', { y: 14, opacity: 0, duration: 0.7, ease: 'power3.out' }, 0)
      .from('.hero-foot > *, .stats li', { y: 24, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }, 0.55);

    // Accent word keeps breathing gently.
    G.to('.accent .c', { y: -6, duration: 1.6, ease: 'sine.inOut', stagger: { each: 0.12, repeat: -1, yoyo: true }, delay: 1.6 });

    if (!FINE) return;
    const hero = $('.hero');
    const setters = chars.map((c) => ({
      el: c,
      sy: G.quickTo(c, 'scaleY', { duration: 0.5, ease: 'power3.out' }),
      sx: G.quickTo(c, 'scaleX', { duration: 0.5, ease: 'power3.out' }),
    }));
    let raf = 0, px = 0, py = 0, armed = false;
    intro.eventCallback('onComplete', () => { armed = true; });
    const apply = () => {
      raf = 0;
      setters.forEach((s) => {
        const r = s.el.getBoundingClientRect();
        const dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2);
        const f = Math.exp(-(dx * dx + dy * dy) / (2 * 85 * 85));
        s.sy(1 - 0.22 * f);
        s.sx(1 + 0.08 * f);
      });
    };
    hero.addEventListener('pointermove', (e) => {
      if (!armed) return;
      px = e.clientX; py = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    });
    hero.addEventListener('pointerleave', () => {
      if (!armed) return;
      setters.forEach((s) => { s.sy(1); s.sx(1); });
    });
  }

  /* --------------------------------------------------------
     01 Fluffy button — canvas fur with spring physics
     -------------------------------------------------------- */
  function initFluffy() {
    const btn = $('#fluffyBtn');
    const cvs = $('#fluffyCanvas');
    const stage = $('#fluffyStage');
    const ctx = cvs.getContext('2d');
    const PAD = 26;
    const COLORS = ['#5e2140', '#83304f', '#a8436a', '#cc5f88', '#ec88aa', '#ffbfd3', '#ffe1ea'];
    let W = 0, H = 0, strands = [], energy = 0, lenScale = 1, burst = 0;
    const P = { x: -1e4, y: -1e4, vx: 0, vy: 0, hover: false, down: false };

    function inPill(x, y, R) {
      const cx = clamp(x, R, W - R);
      return Math.hypot(x - cx, y - R) <= R;
    }
    function build() {
      W = btn.offsetWidth; H = btn.offsetHeight;
      cvs.width = Math.round((W + PAD * 2) * DPR);
      cvs.height = Math.round((H + PAD * 2) * DPR);
      cvs.style.width = W + PAD * 2 + 'px';
      cvs.style.height = H + PAD * 2 + 'px';
      const R = H / 2;
      const n = Math.round(W * H * 0.105);
      strands = [];
      for (let i = 0; i < n; i++) {
        let x, y;
        do { x = Math.random() * W; y = Math.random() * H; } while (!inPill(x, y, R));
        const cx = clamp(x, R, W - R);
        const dx = x - cx, dy = y - R;
        const edge = Math.hypot(dx, dy) / R;
        let ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.5 * (1 - edge * 0.55);
        const len = (5 + Math.random() * 6) * (0.75 + edge * 0.7);
        const shade = clamp(Math.floor((1 - y / H) * 3.2 + Math.random() * 3.4), 0, COLORS.length - 1);
        strands.push({ x: x + PAD, y: y + PAD, ux: Math.cos(ang), uy: Math.sin(ang), len, c: shade, bx: 0, by: 0, vx: 0, vy: 0, ph: Math.random() * 6.283 });
      }
      strands.sort((a, b) => a.c - b.c);
    }

    function step(t) {
      const sig = 2 * 46 * 46;
      const ruffle = P.hover ? (RM ? 0.08 : 0.42) : 0;
      lenScale += ((P.down ? 0.72 : 1) - lenScale) * 0.25;
      const lean = RM ? 0.08 : 0.32;
      const hasP = P.x > -9000;
      energy = 0;
      for (let i = 0; i < strands.length; i++) {
        const s = strands[i];
        let fx = -s.bx * 0.085, fy = -s.by * 0.085;
        if (hasP) {
          const dx = s.x - P.x, dy = s.y - P.y;
          const f = Math.exp(-(dx * dx + dy * dy) / sig);
          fx += P.vx * f * lean; fy += P.vy * f * lean;
          if (P.down) { fx += dx * f * 0.03; fy += dy * f * 0.03; }
        }
        if (ruffle) {
          fx += Math.sin(t * 0.0055 + s.ph) * ruffle;
          fy += Math.cos(t * 0.0068 + s.ph * 1.7) * ruffle;
        }
        if (burst) { fx += s.ux * burst * (0.6 + Math.sin(s.ph) * 0.4); fy += s.uy * burst * (0.6 + Math.cos(s.ph) * 0.4); }
        s.vx = (s.vx + fx) * 0.82; s.vy = (s.vy + fy) * 0.82;
        s.bx += s.vx; s.by += s.vy;
        const m = Math.hypot(s.bx, s.by), max = s.len * 0.95;
        if (m > max) { s.bx *= max / m; s.by *= max / m; }
        energy += Math.abs(s.vx) + Math.abs(s.vy);
      }
      energy /= strands.length || 1;
      burst *= 0.5; if (burst < 0.01) burst = 0;
      P.vx *= 0.55; P.vy *= 0.55;
    }

    function draw() {
      const cw = W + PAD * 2, ch = H + PAD * 2, R = H / 2;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      // Under-coat: dense, shaded base so gaps read as depth.
      const g = ctx.createLinearGradient(0, PAD, 0, PAD + H);
      g.addColorStop(0, '#b0496f'); g.addColorStop(0.55, '#7d2b4c'); g.addColorStop(1, '#3d1326');
      const pill = new Path2D();
      pill.moveTo(PAD + R, PAD);
      pill.arcTo(PAD + W, PAD, PAD + W, PAD + H, R);
      pill.arcTo(PAD + W, PAD + H, PAD, PAD + H, R);
      pill.arcTo(PAD, PAD + H, PAD, PAD, R);
      pill.arcTo(PAD, PAD, PAD + W, PAD, R);
      pill.closePath();
      ctx.fillStyle = g;
      ctx.fill(pill);

      ctx.lineCap = 'round';
      let cur = -1;
      ctx.beginPath();
      for (let i = 0; i < strands.length; i++) {
        const s = strands[i];
        if (s.c !== cur) {
          if (cur >= 0) ctx.stroke();
          cur = s.c;
          ctx.beginPath();
          ctx.strokeStyle = COLORS[cur];
          ctx.lineWidth = 1.55 - cur * 0.12;
        }
        const L = s.len * lenScale;
        const tx = s.x + s.ux * L + s.bx, ty = s.y + s.uy * L + s.by + 1.2;
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(s.x + s.ux * L * 0.55 + s.bx * 0.2, s.y + s.uy * L * 0.55 + s.by * 0.2, tx, ty);
      }
      ctx.stroke();

      // Soft top sheen.
      const sh = ctx.createRadialGradient(PAD + W * 0.4, PAD + H * 0.1, 4, PAD + W * 0.4, PAD + H * 0.1, W * 0.55);
      sh.addColorStop(0, 'rgba(255,235,242,.22)'); sh.addColorStop(1, 'rgba(255,235,242,0)');
      ctx.fillStyle = sh;
      ctx.fill(pill);
    }

    let raf = 0, awake = 0, visible = false;
    function loop(t) {
      raf = 0;
      step(t); draw();
      awake--;
      if (visible && (awake > 0 || P.hover || P.down || energy > 0.004)) raf = requestAnimationFrame(loop);
    }
    function wake() { awake = 90; if (!raf && visible) raf = requestAnimationFrame(loop); }

    stage.addEventListener('pointermove', (e) => {
      const r = cvs.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (P.x > -9000) { P.vx = clamp(x - P.x, -40, 40); P.vy = clamp(y - P.y, -40, 40); }
      P.x = x; P.y = y;
      wake();
    });
    stage.addEventListener('pointerleave', () => { P.x = P.y = -1e4; });
    btn.addEventListener('pointerenter', () => { P.hover = true; wake(); });
    btn.addEventListener('pointerleave', () => { P.hover = false; P.down = false; wake(); });
    btn.addEventListener('focus', () => { P.hover = true; wake(); });
    btn.addEventListener('blur', () => { P.hover = false; wake(); });
    btn.addEventListener('pointerdown', () => { P.down = true; wake(); });
    window.addEventListener('pointerup', () => { if (P.down) { P.down = false; burst = RM ? 0.4 : 2.2; wake(); } });
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { burst = RM ? 0.4 : 2.2; wake(); } });

    build(); draw();
    onVisible(stage, (v) => { visible = v; if (v && energy > 0.004) wake(); });
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); draw(); }, 150); });
  }

  /* --------------------------------------------------------
     02 Fabric button — animated turbulence displacement
     -------------------------------------------------------- */
  function initFabric() {
    const btn = $('#fabricBtn');
    const turb = $('#clothTurb'), disp = $('#clothDisp'), light = $('#clothLight'), sun = $('#clothSun');
    const MAX = RM ? 0.35 : 1;
    let target = 0, cur = 0, raf = 0, visible = true, az = 235, azT = 235;
    const t0 = performance.now();
    function frame(now) {
      raf = 0;
      const t = (now - t0) / 1000;
      cur += (target - cur) * 0.07;
      az += (azT - az) * 0.1;
      const a = cur;
      const fx = 0.03 + 0.008 * Math.sin(t * 1.9) * a;
      const fy = 0.008 + 0.006 * Math.cos(t * 1.4) * a;
      turb.setAttribute('baseFrequency', fx.toFixed(4) + ' ' + fy.toFixed(4));
      disp.setAttribute('scale', (a * 15).toFixed(2));
      light.setAttribute('surfaceScale', (1 + a * 5).toFixed(2));
      sun.setAttribute('azimuth', az.toFixed(1));
      if (visible && (target > 0 || Math.abs(target - cur) > 0.003)) raf = requestAnimationFrame(frame);
      else if (target === 0 && Math.abs(cur) <= 0.003) { cur = 0; disp.setAttribute('scale', '0'); light.setAttribute('surfaceScale', '1'); }
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    btn.addEventListener('pointerenter', () => { target = MAX; kick(); });
    btn.addEventListener('pointerleave', () => { target = 0; azT = 235; kick(); });
    btn.addEventListener('focus', () => { target = MAX * 0.7; kick(); });
    btn.addEventListener('blur', () => { target = 0; kick(); });
    btn.addEventListener('pointerdown', () => { target = MAX * 1.7; kick(); });
    btn.addEventListener('pointerup', () => { target = MAX; kick(); });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      azT = 180 + ((e.clientX - r.left) / r.width) * 120;
    });
    onVisible(btn, (v) => { visible = v; if (v && (target > 0 || cur > 0.003)) kick(); });
  }

  /* --------------------------------------------------------
     03 Glassy OTP
     -------------------------------------------------------- */
  function initOTP() {
    const form = $('#otpForm');
    const inputs = $$('.otp-input', form);
    const verify = $('#otpVerify');
    const status = $('#otpStatus');
    const spinner = $('.otp-spinner', form);
    const success = $('.otp-success', form);
    const ring = $('.ring', form), check = $('.check', form);
    let state = 'idle';

    const full = () => inputs.every((i) => /^\d$/.test(i.value));
    const update = () => {
      inputs.forEach((i) => i.classList.toggle('filled', !!i.value));
      if (state === 'idle') verify.disabled = !full();
    };
    const pop = (el) => { if (G && !RM) G.fromTo(el, { scale: 0.86 }, { scale: 1, duration: 0.45, ease: 'back.out(3)' }); };
    function fill(digits, start) {
      let k = start;
      for (const ch of digits) { if (k >= inputs.length) break; inputs[k].value = ch; pop(inputs[k]); k++; }
      inputs[Math.min(k, inputs.length - 1)].focus();
      update();
    }

    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        const d = inp.value.replace(/\D/g, '');
        if (d.length > 1) { inp.value = ''; fill(d, i); return; }
        inp.value = d;
        if (d) { pop(inp); if (i < inputs.length - 1) inputs[i + 1].focus(); }
        update();
      });
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
          if (!inp.value && i > 0) { e.preventDefault(); inputs[i - 1].value = ''; inputs[i - 1].focus(); update(); }
        } else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); inputs[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && i < inputs.length - 1) { e.preventDefault(); inputs[i + 1].focus(); }
        else if (e.key.length === 1 && !/\d/.test(e.key) && !e.metaKey && !e.ctrlKey) { e.preventDefault(); }
      });
      inp.addEventListener('paste', (e) => {
        e.preventDefault();
        const d = ((e.clipboardData || window.clipboardData).getData('text') || '').replace(/\D/g, '');
        if (d) fill(d, d.length >= inputs.length ? 0 : i);
      });
      inp.addEventListener('focus', () => inp.select());
    });

    function reset() {
      state = 'idle';
      if (G) {
        G.set(success, { autoAlpha: 0 });
        G.set([ring, check], { clearProps: 'strokeDashoffset' });
        inputs.forEach((inp) => { inp.value = ''; });
        G.fromTo(inputs, { x: 0, y: 18, rotation: 0, scale: 0.9, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.05 });
      } else {
        success.style.visibility = 'hidden';
        inputs.forEach((inp) => { inp.value = ''; });
      }
      inputs.forEach((inp) => { inp.disabled = false; });
      verify.textContent = 'Verify';
      status.textContent = '';
      status.classList.remove('ok');
      update();
      inputs[0].focus();
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (state === 'done') { reset(); return; }
      if (state !== 'idle' || !full()) return;
      state = 'busy';
      verify.disabled = true;
      verify.textContent = 'Verifying…';
      status.textContent = 'Checking your code…';
      inputs.forEach((inp) => { inp.disabled = true; });

      const finish = () => {
        state = 'done';
        verify.disabled = false;
        verify.textContent = 'Reset demo';
        status.textContent = 'Verified. Welcome back.';
        status.classList.add('ok');
      };
      if (!G) { success.style.opacity = 1; success.style.visibility = 'visible'; ring.style.strokeDashoffset = 0; check.style.strokeDashoffset = 0; finish(); return; }

      const tl = G.timeline({ onComplete: finish });
      const quick = RM ? 0.01 : 1;
      inputs.forEach((inp, k) => {
        const ang = rand(-Math.PI * 0.95, -Math.PI * 0.05);
        const dist = rand(90, 170);
        tl.to(inp, {
          x: Math.cos(ang) * dist + (k - 1.5) * 20,
          y: Math.sin(ang) * dist * 0.8,
          rotation: rand(-260, 260), scale: rand(0.3, 0.6), opacity: 0,
          duration: 0.75 * quick, ease: 'power3.in',
        }, k * 0.06 * quick);
      });
      tl.fromTo(spinner, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 0.3 * quick, ease: 'back.out(2)' }, '-=0.25')
        .to({}, { duration: RM ? 0.6 : 1.1 })
        .to(spinner, { autoAlpha: 0, scale: 0.5, duration: 0.25 * quick })
        .set(success, { autoAlpha: 1 })
        .fromTo(success, { scale: 0.7 }, { scale: 1, duration: 0.6 * quick, ease: 'back.out(2.2)' })
        .fromTo(ring, { strokeDashoffset: 202 }, { strokeDashoffset: 0, duration: 0.7 * quick, ease: 'power2.out' }, '<')
        .fromTo(check, { strokeDashoffset: 44 }, { strokeDashoffset: 0, duration: 0.4 * quick, ease: 'power2.out' }, '-=0.25');
    });

    const stage = form.closest('.tile-stage');
    onVisible(stage, (v) => stage.classList.toggle('is-paused', !v));
    update();
  }

  /* --------------------------------------------------------
     04 Glassy 3D carousel
     -------------------------------------------------------- */
  const POSTERS = [
    { t: 'Solar Drift', d: 'Screenprint study · warm horizon, 2026', glow: '#ff7a59', art: solar },
    { t: 'Night Bloom', d: 'Petal geometry in ultraviolet ink', glow: '#b06bff', art: bloom },
    { t: 'Signal', d: 'Concentric pulses on deep teal stock', glow: '#2fd4c4', art: signal },
    { t: 'Dune Theory', d: 'Six layers of sand, one long afternoon', glow: '#f0b35a', art: dune },
    { t: 'Prism', d: 'Refraction diagram for a gallery wall', glow: '#ff5fa2', art: prism },
    { t: 'Orbit Club', d: 'Membership card for tiny planets', glow: '#5b8cff', art: orbit },
    { t: 'Soft Grid', d: 'A lattice bent by a single touch', glow: '#7be08a', art: grid },
  ];
  function posterText(id, title, num, ink) {
    return '<text x="16" y="28" font-family="JetBrains Mono, monospace" font-size="8" letter-spacing="1.5" fill="' + ink + '" opacity=".75">TACTILE · NO.' + num + '</text>' +
      '<text x="16" y="256" font-family="Inter Tight, sans-serif" font-weight="700" font-size="21" letter-spacing="-.6" fill="' + ink + '">' + title + '</text>';
  }
  function solar(id) {
    return '<defs><linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b0f3d"/><stop offset=".55" stop-color="#b8325e"/><stop offset="1" stop-color="#ff9f63"/></linearGradient>' +
      '<linearGradient id="' + id + 's" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset="1" stop-color="#ff7a3d"/></linearGradient>' +
      '<mask id="' + id + 'm"><rect width="200" height="280" fill="#fff"/><g fill="#000"><rect y="128" width="200" height="3"/><rect y="140" width="200" height="4"/><rect y="153" width="200" height="5"/><rect y="167" width="200" height="6"/></g></mask></defs>' +
      '<rect width="200" height="280" fill="url(#' + id + 'b)"/>' +
      '<circle cx="100" cy="128" r="62" fill="url(#' + id + 's)" mask="url(#' + id + 'm)"/>' +
      '<path d="M0 196 L44 160 L78 184 L120 146 L160 178 L200 156 L200 280 L0 280Z" fill="#3a0f2e" opacity=".85"/>' +
      '<path d="M0 214 L60 186 L104 206 L150 182 L200 200 L200 280 L0 280Z" fill="#1d0819"/>' +
      posterText(id, 'Solar Drift', '01', '#ffe9d2');
  }
  function bloom(id) {
    let petals = '';
    for (let i = 0; i < 12; i++) petals += '<ellipse cx="100" cy="88" rx="16" ry="44" transform="rotate(' + (i * 30) + ' 100 132)" fill="url(#' + id + 'p)" opacity=".8"/>';
    return '<defs><radialGradient id="' + id + 'b" cx=".5" cy=".45" r=".8"><stop offset="0" stop-color="#4a1d7a"/><stop offset="1" stop-color="#0d0420"/></radialGradient>' +
      '<linearGradient id="' + id + 'p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb3f0"/><stop offset="1" stop-color="#7a3cff" stop-opacity=".2"/></linearGradient></defs>' +
      '<rect width="200" height="280" fill="url(#' + id + 'b)"/>' + '<g style="mix-blend-mode:screen">' + petals + '</g>' +
      '<circle cx="100" cy="132" r="14" fill="#ffe7fb"/><circle cx="100" cy="132" r="30" fill="none" stroke="#ffd6f6" stroke-opacity=".35"/>' +
      posterText(id, 'Night Bloom', '02', '#f5e6ff');
  }
  function signal(id) {
    let rings = '';
    for (let i = 1; i <= 9; i++) rings += '<circle cx="100" cy="124" r="' + (i * 13) + '" fill="none" stroke="#c9fff6" stroke-opacity="' + (1 - i * 0.09).toFixed(2) + '" stroke-width="' + (i % 3 === 0 ? 2.4 : 1) + '"/>';
    return '<defs><linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b4f55"/><stop offset="1" stop-color="#03181d"/></linearGradient>' +
      '<radialGradient id="' + id + 'c" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#7affea"/><stop offset="1" stop-color="#7affea" stop-opacity="0"/></radialGradient></defs>' +
      '<rect width="200" height="280" fill="url(#' + id + 'b)"/>' + '<circle cx="100" cy="124" r="70" fill="url(#' + id + 'c)" opacity=".45"/>' + rings +
      '<circle cx="100" cy="124" r="6" fill="#fff"/>' + posterText(id, 'Signal', '03', '#dafff9');
  }
  function dune(id) {
    const cols = ['#ffe2a8', '#f6c27a', '#e39a52', '#c47236', '#93491f', '#5c2a12'];
    let layers = '';
    cols.forEach((c, i) => {
      const y = 96 + i * 30;
      layers += '<path d="M0 ' + y + ' C 50 ' + (y - 26) + ', 110 ' + (y + 22) + ', 200 ' + (y - 14) + ' L200 280 L0 280Z" fill="' + c + '"/>';
    });
    return '<defs><linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd7c2"/><stop offset="1" stop-color="#ffb08a"/></linearGradient></defs>' +
      '<rect width="200" height="280" fill="url(#' + id + 'b)"/>' + '<circle cx="146" cy="62" r="18" fill="#fff6e8"/>' + layers +
      posterText(id, 'Dune Theory', '04', '#2b1205');
  }
  function prism(id) {
    return '<defs><linearGradient id="' + id + 'b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16101f"/><stop offset="1" stop-color="#2a1030"/></linearGradient>' +
      '<linearGradient id="' + id + 'r" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff4d6d"/><stop offset=".25" stop-color="#ffb84d"/><stop offset=".5" stop-color="#f7ff6b"/><stop offset=".75" stop-color="#4dffc3"/><stop offset="1" stop-color="#6b7bff"/></linearGradient>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="#ffffff" stop-opacity=".08"/></linearGradient></defs>' +
      '<rect width="200" height="280" fill="url(#' + id + 'b)"/>' +
      '<path d="M0 132 L86 126" stroke="#fff" stroke-width="2.2"/>' +
      '<path d="M112 118 L200 92 L200 188 L118 140Z" fill="url(#' + id + 'r)" opacity=".9"/>' +
      '<path d="M100 60 L150 160 L50 160Z" fill="url(#' + id + 'g)" stroke="#fff" stroke-opacity=".7"/>' +
      posterText(id, 'Prism', '05', '#ffeef6');
  }
  function orbit(id) {
    return '<defs><radialGradient id="' + id + 'b" cx=".5" cy=".4" r=".9"><stop offset="0" stop-color="#1d2f7a"/><stop offset="1" stop-color="#060a1f"/></radialGradient>' +
      '<radialGradient id="' + id + 'p" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffe0a3"/><stop offset="1" stop-color="#ff6b3d"/></radialGradient>' +
      '<radialGradient id="' + id + 'q" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#c8f2ff"/><stop offset="1" stop-color="#3a7bff"/></radialGradient></defs>' +
      '<rect width="200" height="280" fill="url(#' + id + 'b)"/>' +
      '<g fill="#fff"><circle cx="24" cy="54" r="1"/><circle cx="170" cy="40" r="1.3"/><circle cx="150" cy="210" r="1"/><circle cx="40" cy="196" r="1.2"/><circle cx="90" cy="30" r=".8"/></g>' +
      '<ellipse cx="100" cy="130" rx="84" ry="30" fill="none" stroke="#9fb6ff" stroke-opacity=".45" transform="rotate(-18 100 130)"/>' +
      '<ellipse cx="100" cy="130" rx="56" ry="20" fill="none" stroke="#9fb6ff" stroke-opacity=".3" transform="rotate(-18 100 130)"/>' +
      '<circle cx="100" cy="130" r="26" fill="url(#' + id + 'p)"/>' +
      '<circle cx="168" cy="108" r="8" fill="url(#' + id + 'q)"/><circle cx="54" cy="150" r="5" fill="#ffd1f0"/>' +
      posterText(id, 'Orbit Club', '06', '#e6ecff');
  }
  function grid(id) {
    let dots = '';
    for (let y = 0; y < 9; y++) for (let x = 0; x < 7; x++) {
      const px = 22 + x * 26, py = 46 + y * 22;
      const dx = px - 100, dy = py - 130, d = Math.hypot(dx, dy);
      const k = Math.exp(-(d * d) / 3200) * 18;
      const nx = px + (dx / (d || 1)) * k, ny = py + (dy / (d || 1)) * k;
      dots += '<circle cx="' + nx.toFixed(1) + '" cy="' + ny.toFixed(1) + '" r="' + (2.2 + k * 0.12).toFixed(2) + '"/>';
    }
    return '<defs><linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9ffc9"/><stop offset="1" stop-color="#6fcf86"/></linearGradient></defs>' +
      '<rect width="200" height="280" fill="url(#' + id + 'b)"/>' + '<g fill="#0e3b22">' + dots + '</g>' +
      '<circle cx="100" cy="130" r="9" fill="#fff" stroke="#0e3b22" stroke-width="2"/>' +
      posterText(id, 'Soft Grid', '07', '#0e3b22');
  }

  function initCarousel() {
    const root = $('#coverflow');
    const track = $('#cfTrack');
    const stage = root.closest('.tile-stage');
    POSTERS.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'cf-card';
      card.setAttribute('role', 'group');
      card.setAttribute('aria-roledescription', 'slide');
      card.setAttribute('aria-label', (i + 1) + ' of ' + POSTERS.length + ': ' + p.t);
      card.innerHTML = '<svg viewBox="0 0 200 280" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Poster artwork: ' + p.t + '">' + p.art('pst' + i) + '</svg>';
      track.appendChild(card);
    });
    const cards = $$('.cf-card', track);
    const n = cards.length;
    const elIndex = $('#cfIndex'), elTitle = $('#cfTitle'), elDesc = $('#cfDesc');
    let pos = 3, target = 3, active = -1, spacing = 120;
    let dragging = false, startX = 0, startPos = 0, lastX = 0, lastT = 0, vel = 0, moved = false, downCard = null, raf = 0;

    const measure = () => { spacing = cards[0].offsetWidth * 0.6; };
    function setActive(i) {
      active = i;
      cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
      const p = POSTERS[i];
      elIndex.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(n).padStart(2, '0');
      elTitle.textContent = p.t;
      elDesc.textContent = p.d;
      stage.style.setProperty('--glow', p.glow);
      if (G && !RM) G.fromTo('.cf-info > *', { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', stagger: 0.04, overwrite: true });
    }
    function render() {
      for (let i = 0; i < n; i++) {
        const o = i - pos, ao = Math.abs(o);
        const rot = clamp(-o * 44, -62, 62);
        const c = cards[i];
        c.style.transform = 'translate(-50%,-50%) translateX(' + (o * spacing).toFixed(2) + 'px) translateZ(' + (-ao * 160).toFixed(2) + 'px) rotateY(' + rot.toFixed(2) + 'deg)';
        c.style.zIndex = String(100 - Math.round(ao * 10));
        c.style.opacity = String(clamp(1.9 - ao * 0.5, 0, 1));
        c.style.setProperty('--shade', Math.min(ao * 0.28, 0.65).toFixed(3));
      }
      const idx = clamp(Math.round(pos), 0, n - 1);
      if (idx !== active) setActive(idx);
    }
    function tick() {
      raf = 0;
      if (!dragging) {
        const d = target - pos;
        pos += d * (RM ? 1 : 0.14);
        if (Math.abs(d) < 0.0008) pos = target;
      }
      render();
      if (dragging || pos !== target) raf = requestAnimationFrame(tick);
    }
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const go = (i) => { target = clamp(i, 0, n - 1); kick(); };

    root.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true; moved = false;
      startX = lastX = e.clientX; startPos = pos; lastT = performance.now(); vel = 0;
      downCard = e.target.closest('.cf-card');
      root.setPointerCapture(e.pointerId);
      root.classList.add('dragging');
      kick();
    });
    root.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) moved = true;
      let p = startPos - dx / spacing;
      if (p < 0) p *= 0.35;
      if (p > n - 1) p = n - 1 + (p - (n - 1)) * 0.35;
      pos = p;
      const now = performance.now();
      const v = (e.clientX - lastX) / Math.max(now - lastT, 1);
      vel = vel * 0.6 + v * 0.4;
      lastX = e.clientX; lastT = now;
    });
    const end = () => {
      if (!dragging) return;
      dragging = false;
      root.classList.remove('dragging');
      if (!moved && downCard) { go(cards.indexOf(downCard)); return; }
      const fling = RM ? 0 : (-vel * 260) / spacing;
      go(Math.round(pos + fling));
    };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(target - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(target + 1); }
    });
    $('#cfPrev').addEventListener('click', () => go(target - 1));
    $('#cfNext').addEventListener('click', () => go(target + 1));
    window.addEventListener('resize', () => { measure(); render(); });
    measure(); render();
  }

  /* --------------------------------------------------------
     05 Magnetic button
     -------------------------------------------------------- */
  function initMagnetic() {
    const stage = $('#magStage'), btn = $('#magBtn'), label = $('.mag-label', btn);
    if (!G || RM || !FINE) return;
    let pulled = false;
    stage.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2 - (G.getProperty(btn, 'x') || 0);
      const cy = r.top + r.height / 2 - (G.getProperty(btn, 'y') || 0);
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d < 170) {
        pulled = true;
        G.to(btn, { x: dx * 0.42, y: dy * 0.42, scale: 1.04, duration: 0.35, ease: 'power3.out', overwrite: true });
        G.to(label, { x: dx * 0.2, y: dy * 0.2, duration: 0.35, ease: 'power3.out', overwrite: true });
      } else if (pulled) release();
    });
    function release() {
      pulled = false;
      G.to(btn, { x: 0, y: 0, scale: 1, duration: 1.4, ease: 'elastic.out(1.1, 0.28)', overwrite: true });
      G.to(label, { x: 0, y: 0, duration: 1.4, ease: 'elastic.out(1.1, 0.28)', overwrite: true });
    }
    stage.addEventListener('pointerleave', release);
    btn.addEventListener('pointerdown', () => G.to(btn, { scale: 0.92, duration: 0.15, overwrite: 'auto' }));
    btn.addEventListener('pointerup', () => G.to(btn, { scale: 1.04, duration: 0.5, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' }));
  }

  /* --------------------------------------------------------
     06 Liquid toggle
     -------------------------------------------------------- */
  function initToggle() {
    const sw = $('#liquidSwitch');
    const b1 = $('.b1', sw), b2 = $('.b2', sw), b3 = $('.b3', sw);
    const state = $('#liquidState');
    sw.addEventListener('click', () => {
      const on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', String(on));
      state.textContent = on ? 'on' : 'off';
      const x = on ? 90 : 30;
      if (!G || RM) { [b1, b2, b3].forEach((b) => b.setAttribute('cx', x)); return; }
      G.to(b1, { attr: { cx: x }, duration: 0.75, ease: 'elastic.out(1, 0.55)' });
      G.fromTo(b1, { attr: { r: 19 } }, { attr: { r: 15 }, duration: 0.16, yoyo: true, repeat: 1, ease: 'power2.out' });
      G.to(b2, { attr: { cx: x }, duration: 0.7, delay: 0.07, ease: 'power3.inOut' });
      G.to(b3, { attr: { cx: x }, duration: 0.75, delay: 0.14, ease: 'power3.inOut' });
    });
  }

  /* --------------------------------------------------------
     07 Jelly checkbox
     -------------------------------------------------------- */
  function initJelly() {
    $$('.jelly').forEach((b) => {
      const box = $('.jelly-box', b);
      b.addEventListener('click', () => {
        const on = b.getAttribute('aria-checked') !== 'true';
        b.setAttribute('aria-checked', String(on));
        if (!G || RM) return;
        G.timeline({ overwrite: true })
          .to(box, { scaleX: 1.32, scaleY: 0.68, duration: 0.11, ease: 'power2.out' })
          .to(box, { scaleX: 0.82, scaleY: 1.24, y: -5, duration: 0.13, ease: 'power2.out' })
          .to(box, { scaleX: 1.1, scaleY: 0.9, y: 0, duration: 0.12, ease: 'power2.in' })
          .to(box, { scaleX: 1, scaleY: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
      });
    });
  }

  /* --------------------------------------------------------
     08 Text links
     -------------------------------------------------------- */
  function initText() {
    const GLYPHS = '!<>-_\\/[]{}=+*^?#%&01';
    const esc = (c) => c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c;
    $$('[data-scramble]').forEach((a) => {
      const out = $('.scr', a);
      const text = out.textContent;
      let raf = 0;
      const run = () => {
        if (RM) return;
        cancelAnimationFrame(raf);
        const q = [...text].map((ch, i) => ({ ch, end: Math.floor(i * 1.6 + rand(6, 16)) }));
        let f = 0;
        const frame = () => {
          let html = '', done = 0;
          q.forEach((it) => {
            if (it.ch === ' ' || f >= it.end) { html += esc(it.ch); done++; }
            else html += '<span class="g">' + esc(GLYPHS[(Math.random() * GLYPHS.length) | 0]) + '</span>';
          });
          out.innerHTML = html;
          f++;
          if (done < q.length) raf = requestAnimationFrame(frame);
        };
        frame();
      };
      a.addEventListener('pointerenter', run);
      a.addEventListener('focus', run);
    });
    $$('.roll').forEach((r) => {
      const text = r.textContent;
      r.textContent = '';
      [...text].forEach((ch, i) => {
        const o = document.createElement('span'); o.className = 'rc';
        const n = document.createElement('span'); n.className = 'rc-in';
        const c = ch === ' ' ? ' ' : ch;
        n.textContent = c; n.dataset.c = c; n.style.setProperty('--i', i);
        o.appendChild(n); r.appendChild(o);
      });
    });
  }

  /* --------------------------------------------------------
     Grid spotlight
     -------------------------------------------------------- */
  function initSpotlight() {
    const grid = $('#grid');
    const tiles = $$('.tile', grid);
    let raf = 0, mx = 0, my = 0;
    grid.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        tiles.forEach((t) => {
          const r = t.getBoundingClientRect();
          t.style.setProperty('--x', (mx - r.left).toFixed(1) + 'px');
          t.style.setProperty('--y', (my - r.top).toFixed(1) + 'px');
        });
      });
    });
  }

  /* --------------------------------------------------------
     Copy code + toast
     -------------------------------------------------------- */
  function initCopy() {
    const toast = $('#toast'), toastText = $('#toastText');
    let hide;
    const show = (msg) => {
      toastText.textContent = msg;
      toast.classList.add('show');
      clearTimeout(hide);
      hide = setTimeout(() => toast.classList.remove('show'), 2200);
    };
    const fallback = (text) => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    };
    $$('[data-copy]').forEach((b) => {
      b.addEventListener('click', async () => {
        const code = SNIPPETS[b.dataset.copy] || '';
        let ok = false;
        try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { ok = fallback(code); }
        show(ok ? b.dataset.name + ' snippet copied' : 'Clipboard blocked: try again');
        if (ok) {
          b.classList.add('copied'); b.textContent = 'Copied';
          setTimeout(() => { b.classList.remove('copied'); b.textContent = 'Copy code'; }, 1800);
        }
      });
    });
  }

  /* --------------------------------------------------------
     Reveal + offscreen pausing for ambient CSS loops
     -------------------------------------------------------- */
  function initReveal() {
    const heroBg = $('.hero-bg');
    onVisible($('.hero'), (v) => heroBg.classList.toggle('is-paused', !v));
    if (!G || RM || !window.ScrollTrigger) return;
    G.set('.tile, .principles li', { opacity: 0, y: 40 });
    window.ScrollTrigger.batch('.tile, .principles li', {
      start: 'top 92%',
      once: true,
      onEnter: (els) => G.to(els, { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08, clearProps: 'transform' }),
    });
  }

  /* --------------------------------------------------------
     Copy-paste snippets (each one is a standalone HTML file)
     -------------------------------------------------------- */
  const SNIPPETS = {
    fluffy: `<!-- Tactile · Fluffy button: canvas fur that leans with the cursor -->
<button class="fluffy" id="fluffy" type="button"><canvas aria-hidden="true"></canvas><span>Contact</span></button>
<style>
  body{background:#120a0e;display:grid;place-items:center;min-height:100vh;margin:0}
  .fluffy{position:relative;width:228px;height:80px;border:0;padding:0;background:none;border-radius:99px;cursor:pointer;font:700 20px system-ui;color:#fff}
  .fluffy canvas{position:absolute;left:-26px;top:-26px;pointer-events:none}
  .fluffy span{position:relative;text-shadow:0 1px 2px #3c0a1e,0 0 14px #5a1432}
</style>
<script>
(function(){
  var b=document.getElementById('fluffy'),c=b.querySelector('canvas'),x=c.getContext('2d'),P=26,D=Math.min(devicePixelRatio||1,2);
  var W=b.offsetWidth,H=b.offsetHeight,R=H/2,C=['#5e2140','#83304f','#a8436a','#cc5f88','#ec88aa','#ffbfd3','#ffe1ea'];
  c.width=(W+P*2)*D;c.height=(H+P*2)*D;c.style.width=W+P*2+'px';c.style.height=H+P*2+'px';x.scale(D,D);
  function cl(v,a,b){return Math.min(b,Math.max(a,v))}
  var S=[];for(var i=0;i<W*H*0.1;i++){var px,py;do{px=Math.random()*W;py=Math.random()*H}while(Math.hypot(px-cl(px,R,W-R),py-R)>R);
    var e=Math.hypot(px-cl(px,R,W-R),py-R)/R,a=Math.atan2(py-R,px-cl(px,R,W-R))+(Math.random()-.5)*1.5*(1-e*.55);
    S.push({x:px+P,y:py+P,ux:Math.cos(a),uy:Math.sin(a),l:(5+Math.random()*6)*(.75+e*.7),c:cl(Math.floor((1-py/H)*3.2+Math.random()*3.4),0,6),bx:0,by:0,vx:0,vy:0,p:Math.random()*7})}
  S.sort(function(a,b){return a.c-b.c});
  var m={x:-1e4,y:-1e4,vx:0,vy:0},hov=0;
  addEventListener('pointermove',function(e){var r=c.getBoundingClientRect(),nx=e.clientX-r.left,ny=e.clientY-r.top;if(m.x>-9e3){m.vx=cl(nx-m.x,-40,40);m.vy=cl(ny-m.y,-40,40)}m.x=nx;m.y=ny});
  b.addEventListener('pointerenter',function(){hov=1});b.addEventListener('pointerleave',function(){hov=0});
  (function f(t){x.clearRect(0,0,W+P*2,H+P*2);x.fillStyle='#7d2b4c';x.beginPath();x.roundRect(P,P,W,H,R);x.fill();x.lineCap='round';var k=-1;
    for(var i=0;i<S.length;i++){var s=S[i],dx=s.x-m.x,dy=s.y-m.y,g=Math.exp(-(dx*dx+dy*dy)/4232);
      s.vx=(s.vx-s.bx*.085+m.vx*g*.32+hov*Math.sin(t*.0055+s.p)*.42)*.82;s.vy=(s.vy-s.by*.085+m.vy*g*.32+hov*Math.cos(t*.0068+s.p)*.42)*.82;s.bx+=s.vx;s.by+=s.vy;
      if(s.c!==k){x.stroke();x.beginPath();k=s.c;x.strokeStyle=C[k];x.lineWidth=1.55-k*.12}
      x.moveTo(s.x,s.y);x.quadraticCurveTo(s.x+s.ux*s.l*.55+s.bx*.2,s.y+s.uy*s.l*.55+s.by*.2,s.x+s.ux*s.l+s.bx,s.y+s.uy*s.l+s.by+1.2)}
    x.stroke();m.vx*=.55;m.vy*=.55;requestAnimationFrame(f)})(0);
})();
</script>`,

    fabric: `<!-- Tactile · Fabric button: SVG turbulence + displacement cloth ripple -->
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="cloth" x="-12%" y="-35%" width="124%" height="170%" color-interpolation-filters="sRGB">
  <feTurbulence id="turb" type="fractalNoise" baseFrequency="0.03 0.008" numOctaves="2" seed="7" result="n"/>
  <feDisplacementMap id="disp" in="SourceGraphic" in2="n" scale="0" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feDiffuseLighting id="lit" in="n" surfaceScale="1" lighting-color="#fff" result="l"><feDistantLight azimuth="235" elevation="48"/></feDiffuseLighting>
  <feComposite in="l" in2="d" operator="in" result="m"/><feBlend in="m" in2="d" mode="soft-light"/>
</filter></svg>
<button class="fabric" id="fabric" type="button"><span class="surface">Explore</span></button>
<style>
  body{background:#0a0c18;display:grid;place-items:center;min-height:100vh;margin:0}
  .fabric{width:236px;height:84px;border:0;padding:0;background:none;border-radius:99px;cursor:pointer;filter:drop-shadow(0 18px 22px #0008)}
  .surface{display:grid;place-items:center;height:100%;border-radius:99px;filter:url(#cloth);font:700 21px system-ui;color:#f4f6ff;position:relative;
    background:radial-gradient(120% 90% at 30% 10%,#fff4,transparent 50%),repeating-linear-gradient(45deg,#ffffff12 0 1.5px,transparent 1.5px 3.5px),repeating-linear-gradient(-45deg,#00000024 0 1.5px,transparent 1.5px 3.5px),linear-gradient(#5b7bff,#3346d6 55%,#1c2384);
    box-shadow:inset 0 2px 0 #fff4,inset 0 -6px 14px #001a}
  .surface::before{content:"";position:absolute;inset:7px;border-radius:99px;border:1.5px dashed #ffffff6b}
</style>
<script>
(function(){
  var b=document.getElementById('fabric'),t=document.getElementById('turb'),d=document.getElementById('disp'),l=document.getElementById('lit');
  var target=0,cur=0,raf=0,t0=performance.now();
  function f(now){raf=0;var s=(now-t0)/1000;cur+=(target-cur)*.07;
    t.setAttribute('baseFrequency',(0.03+0.008*Math.sin(s*1.9)*cur)+' '+(0.008+0.006*Math.cos(s*1.4)*cur));
    d.setAttribute('scale',cur*15);l.setAttribute('surfaceScale',1+cur*5);
    if(target>0||Math.abs(target-cur)>.003)raf=requestAnimationFrame(f)}
  function go(v){target=v;if(!raf)raf=requestAnimationFrame(f)}
  b.addEventListener('pointerenter',function(){go(1)});b.addEventListener('pointerleave',function(){go(0)});
  b.addEventListener('pointerdown',function(){go(1.7)});b.addEventListener('pointerup',function(){go(1)});
})();
</script>`,

    otp: `<!-- Tactile · Glassy OTP: auto-advance, paste, backspace, success ring -->
<form class="otp" id="otp" novalidate>
  <h2>Enter your code</h2>
  <div class="slot"><div class="digits" role="group" aria-label="One-time code">
    <input inputmode="numeric" autocomplete="one-time-code" aria-label="Digit 1"><input inputmode="numeric" aria-label="Digit 2"><input inputmode="numeric" aria-label="Digit 3"><input inputmode="numeric" aria-label="Digit 4">
  </div><span class="spin"></span>
  <svg class="ok" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="32" transform="rotate(-90 40 40)"/><path d="M26 41l9 9 19-20"/></svg></div>
  <button type="submit" disabled>Verify</button><p role="status" aria-live="polite"></p>
</form>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui;background:radial-gradient(circle at 30% 30%,#ffe3a0,#c8781f 40%,#3a1904 80%)}
  .otp{width:320px;padding:28px 24px;border-radius:26px;text-align:center;color:#fffaf0;background:linear-gradient(150deg,#fff3,#ffffff0d);border:1px solid #fff5;backdrop-filter:blur(22px) saturate(160%);box-shadow:0 30px 60px -20px #0009}
  .otp h2{margin:0;font-size:22px}.slot{position:relative;height:84px;margin:20px 0;display:grid;place-items:center}
  .digits{display:flex;gap:10px}.digits input{width:56px;height:66px;border-radius:16px;text-align:center;font:600 28px system-ui;color:#fff;background:#ffffff1a;border:1px solid #fff5;outline:none}
  .digits input:focus{border-color:#ffe2a6;box-shadow:0 0 0 4px #ffd28c40}
  .spin{position:absolute;width:44px;height:44px;border-radius:50%;border:3px solid #fff4;border-top-color:#fff;opacity:0;animation:r .8s linear infinite;transition:opacity .25s}
  @keyframes r{to{transform:rotate(360deg)}}
  .ok{position:absolute;width:80px;height:80px;opacity:0;transition:opacity .2s}.ok *{fill:none;stroke-linecap:round;stroke-width:5}
  .ok circle{stroke:#3ee39a;stroke-dasharray:202;stroke-dashoffset:202;transition:stroke-dashoffset .7s ease-out}
  .ok path{stroke:#fff;stroke-dasharray:44;stroke-dashoffset:44;transition:stroke-dashoffset .4s ease-out .5s}
  .otp.done .ok{opacity:1}.otp.done .ok *{stroke-dashoffset:0}.otp.busy .spin{opacity:1}
  .digits input{transition:transform .7s cubic-bezier(.6,0,.9,.4),opacity .6s}
  button{width:100%;height:50px;border:0;border-radius:14px;font:600 16px system-ui;background:linear-gradient(#fff0cc,#f1bf63);cursor:pointer}button:disabled{opacity:.45}
</style>
<script>
(function(){
  var f=document.getElementById('otp'),I=[].slice.call(f.querySelectorAll('input')),btn=f.querySelector('button'),st=f.querySelector('p'),state='idle';
  function full(){return I.every(function(i){return /^\\d$/.test(i.value)})}
  function upd(){if(state==='idle')btn.disabled=!full()}
  function fill(d,k){for(var j=0;j<d.length&&k<I.length;j++,k++)I[k].value=d[j];I[Math.min(k,I.length-1)].focus();upd()}
  I.forEach(function(inp,i){
    inp.addEventListener('input',function(){var d=inp.value.replace(/\\D/g,'');if(d.length>1){inp.value='';return fill(d,i)}inp.value=d;if(d&&i<I.length-1)I[i+1].focus();upd()});
    inp.addEventListener('keydown',function(e){if(e.key==='Backspace'&&!inp.value&&i>0){e.preventDefault();I[i-1].value='';I[i-1].focus();upd()}});
    inp.addEventListener('paste',function(e){e.preventDefault();var d=e.clipboardData.getData('text').replace(/\\D/g,'');if(d)fill(d,d.length>=I.length?0:i)});
  });
  f.addEventListener('submit',function(e){e.preventDefault();
    if(state==='done'){state='idle';f.className='otp';I.forEach(function(i){i.value='';i.disabled=false;i.style.transform='';i.style.opacity=''});btn.textContent='Verify';st.textContent='';upd();I[0].focus();return}
    if(!full())return;state='busy';btn.disabled=true;
    I.forEach(function(i){var a=-Math.random()*Math.PI,r=90+Math.random()*80;i.disabled=true;i.style.transform='translate('+Math.cos(a)*r+'px,'+Math.sin(a)*r+'px) rotate('+(Math.random()*500-250)+'deg) scale(.4)';i.style.opacity=0});
    setTimeout(function(){f.classList.add('busy')},600);
    setTimeout(function(){f.className='otp done';state='done';btn.disabled=false;btn.textContent='Reset';st.textContent='Verified.'},1800);
  });
})();
</script>`,

    carousel: `<!-- Tactile · Glassy 3D coverflow: drag with momentum, glass detail panel -->
<div class="cf" id="cf" tabindex="0" aria-roledescription="carousel" aria-label="Posters"><div class="track"></div></div>
<div class="panel" aria-live="polite"><b id="t"></b><button id="p" aria-label="Previous">&lsaquo;</button><button id="n" aria-label="Next">&rsaquo;</button></div>
<style>
  body{margin:0;min-height:100vh;display:grid;place-content:center;gap:12px;background:#0c0c11;font-family:system-ui;color:#fff}
  .cf{position:relative;width:min(760px,100vw);height:340px;perspective:1100px;cursor:grab;touch-action:pan-y;user-select:none}
  .track{position:absolute;inset:0;transform-style:preserve-3d}
  .card{position:absolute;left:50%;top:50%;width:190px;height:266px;border-radius:18px;box-shadow:0 30px 50px -18px #000c,0 0 0 1px #fff2;overflow:hidden}
  .card::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,#fff6,transparent 40%);mix-blend-mode:screen}
  .panel{display:flex;gap:8px;align-items:center;justify-content:space-between;margin:0 auto;width:min(420px,90vw);padding:14px 18px;border-radius:18px;background:linear-gradient(140deg,#ffffff22,#ffffff0a);border:1px solid #fff3;backdrop-filter:blur(18px)}
  .panel b{flex:1}.panel button{width:38px;height:38px;border-radius:50%;border:1px solid #fff3;background:#ffffff12;color:#fff;font-size:20px;cursor:pointer}
</style>
<script>
(function(){
  var data=[['Solar Drift','#ff9f63','#2b0f3d'],['Night Bloom','#b06bff','#0d0420'],['Signal','#2fd4c4','#03181d'],['Dune Theory','#f0b35a','#5c2a12'],['Prism','#ff5fa2','#16101f'],['Orbit Club','#5b8cff','#060a1f'],['Soft Grid','#7be08a','#0e3b22']];
  var root=document.getElementById('cf'),track=root.firstElementChild,title=document.getElementById('t');
  var cards=data.map(function(d){var c=document.createElement('div');c.className='card';c.style.background='radial-gradient(circle at 50% 40%,'+d[1]+' 0 30%,transparent 31%),linear-gradient(160deg,'+d[1]+','+d[2]+')';track.appendChild(c);return c});
  var n=cards.length,pos=3,target=3,sp=114,drag=false,sx=0,sp0=0,lx=0,lt=0,v=0,raf=0;
  function cl(x,a,b){return Math.min(b,Math.max(a,x))}
  function render(){cards.forEach(function(c,i){var o=i-pos,a=Math.abs(o);c.style.transform='translate(-50%,-50%) translateX('+o*sp+'px) translateZ('+(-a*160)+'px) rotateY('+cl(-o*44,-62,62)+'deg)';c.style.zIndex=100-Math.round(a*10);c.style.opacity=cl(1.9-a*.5,0,1)});title.textContent=data[cl(Math.round(pos),0,n-1)][0]}
  function tick(){raf=0;if(!drag){pos+=(target-pos)*.14;if(Math.abs(target-pos)<.001)pos=target}render();if(drag||pos!==target)raf=requestAnimationFrame(tick)}
  function go(i){target=cl(i,0,n-1);if(!raf)raf=requestAnimationFrame(tick)}
  root.addEventListener('pointerdown',function(e){drag=true;sx=lx=e.clientX;sp0=pos;lt=performance.now();v=0;root.setPointerCapture(e.pointerId);go(target)});
  root.addEventListener('pointermove',function(e){if(!drag)return;var p=sp0-(e.clientX-sx)/sp;pos=p<0?p*.35:p>n-1?n-1+(p-n+1)*.35:p;var now=performance.now();v=v*.6+.4*(e.clientX-lx)/Math.max(now-lt,1);lx=e.clientX;lt=now});
  root.addEventListener('pointerup',function(){drag=false;go(Math.round(pos-v*260/sp))});
  root.addEventListener('keydown',function(e){if(e.key==='ArrowLeft')go(target-1);if(e.key==='ArrowRight')go(target+1)});
  document.getElementById('p').onclick=function(){go(target-1)};document.getElementById('n').onclick=function(){go(target+1)};
  render();
})();
</script>`,

    magnetic: `<!-- Tactile · Magnetic button with elastic return (GSAP 3.12.5) -->
<div class="field" id="field"><button class="mag" id="mag" type="button"><span>Hold on</span></button></div>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0e13}
  .field{width:360px;height:360px;display:grid;place-items:center}
  .mag{width:132px;height:132px;border-radius:50%;border:0;cursor:pointer;font:600 15px system-ui;background:radial-gradient(circle at 35% 30%,#fff,#f1ede6 40%,#c9c3ba);box-shadow:0 20px 40px -12px #000b}
  .mag span{display:inline-block;pointer-events:none}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script>
(function(){
  var f=document.getElementById('field'),b=document.getElementById('mag'),s=b.firstElementChild,pulled=false;
  f.addEventListener('pointermove',function(e){var r=b.getBoundingClientRect(),cx=r.left+r.width/2-gsap.getProperty(b,'x'),cy=r.top+r.height/2-gsap.getProperty(b,'y'),dx=e.clientX-cx,dy=e.clientY-cy;
    if(Math.hypot(dx,dy)<170){pulled=true;gsap.to(b,{x:dx*.42,y:dy*.42,duration:.35,ease:'power3.out',overwrite:true});gsap.to(s,{x:dx*.2,y:dy*.2,duration:.35,overwrite:true})}else if(pulled)release()});
  function release(){pulled=false;gsap.to([b,s],{x:0,y:0,duration:1.4,ease:'elastic.out(1.1,0.28)',overwrite:true})}
  f.addEventListener('pointerleave',release);
})();
</script>`,

    toggle: `<!-- Tactile · Liquid toggle: gooey SVG filter with trailing droplets (GSAP 3.12.5) -->
<button class="liquid" id="sw" type="button" role="switch" aria-checked="false" aria-label="Night mode">
  <svg viewBox="0 0 120 60" aria-hidden="true">
    <defs><filter id="goo"><feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="b"/><feColorMatrix in="b" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 22 -9" result="g"/><feComposite in="SourceGraphic" in2="g" operator="atop"/></filter></defs>
    <rect class="track" x="2" y="2" width="116" height="56" rx="28"/>
    <g filter="url(#goo)" fill="#f4f2ee"><circle class="b3" cx="30" cy="30" r="9"/><circle class="b2" cx="30" cy="30" r="13"/><circle class="b1" cx="30" cy="30" r="19"/></g>
  </svg>
</button>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0d0f12}
  .liquid{width:150px;height:75px;padding:0;border:0;background:none;cursor:pointer}.liquid svg{width:100%;height:100%;overflow:visible}
  .track{fill:#23232b;transition:fill .5s}.liquid[aria-checked=true] .track{fill:#1aa79a}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script>
(function(){
  var sw=document.getElementById('sw'),q=function(s){return sw.querySelector(s)};
  sw.addEventListener('click',function(){var on=sw.getAttribute('aria-checked')!=='true',x=on?90:30;sw.setAttribute('aria-checked',on);
    gsap.to(q('.b1'),{attr:{cx:x},duration:.75,ease:'elastic.out(1,0.55)'});
    gsap.to(q('.b2'),{attr:{cx:x},duration:.7,delay:.07,ease:'power3.inOut'});
    gsap.to(q('.b3'),{attr:{cx:x},duration:.75,delay:.14,ease:'power3.inOut'});});
})();
</script>`,

    jelly: `<!-- Tactile · Jelly checkbox: squash and stretch (GSAP 3.12.5) -->
<button class="jelly" type="button" role="checkbox" aria-checked="false"><span class="box"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><span class="txt">Wobble the details</span></button>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0e0d13;font-family:system-ui;color:#eee}
  .jelly{display:flex;align-items:center;gap:14px;border:0;background:none;color:inherit;font:500 16px system-ui;cursor:pointer}
  .box{width:30px;height:30px;border-radius:10px;display:grid;place-items:center;border:2px solid #fff4;transform-origin:50% 100%;transition:background .3s,border-color .3s}
  .box svg{width:20px;height:20px}.box path{fill:none;stroke:#fff;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .35s .08s}
  .jelly[aria-checked=true] .box{background:linear-gradient(160deg,#b7a9ff,#7a63ff);border-color:transparent}
  .jelly[aria-checked=true] path{stroke-dashoffset:0}.jelly[aria-checked=true] .txt{opacity:.45;text-decoration:line-through}
</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script>
document.querySelectorAll('.jelly').forEach(function(b){var box=b.querySelector('.box');
  b.addEventListener('click',function(){b.setAttribute('aria-checked',b.getAttribute('aria-checked')!=='true');
    gsap.timeline({overwrite:true}).to(box,{scaleX:1.32,scaleY:.68,duration:.11}).to(box,{scaleX:.82,scaleY:1.24,y:-5,duration:.13}).to(box,{scaleX:1.1,scaleY:.9,y:0,duration:.12}).to(box,{scaleX:1,scaleY:1,duration:.6,ease:'elastic.out(1,0.35)'});});});
</script>`,

    text: `<!-- Tactile · Text links: scramble, letter roll, hover split -->
<nav class="links">
  <a href="#" class="scramble" aria-label="View the archive"><span aria-hidden="true">View the archive</span></a>
  <a href="#" class="roll" aria-label="Read the notes"><span aria-hidden="true">Read the notes</span></a>
  <a href="#" class="split" aria-label="Back to top"><span class="top" aria-hidden="true">Back to top</span><span class="bot" aria-hidden="true">Back to top</span><span class="mid" aria-hidden="true">lift off</span></a>
</nav>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#100f0d;color:#eeebe5;font-family:system-ui}
  .links{display:grid;gap:22px;justify-items:center}.links a{color:inherit;text-decoration:none;font-size:26px;font-weight:600}
  .scramble{font-family:ui-monospace,monospace;color:#ffd29a}.scramble i{font-style:normal;opacity:.4}
  .roll .c{display:inline-block;overflow:hidden;height:1.15em;line-height:1.15;vertical-align:top}
  .roll .c b{display:inline-block;position:relative;font-weight:inherit;transition:transform .45s cubic-bezier(.7,0,.2,1)}
  .roll .c b::after{content:attr(data-c);position:absolute;left:0;top:100%;color:#ff8fb1;font-style:italic}
  .roll:hover .c b{transform:translateY(-100%)}
  .split{position:relative}.split span{display:block;transition:transform .45s cubic-bezier(.7,0,.2,1)}
  .split .top{clip-path:inset(0 0 50% 0)}.split .bot{position:absolute;inset:0;clip-path:inset(50% 0 0 0)}
  .split .mid{position:absolute;inset:0;display:grid;place-items:center;font-size:11px;letter-spacing:.35em;text-transform:uppercase;color:#9d8cff;opacity:0;transform:scaleY(.2)}
  .split:hover .top{transform:translateY(-32%)}.split:hover .bot{transform:translateY(32%)}.split:hover .mid{opacity:1;transform:none}
</style>
<script>
(function(){
  var G='!<>-_/[]{}=+*^?#%&01',s=document.querySelector('.scramble span'),T=s.textContent;
  function esc(c){return c.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')}
  document.querySelector('.scramble').addEventListener('pointerenter',function(){var q=T.split('').map(function(c,i){return{c:c,e:Math.floor(i*1.6+6+Math.random()*10)}}),f=0;
    (function fr(){var h='',d=0;q.forEach(function(o){if(o.c===' '||f>=o.e){h+=esc(o.c);d++}else h+='<i>'+esc(G[Math.random()*G.length|0])+'</i>'});s.innerHTML=h;f++;if(d<q.length)requestAnimationFrame(fr)})()});
  var r=document.querySelector('.roll span'),t=r.textContent;r.textContent='';
  t.split('').forEach(function(ch,i){var o=document.createElement('span'),b=document.createElement('b');o.className='c';ch=ch===' '?'\\u00a0':ch;b.textContent=ch;b.dataset.c=ch;b.style.transitionDelay=i*18+'ms';o.appendChild(b);r.appendChild(o)});
})();
</script>`,
  };

  /* -------------------------------------------------------- */
  [initHero, initFluffy, initFabric, initOTP, initCarousel, initMagnetic, initToggle, initJelly, initText, initSpotlight, initCopy, initReveal].forEach(safe);
})();
