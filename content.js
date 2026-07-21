if (!globalThis.__kzLoaded) {
  globalThis.__kzLoaded = true;

  (function () {
    const api = globalThis.browser || globalThis.chrome;
    const HOST_ID = "kz-koala-host";

    const ENTRANCES = ["kz-enter-rise", "kz-enter-drop", "kz-enter-pop", "kz-enter-peekR", "kz-enter-slideL"];

    const EXITS = [
      { cls: "kz-exit-jump", dur: 1250, cry: "wheeee !" },
      { cls: "kz-exit-rollL", dur: 1450 },
      { cls: "kz-exit-rollR", dur: 1450 },
      { cls: "kz-exit-shrink", dur: 1050, poof: true },
      { cls: "kz-exit-balloon", dur: 1850, balloon: true },
      { cls: "kz-exit-slideDown", dur: 1150, cry: "à plus ! 👋" },
      { cls: "kz-exit-spinAway", dur: 1450, cry: "zooom !" },
      { cls: "kz-exit-vortex", dur: 1350 },
      { cls: "kz-exit-faint", dur: 1650, zzz: true },
      { cls: "kz-exit-moon", dur: 1650, cry: "vers la lune ! 🚀" }
    ];

    const KOALA_SVG = `
<svg class="kz-svg" viewBox="0 0 220 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="kzFur" cx="50%" cy="40%" r="66%">
      <stop offset="0%" stop-color="#d3d7dd"/>
      <stop offset="68%" stop-color="#aeb4bd"/>
      <stop offset="100%" stop-color="#8d949f"/>
    </radialGradient>
    <radialGradient id="kzEar" cx="50%" cy="50%" r="62%">
      <stop offset="0%" stop-color="#f2e0db"/>
      <stop offset="55%" stop-color="#d9a7a0"/>
      <stop offset="100%" stop-color="#b57e77"/>
    </radialGradient>
    <linearGradient id="kzNose" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#5c5c64"/>
      <stop offset="45%" stop-color="#3a3a40"/>
      <stop offset="100%" stop-color="#212125"/>
    </linearGradient>
    <radialGradient id="kzBelly" cx="50%" cy="38%" r="62%">
      <stop offset="0%" stop-color="#f5f7f9"/>
      <stop offset="100%" stop-color="#d6dbe1"/>
    </radialGradient>
    <filter id="kzFluff" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="kzSoft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity="0.18"/>
    </filter>
  </defs>

  <g filter="url(#kzSoft)">
    <g filter="url(#kzFluff)">
      <circle cx="52" cy="56" r="40" fill="url(#kzFur)"/>
      <circle cx="168" cy="56" r="40" fill="url(#kzFur)"/>
    </g>
    <circle cx="52" cy="58" r="24" fill="url(#kzEar)"/>
    <circle cx="168" cy="58" r="24" fill="url(#kzEar)"/>

    <ellipse cx="110" cy="198" rx="66" ry="44" fill="url(#kzFur)" filter="url(#kzFluff)"/>
    <ellipse cx="110" cy="202" rx="40" ry="28" fill="url(#kzBelly)"/>

    <g id="kzArmL"><ellipse cx="44" cy="152" rx="15" ry="24" fill="url(#kzFur)" transform="rotate(-16 44 152)"/></g>
    <g id="kzArmR"><ellipse cx="176" cy="150" rx="16" ry="26" fill="url(#kzFur)" transform="rotate(18 176 150)"/></g>

    <ellipse cx="110" cy="112" rx="82" ry="74" fill="url(#kzFur)" filter="url(#kzFluff)"/>
    <ellipse cx="110" cy="132" rx="58" ry="46" fill="#e7ebef" opacity="0.5"/>

    <ellipse cx="66" cy="134" rx="14" ry="9" fill="#e79a93" opacity="0.35"/>
    <ellipse cx="154" cy="134" rx="14" ry="9" fill="#e79a93" opacity="0.35"/>

    <g class="kz-eyes">
      <g class="kz-eye"><circle cx="82" cy="104" r="9" fill="#25242a"/><circle cx="85" cy="101" r="3" fill="#fff" opacity="0.92"/></g>
      <g class="kz-eye"><circle cx="138" cy="104" r="9" fill="#25242a"/><circle cx="141" cy="101" r="3" fill="#fff" opacity="0.92"/></g>
    </g>

    <path d="M110 118 C133 118 146 132 146 150 C146 168 130 180 110 180 C90 180 74 168 74 150 C74 132 87 118 110 118 Z" fill="url(#kzNose)"/>
    <ellipse cx="98" cy="140" rx="9" ry="6" fill="#fff" opacity="0.15"/>
    <path d="M96 187 Q110 197 124 187" stroke="#5b4a46" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

    const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }
.kz-koala {
  position: fixed; right: 26px; bottom: 22px; width: auto; height: auto;
  pointer-events: auto; cursor: pointer; z-index: 2147483647; will-change: transform, opacity;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
.kz-inner { display: block; transform-origin: bottom center; animation: kzBreath 4s ease-in-out infinite; }
.kz-koala--sport .kz-inner { animation: kzBounce .5s ease-in-out infinite; }
.kz-photo { display: block; height: auto; width: auto; max-height: 184px; max-width: 300px; pointer-events: none; -webkit-user-drag: none; user-select: none; filter: drop-shadow(0 9px 11px rgba(0,0,0,.22)); animation: kzSway 5.2s ease-in-out infinite; }
.kz-svg { width: auto; height: 200px; display: block; overflow: visible; }
.kz-eye { transform-box: fill-box; transform-origin: center; animation: kzBlink 5.4s infinite; }
#kzArmR { transform-box: fill-box; transform-origin: 45% 82%; animation: kzWave 3.4s ease-in-out infinite; }

.kz-bubble {
  position: absolute; bottom: calc(100% - 8px); right: 6px; max-width: 268px; min-width: 196px;
  background: #fff; color: #23252b; border-radius: 18px; padding: 12px 14px;
  box-shadow: 0 12px 34px rgba(0,0,0,.2); border: 1px solid rgba(0,0,0,.06);
  opacity: 0; transform: translateY(8px) scale(.96); transform-origin: bottom right;
  transition: opacity .28s ease, transform .3s cubic-bezier(.2,1.3,.4,1); line-height: 1.42; font-size: 15px;
}
.kz-bubble.kz-show { opacity: 1; transform: translateY(0) scale(1); }
.kz-bubble::after {
  content: ""; position: absolute; right: 40px; bottom: -9px; width: 18px; height: 18px; background: #fff;
  border-right: 1px solid rgba(0,0,0,.06); border-bottom: 1px solid rgba(0,0,0,.06); transform: rotate(45deg);
}
.kz-bubble-head { font-weight: 700; font-size: 13.5px; margin-bottom: 5px; }
.kz-bubble--sport { background: #fff4e6; } .kz-bubble--sport::after { background: #fff4e6; }
.kz-bubble--sport .kz-bubble-head { color: #c2410c; }
.kz-bubble--quote { background: #eef5f0; } .kz-bubble--quote::after { background: #eef5f0; }
.kz-bubble--quote .kz-bubble-head { color: #256b4a; }
.kz-quote-text { font-style: italic; }
.kz-quote-author { margin-top: 6px; font-size: 13px; opacity: .68; text-align: right; }

.kz-cry {
  position: absolute; right: 18px; top: -12px; background: #23252b; color: #fff; font-size: 13px; font-weight: 700;
  padding: 4px 9px; border-radius: 12px; white-space: nowrap; opacity: 0; transform: translateY(6px);
  transition: opacity .2s ease, transform .2s ease;
}
.kz-cry.kz-show { opacity: 1; transform: translateY(0); }
.kz-balloon { position: absolute; right: 28px; top: -30px; font-size: 34px; }
.kz-zzz { position: absolute; right: 6px; top: -6px; font-size: 24px; opacity: 0; animation: kzZzz 1.6s ease forwards; }
.kz-puff { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 120px; opacity: 0; animation: kzPuff 1s ease forwards; pointer-events: none; }

@keyframes kzBreath { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-2px) scale(1.015); } }
@keyframes kzSway { 0%,100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
@keyframes kzBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-11px); } }
@keyframes kzBlink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(.12); } }
@keyframes kzWave { 0%,68%,100% { transform: rotate(0); } 80% { transform: rotate(-22deg); } 90% { transform: rotate(8deg); } }
@keyframes kzZzz { 0% { opacity: 0; transform: translateY(0) scale(.8); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-42px) scale(1.2); } }
@keyframes kzPuff { 0% { opacity: 0; transform: scale(.3); } 40% { opacity: .95; } 100% { opacity: 0; transform: scale(1.6); } }

.kz-enter-rise { animation: kzEnterRise .9s cubic-bezier(.2,1.1,.3,1) both; }
.kz-enter-drop { animation: kzEnterDrop 1s cubic-bezier(.2,1.1,.3,1) both; }
.kz-enter-pop { animation: kzEnterPop .7s cubic-bezier(.2,1.4,.4,1) both; }
.kz-enter-peekR { animation: kzEnterPeekR .9s cubic-bezier(.2,1.1,.3,1) both; }
.kz-enter-slideL { animation: kzEnterSlideL .9s cubic-bezier(.2,1.1,.3,1) both; }
@keyframes kzEnterRise { 0% { transform: translateY(150%); opacity: 0; } 60% { transform: translateY(-6%); opacity: 1; } 100% { transform: translateY(0); } }
@keyframes kzEnterDrop { 0% { transform: translateY(-170%); opacity: 0; } 55% { transform: translateY(8%); opacity: 1; } 75% { transform: translateY(-4%); } 100% { transform: translateY(0); } }
@keyframes kzEnterPop { 0% { transform: scale(0); opacity: 0; } 70% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
@keyframes kzEnterPeekR { 0% { transform: translateX(170%); opacity: 0; } 70% { transform: translateX(-8%); opacity: 1; } 100% { transform: translateX(0); } }
@keyframes kzEnterSlideL { 0% { transform: translateX(-190%) rotate(-8deg); opacity: 0; } 70% { transform: translateX(6%) rotate(3deg); opacity: 1; } 100% { transform: translateX(0) rotate(0); } }

.kz-exit-waddle { animation: kzExitWaddle 1s ease-in both; }
.kz-exit-jump { animation: kzExitJump 1.25s cubic-bezier(.4,0,.6,1) both; }
.kz-exit-rollL { animation: kzExitRollL 1.45s ease-in both; }
.kz-exit-rollR { animation: kzExitRollR 1.45s ease-in both; }
.kz-exit-shrink { animation: kzExitShrink 1.05s ease-in both; }
.kz-exit-balloon { animation: kzExitBalloon 1.85s ease-in both; }
.kz-exit-slideDown { animation: kzExitSlideDown 1.15s cubic-bezier(.5,0,.9,.6) both; }
.kz-exit-spinAway { animation: kzExitSpinAway 1.45s ease-in both; }
.kz-exit-vortex { animation: kzExitVortex 1.35s ease-in both; }
.kz-exit-faint { animation: kzExitFaint 1.65s ease-in both; }
.kz-exit-moon { animation: kzExitMoon 1.65s ease-in both; }
@keyframes kzExitWaddle { 0% { transform: translateX(0) rotate(0); } 20% { transform: translateX(6%) rotate(4deg); } 40% { transform: translateX(2%) rotate(-3deg); } 100% { transform: translateX(210%) rotate(8deg); opacity: 0; } }
@keyframes kzExitJump { 0% { transform: translateY(0); } 22% { transform: translateY(-36px); } 100% { transform: translateY(-170vh); opacity: 0; } }
@keyframes kzExitRollL { 0% { transform: translate(0) rotate(0); opacity: 1; } 100% { transform: translate(-175vw,-8px) rotate(-1080deg); opacity: 0; } }
@keyframes kzExitRollR { 0% { transform: translate(0) rotate(0); opacity: 1; } 100% { transform: translate(175vw,-8px) rotate(1080deg); opacity: 0; } }
@keyframes kzExitShrink { 0% { transform: scale(1); opacity: 1; } 65% { transform: scale(.16) rotate(20deg); opacity: 1; } 100% { transform: scale(0); opacity: 0; } }
@keyframes kzExitBalloon { 0% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-40vh) rotate(3deg); } 100% { transform: translateY(-150vh) rotate(-4deg); opacity: 0; } }
@keyframes kzExitSlideDown { 0% { transform: translateY(0); opacity: 1; } 100% { transform: translateY(170vh); opacity: 0; } }
@keyframes kzExitSpinAway { 0% { transform: translate(0) scale(1) rotate(0); opacity: 1; } 100% { transform: translate(120vw,-120vh) scale(.3) rotate(720deg); opacity: 0; } }
@keyframes kzExitVortex { 0% { transform: scale(1) rotate(0); opacity: 1; } 60% { transform: scale(.55) rotate(560deg); opacity: 1; } 100% { transform: scale(0) rotate(1120deg); opacity: 0; } }
@keyframes kzExitFaint { 0% { transform: rotate(0); } 30% { transform: rotate(-5deg); } 55% { transform: rotate(2deg); } 100% { transform: translateY(26px) rotate(-86deg); opacity: 0; } }
@keyframes kzExitMoon { 0% { transform: translate(0) rotate(0); } 100% { transform: translate(-45vw,-155vh) rotate(-28deg); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .kz-inner, .kz-photo, #kzArmR, .kz-eye { animation: none !important; }
  .kz-enter-rise, .kz-enter-drop, .kz-enter-pop, .kz-enter-peekR, .kz-enter-slideL,
  .kz-exit-waddle, .kz-exit-jump, .kz-exit-rollL, .kz-exit-rollR, .kz-exit-shrink,
  .kz-exit-balloon, .kz-exit-slideDown, .kz-exit-spinAway, .kz-exit-vortex,
  .kz-exit-faint, .kz-exit-moon { animation: none !important; }
  .kz-balloon, .kz-zzz, .kz-puff, .kz-cry { display: none !important; }
}

.kz-actions { display: flex; gap: 8px; margin-top: 11px; }
.kz-btn { font: inherit; font-size: 12.5px; font-weight: 700; border-radius: 10px; padding: 7px 13px; cursor: pointer; border: 1px solid transparent; }
.kz-btn--done { background: #256b4a; color: #fff; }
.kz-btn--later { background: #fff; color: #23252b; border-color: rgba(0,0,0,.16); }
.kz-btn:hover { filter: brightness(1.05); }
.kz-focus-back { position: fixed; inset: 0; z-index: 2147483646; background: rgba(16,20,26,.55); opacity: 0; transition: opacity .35s ease; pointer-events: auto; cursor: default; }
.kz-focus-back.kz-show { opacity: 1; }
.kz-focus-timer { margin-top: 9px; font-size: 15px; font-weight: 800; color: #256b4a; font-variant-numeric: tabular-nums; letter-spacing: .4px; }
.kz-btn--done[disabled] { opacity: .55; cursor: default; }
.kz-btn--done.kz-btn--ready { opacity: 1; }
.kz-energy { margin-top: 11px; }
.kz-energy-q { font-size: 12.5px; color: #6b7280; margin-bottom: 7px; }
.kz-energy-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
.kz-energy-btn { font: inherit; font-size: 12px; font-weight: 700; height: 28px; border-radius: 8px; border: 1px solid rgba(0,0,0,.14); background: #fff; color: #23252b; cursor: pointer; }
.kz-energy-btn:hover { background: #eef5f0; border-color: #256b4a; }
.kz-energy-skip { margin-top: 8px; padding: 0; border: none; background: none; color: #6b7280; font: inherit; font-size: 11.5px; text-decoration: underline; cursor: pointer; }`;

    let running = false;

    function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    function ensureShadow() {
      let host = document.getElementById(HOST_ID);
      if (host && host.shadowRoot) return host.shadowRoot;
      host = document.createElement("div");
      host.id = HOST_ID;
      host.setAttribute("style", "all:initial;position:fixed;left:0;top:0;width:0;height:0;");
      const shadow = host.attachShadow({ mode: "open" });
      const style = document.createElement("style");
      style.textContent = STYLES;
      shadow.appendChild(style);
      (document.body || document.documentElement).appendChild(host);
      return shadow;
    }

    const DEFAULT_KOALAS = ["images/koala-1.png", "images/koala-2.png", "images/koala-3.png", "images/koala-paddle.png"];

    function defaultUrls() {
      return DEFAULT_KOALAS
        .map((p) => { try { return api.runtime.getURL(p); } catch (e) { return ""; } })
        .filter(Boolean);
    }

    let KOALAS = defaultUrls();
    let lastKoala = -1;
    let QUOTES = (typeof KZ_QUOTES !== "undefined") ? KZ_QUOTES : [];
    let SPORT = (typeof KZ_SPORT !== "undefined") ? KZ_SPORT : [];

    function kzMsg(key, fallback) {
      try { const m = (api.i18n && api.i18n.getMessage) ? api.i18n.getMessage(key) : ""; return m || fallback; } catch (e) { return fallback; }
    }

    function sendOutcome(result, energy) { try { api.runtime.sendMessage({ type: "kz-outcome", result: result, energy: (typeof energy === "number" ? energy : null) }); } catch (e) { /* noop */ } }

    function showEnergyPicker(container, onPick) {
      const box = document.createElement("div");
      box.className = "kz-energy";
      const q = document.createElement("div"); q.className = "kz-energy-q"; q.textContent = kzMsg("energyQ", "Ton énergie, de 1 à 10 ?");
      const row = document.createElement("div"); row.className = "kz-energy-row";
      let picked = false;
      for (let i = 1; i <= 10; i++) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "kz-energy-btn"; b.textContent = String(i);
        b.addEventListener("click", (e) => { e.stopPropagation(); if (!picked) { picked = true; onPick(i); } });
        row.appendChild(b);
      }
      const skip = document.createElement("button");
      skip.type = "button"; skip.className = "kz-energy-skip"; skip.textContent = kzMsg("energySkip", "Passer");
      skip.addEventListener("click", (e) => { e.stopPropagation(); if (!picked) { picked = true; onPick(null); } });
      box.appendChild(q); box.appendChild(row); box.appendChild(skip);
      container.appendChild(box);
      return box;
    }

    function showEnergyBubble(wrap, onPick) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--energy";
      const head = document.createElement("div"); head.className = "kz-bubble-head"; head.textContent = kzMsg("energyHead", "🐨 Bien joué !");
      b.appendChild(head);
      showEnergyPicker(b, onPick);
      wrap.appendChild(b);
      requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add("kz-show")));
      return b;
    }

    async function loadSettings() {
      try {
        const r = await api.storage.local.get(["customKoalas", "includeDefaultKoalas", "customQuotes", "customSport", "includeDefaultQuotes"]);
        const customs = Array.isArray(r.customKoalas) ? r.customKoalas.filter((s) => typeof s === "string" && s) : [];
        const defs = defaultUrls();
        KOALAS = customs.length ? (r.includeDefaultKoalas ? customs.concat(defs) : customs) : defs;
        if (!KOALAS.length) KOALAS = [""];

        const baseQ = (typeof KZ_QUOTES !== "undefined") ? KZ_QUOTES : [];
        const cq = Array.isArray(r.customQuotes) ? r.customQuotes.filter((q) => q && typeof q.t === "string" && q.t.trim()) : [];
        QUOTES = cq.length ? (r.includeDefaultQuotes ? baseQ.concat(cq) : cq) : baseQ;

        const baseS = (typeof KZ_SPORT !== "undefined") ? KZ_SPORT : [];
        const cs = Array.isArray(r.customSport) ? r.customSport.filter((s) => typeof s === "string" && s.trim()) : [];
        SPORT = cs.length ? cs : baseS;
      } catch (e) {
        KOALAS = defaultUrls();
        QUOTES = (typeof KZ_QUOTES !== "undefined") ? KZ_QUOTES : [];
        SPORT = (typeof KZ_SPORT !== "undefined") ? KZ_SPORT : [];
      }
    }

    function pickKoala(exclude) {
      let i = Math.floor(Math.random() * KOALAS.length);
      if (KOALAS.length > 1 && i === exclude) i = (i + 1) % KOALAS.length;
      lastKoala = i;
      return i;
    }

    function svgNode() {
      try {
        const doc = new DOMParser().parseFromString(KOALA_SVG, "image/svg+xml");
        const el = doc.documentElement;
        if (el && String(el.nodeName).toLowerCase() === "svg") return document.importNode(el, true);
      } catch (e) { /* noop */ }
      return null;
    }

    function setSvgFallback(container) {
      container.textContent = "";
      const n = svgNode();
      if (n) container.appendChild(n);
    }

    function buildKoala(shadow, idx) {
      const wrap = document.createElement("div");
      wrap.className = "kz-koala";
      const inner = document.createElement("div");
      inner.className = "kz-inner";
      const src = KOALAS[idx];
      if (src) {
        const img = document.createElement("img");
        img.className = "kz-photo";
        img.alt = "";
        img.decoding = "async";
        img.addEventListener("error", () => { setSvgFallback(inner); });
        img.src = src;
        inner.appendChild(img);
      } else {
        setSvgFallback(inner);
      }
      wrap.appendChild(inner);
      shadow.appendChild(wrap);
      return wrap;
    }

    function showQuoteBubble(wrap, quoteText, author) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--quote";
      const head = document.createElement("div"); head.className = "kz-bubble-head"; head.textContent = kzMsg("bubbleWisdom", "🐨 Un souffle de sagesse…");
      const qt = document.createElement("div"); qt.className = "kz-quote-text"; qt.textContent = "« " + quoteText + " »";
      b.appendChild(head); b.appendChild(qt);
      if (author) { const qa = document.createElement("div"); qa.className = "kz-quote-author"; qa.textContent = "— " + author; b.appendChild(qa); }
      wrap.appendChild(b);
      requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add("kz-show")));
      return b;
    }

    function showSportBubble(wrap, promptText, handlers) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--sport";
      const head = document.createElement("div");
      head.className = "kz-bubble-head";
      head.textContent = kzMsg("bubbleSport", "🐨 On bouge un peu !");
      const body = document.createElement("div");
      body.textContent = promptText;
      const actions = document.createElement("div");
      actions.className = "kz-actions";
      const done = document.createElement("button");
      done.type = "button"; done.className = "kz-btn kz-btn--done"; done.textContent = kzMsg("btnDone", "Fait ✅");
      const later = document.createElement("button");
      later.type = "button"; later.className = "kz-btn kz-btn--later"; later.textContent = kzMsg("btnLater", "Plus tard");
      done.addEventListener("click", (e) => { e.stopPropagation(); handlers.onDone(); });
      later.addEventListener("click", (e) => { e.stopPropagation(); handlers.onLater(); });
      actions.appendChild(done); actions.appendChild(later);
      b.appendChild(head); b.appendChild(body); b.appendChild(actions);
      wrap.appendChild(b);
      requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add("kz-show")));
      return b;
    }

    async function runFocus(shadow, seconds) {
      // Fond assombri qui bloque la page: c'est la seule chose propre au mode focus.
      const back = document.createElement("div");
      back.className = "kz-focus-back";
      shadow.appendChild(back);
      requestAnimationFrame(() => back.classList.add("kz-show"));

      const fmt = (s) => (s >= 60 ? Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0") : s + "s");

      // ---- Le koala arrive dans son coin, animé, exactement comme en mode normal ----
      const k1 = buildKoala(shadow, pickKoala(lastKoala));
      k1.classList.add("kz-koala--sport");
      playEnter(k1);
      await sleep(950);

      // Bulle sport habituelle, avec un compte à rebours qui déverrouille "Fait"
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--sport";
      const head = document.createElement("div"); head.className = "kz-bubble-head"; head.textContent = kzMsg("bubbleSport", "🐨 On bouge un peu !");
      const body = document.createElement("div"); body.textContent = rand(SPORT);
      const timer = document.createElement("div"); timer.className = "kz-focus-timer";
      const actions = document.createElement("div"); actions.className = "kz-actions";
      const done = document.createElement("button"); done.type = "button"; done.className = "kz-btn kz-btn--done"; done.disabled = true; done.textContent = kzMsg("btnBreakOver", "Pause en cours…");
      actions.appendChild(done);
      b.appendChild(head); b.appendChild(body); b.appendChild(timer); b.appendChild(actions);
      k1.appendChild(b);
      requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add("kz-show")));

      let left = seconds;
      timer.textContent = fmt(left);
      await new Promise((resolve) => {
        const t = setInterval(() => {
          left -= 1;
          timer.textContent = fmt(Math.max(0, left));
          if (left <= 0) { clearInterval(t); resolve(); }
        }, 1000);
      });
      timer.remove();
      done.disabled = false; done.classList.add("kz-btn--ready"); done.textContent = kzMsg("btnDone", "Fait ✅");
      await new Promise((resolve) => { done.addEventListener("click", (e) => { e.stopPropagation(); resolve(); }, { once: true }); });

      // ---- Énergie (grille 2x5, comme en mode normal) ----
      b.remove();
      const energy = await new Promise((resolve) => { showEnergyBubble(k1, (v) => resolve(v)); });
      k1.classList.remove("kz-koala--sport");
      await playExit(k1, { cls: "kz-exit-waddle", dur: 1000 });
      k1.remove();
      sendOutcome("done", energy);

      // ---- Citation en récompense sur un second koala, comme en mode normal ----
      await sleep(1200);
      const k2 = buildKoala(shadow, pickKoala(lastKoala));
      let d2 = false;
      k2.addEventListener("click", () => { d2 = true; });
      playEnter(k2);
      await sleep(950);
      const q = rand(QUOTES);
      showQuoteBubble(k2, q.t, q.a);
      await waitOrDismiss(9500, () => d2);
      const exit = d2 ? EXITS[Math.floor(Math.random() * EXITS.length)] : await pickExit();
      await playExit(k2, exit);
      k2.remove();

      back.classList.remove("kz-show");
      await sleep(320);
      back.remove();
    }

    function playEnter(wrap) { wrap.classList.add(rand(ENTRANCES)); }

    async function pickExit() {
      let last = -1;
      try { const r = await api.storage.local.get("kzLastExit"); last = (r && r.kzLastExit != null) ? r.kzLastExit : -1; } catch (e) { /* noop */ }
      let idx = Math.floor(Math.random() * EXITS.length);
      if (EXITS.length > 1 && idx === last) idx = (idx + 1) % EXITS.length;
      try { await api.storage.local.set({ kzLastExit: idx }); } catch (e) { /* noop */ }
      return EXITS[idx];
    }

    async function playExit(wrap, exit) {
      ENTRANCES.forEach((c) => wrap.classList.remove(c));
      const inner = wrap.querySelector(".kz-inner");
      if (exit.cry) {
        const c = document.createElement("div");
        c.className = "kz-cry";
        c.textContent = exit.cry;
        wrap.appendChild(c);
        requestAnimationFrame(() => c.classList.add("kz-show"));
      }
      if (exit.balloon) { const el = document.createElement("div"); el.className = "kz-balloon"; el.textContent = "🎈"; inner.appendChild(el); }
      if (exit.zzz) { const el = document.createElement("div"); el.className = "kz-zzz"; el.textContent = "💤"; wrap.appendChild(el); }
      if (exit.poof) { const el = document.createElement("div"); el.className = "kz-puff"; el.textContent = "💨"; inner.appendChild(el); }
      wrap.classList.add(exit.cls);
      await sleep(exit.dur);
    }

    function clearKoalas() {
      const host = document.getElementById(HOST_ID);
      if (host && host.shadowRoot) host.shadowRoot.querySelectorAll(".kz-koala, .kz-focus, .kz-focus-back").forEach((n) => n.remove());
    }

    async function waitOrDismiss(ms, isDismissed) {
      const step = 100;
      let t = 0;
      while (t < ms) { if (isDismissed()) return; await sleep(step); t += step; }
    }

    async function quickBye(wrap) {
      ENTRANCES.forEach((c) => wrap.classList.remove(c));
      wrap.classList.remove("kz-koala--sport");
      wrap.classList.add("kz-exit-shrink");
      await sleep(1050);
    }

    async function runSequence(opts) {
      if (running) return;
      running = true;
      const focus = !!(opts && opts.focus);
      const focusSeconds = Math.max(5, Math.min(120, Math.round((opts && opts.focusSeconds) || 30)));
      const shadow = ensureShadow();
      await loadSettings();

      try {
        if (focus) { await runFocus(shadow, focusSeconds); return; }

        // ---- Passage 1 : bouger, avec validation ----
        const k1 = buildKoala(shadow, pickKoala(lastKoala));
        k1.classList.add("kz-koala--sport");
        playEnter(k1);
        await sleep(950);

        let sportBubble = null;
        const outcome = await new Promise((resolve) => {
          let settled = false;
          const finish = (r) => { if (!settled) { settled = true; resolve(r); } };
          sportBubble = showSportBubble(k1, rand(SPORT), { onDone: () => finish("done"), onLater: () => finish("later") });
          setTimeout(() => finish("missed"), 18000);
        });

        if (outcome !== "done") {
          k1.classList.remove("kz-koala--sport");
          await playExit(k1, { cls: "kz-exit-waddle", dur: 1000 });
          k1.remove();
          sendOutcome(outcome);
          return;
        }

        // ---- Niveau d'énergie (facultatif) ----
        if (sportBubble) sportBubble.remove();
        const energy = await new Promise((resolve) => { showEnergyBubble(k1, (v) => resolve(v)); });
        k1.classList.remove("kz-koala--sport");
        await playExit(k1, { cls: "kz-exit-waddle", dur: 1000 });
        k1.remove();
        sendOutcome("done", energy);

        // ---- Passage 2 : citation en récompense ----
        await sleep(2000);
        const k2 = buildKoala(shadow, pickKoala(lastKoala));
        let d2 = false;
        k2.addEventListener("click", () => { d2 = true; });
        playEnter(k2);
        await sleep(950);
        const q = rand(QUOTES);
        showQuoteBubble(k2, q.t, q.a);
        await waitOrDismiss(9500, () => d2);
        const exit = d2 ? EXITS[Math.floor(Math.random() * EXITS.length)] : await pickExit();
        await playExit(k2, exit);
        k2.remove();
      } finally {
        clearKoalas();
        running = false;
      }
    }

    api.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "kz-show") runSequence({ focus: msg.focus, focusSeconds: msg.focusSeconds });
    });
  })();
}
