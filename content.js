if (!globalThis.__kzLoaded) {
  globalThis.__kzLoaded = true;

  (function () {
    const api = globalThis.browser || globalThis.chrome;
    const HOST_ID = "kz-koala-host";

    // Choregraphie unique de la maquette. Le koala glisse du coin et repart par le meme chemin.
    const T = {
      arrive: 240,      // arrivee du koala
      bubble: 180,      // ouverture de la bulle
      line: 60,         // decalage entre lignes
      check: 300,       // coche de validation
      hold: 1200,       // temps de lecture avant la sortie
      leave: 200,       // sortie
      quote: 260,       // montee de la citation
      swap: 200,        // fondu croise entre reponses
      reduced: 120,     // tout se resume a ce fondu si le mouvement est reduit
      sob: 1500,        // duree de la scene de larmes sur Jamais
      tear: 700,        // chute d'une larme
      tearGap: 260,     // ecart entre deux larmes
      blink: 120,       // fermeture de la paupiere
      blinkEvery: 6500  // intervalle entre deux clignements
    };

    // Les cinq personnages de relance du build public, planche 05. Le koala
    // sournois ouvre TOUJOURS le cycle, puis on avance d'un cran par report et
    // le cycle repart a zero chaque matin. Jamais deux fois le meme d'affilee.
    const RELANCE_SVG_KOALA = `<svg viewBox="0 0 78 76" aria-hidden="true" style="overflow:visible;animation:kzSneak 5s ease-in-out infinite;transform-origin:50% 95%"> <ellipse cx="39" cy="64" rx="20" ry="14" fill="#AEB8BF"></ellipse> <ellipse cx="18" cy="62" rx="7.5" ry="5.5" fill="#9AA5AE" style="animation:kzFingers 3.4s ease-in-out infinite;transform-origin:26px 60px"></ellipse> <ellipse cx="60" cy="62" rx="7.5" ry="5.5" fill="#9AA5AE" style="animation:kzFingers 3.4s ease-in-out infinite 220ms;transform-origin:52px 60px"></ellipse> <circle cx="16" cy="24" r="12" fill="#9AA5AE"></circle> <circle cx="16" cy="24" r="6.6" fill="#EFC3AC"></circle> <circle cx="62" cy="24" r="12" fill="#9AA5AE"></circle> <circle cx="62" cy="24" r="6.6" fill="#EFC3AC"></circle> <circle cx="39" cy="36" r="23" fill="#C3CBD1"></circle> <ellipse cx="20" cy="42" rx="5" ry="3.2" fill="#F2B48D"></ellipse> <ellipse cx="58" cy="42" rx="5" ry="3.2" fill="#F2B48D"></ellipse> <path d="M25 30 q7 -6 14 1 q-7 5 -14 -1 Z" fill="#F4DC8E"></path> <path d="M39 31 q7 -6 14 1 q-7 5 -14 -1 Z" fill="#F4DC8E"></path> <path d="M31 28.5 L31 33" stroke="#2B2B33" stroke-width="2.6" stroke-linecap="round" style="animation:kzSlit 5s ease-in-out infinite;transform-origin:31px 31px"></path> <path d="M46 29 L46 33.5" stroke="#2B2B33" stroke-width="2.6" stroke-linecap="round" style="animation:kzSlit 5s ease-in-out infinite;transform-origin:46px 31px"></path> <path d="M25 30 q7 -6 14 1" stroke="#2B2B33" stroke-width="2.1" fill="none" stroke-linecap="round"></path> <path d="M39 31 q7 -6 14 1" stroke="#2B2B33" stroke-width="2.1" fill="none" stroke-linecap="round"></path> <path d="M22 23 q8 -5 15 0" stroke="#7C868E" stroke-width="2.8" fill="none" stroke-linecap="round" style="animation:kzBrow 4.2s ease-in-out infinite;transform-origin:29px 23px"></path> <path d="M56 24 q-8 -4 -15 1" stroke="#7C868E" stroke-width="2.8" fill="none" stroke-linecap="round"></path> <ellipse cx="39" cy="42" rx="5.6" ry="6.4" fill="#3A3F43"></ellipse> <path d="M31 51 q9 7 17 -1" stroke="#2B2B33" stroke-width="2.5" fill="none" stroke-linecap="round" style="animation:kzSmirk 3.4s ease-in-out infinite;transform-origin:39px 51px"></path> <path d="M46 50.5 L48.5 54" stroke="#2B2B33" stroke-width="2.2" stroke-linecap="round"></path> </svg>`;
    const RELANCE_SVG_RENARD = `<svg viewBox="0 0 78 70" aria-hidden="true" style="overflow:visible;animation:kzLurk 5s ease-in-out infinite;transform-origin:50% 95%"> <path d="M50 52 q24 2 18 -18" stroke="#C96C24" stroke-width="8" fill="none" stroke-linecap="round" style="animation:kzTail 2.4s cubic-bezier(0.3,0,0.2,1) infinite;transform-origin:50px 52px"></path> <path d="M66 38 q4 -4 2 -8" stroke="#F7EFE6" stroke-width="8" fill="none" stroke-linecap="round" style="animation:kzTail 2.4s cubic-bezier(0.3,0,0.2,1) infinite;transform-origin:50px 52px"></path> <path d="M13 25 L9 2 L33 14 Z" fill="#C96C24"></path> <path d="M57 25 L61 2 L37 14 Z" fill="#C96C24"></path> <path d="M16.5 22 L14.5 8.5 L27.5 15 Z" fill="#3A3F43"></path> <path d="M53.5 22 L55.5 8.5 L42.5 15 Z" fill="#3A3F43"></path> <path d="M35 13 q-21 3 -21 21 q0 12 8 17 q6 4 13 5 q7 -1 13 -5 q8 -5 8 -17 q0 -18 -21 -21 Z" fill="#E4923F"></path> <path d="M17 39 q-4 8 2 13 q3 -7 2 -12 Z" fill="#F7EFE6"></path> <path d="M53 39 q4 8 -2 13 q-3 -7 -2 -12 Z" fill="#F7EFE6"></path> <path d="M35 33 q-12 3 -11 13 q1 9 11 10 q10 -1 11 -10 q1 -10 -11 -13 Z" fill="#F7EFE6"></path> <path d="M22 27 q6.5 -5 13 0.5 q-6.5 5 -13 -0.5 Z" fill="#F4DC8E"></path> <path d="M43 27.5 q6.5 -5.5 13 -0.5 q-6.5 5.5 -13 0.5 Z" fill="#F4DC8E"></path> <path d="M28 25.5 L28 30.5" stroke="#2B2B33" stroke-width="2.4" stroke-linecap="round" style="animation:kzSlit 5s ease-in-out infinite;transform-origin:28px 28px"></path> <path d="M49.5 25.5 L49.5 30.5" stroke="#2B2B33" stroke-width="2.4" stroke-linecap="round" style="animation:kzSlit 5s ease-in-out infinite;transform-origin:49.5px 28px"></path> <path d="M22 27 q6.5 -5 13 0.5" stroke="#2B2B33" stroke-width="2" fill="none" stroke-linecap="round"></path> <path d="M43 27.5 q6.5 -5.5 13 -0.5" stroke="#2B2B33" stroke-width="2" fill="none" stroke-linecap="round"></path> <path d="M19 22 q7 -3 14 1" stroke="#A85A18" stroke-width="2.6" fill="none" stroke-linecap="round"></path> <path d="M59 22 q-7 -3 -14 1" stroke="#A85A18" stroke-width="2.6" fill="none" stroke-linecap="round"></path> <ellipse cx="35" cy="43" rx="3.4" ry="2.6" fill="#2B2B33"></ellipse> <path d="M35 46 q-5 4 -9 0.5" stroke="#2B2B33" stroke-width="2.3" fill="none" stroke-linecap="round"></path> <path d="M35 46 q5.5 6.5 11 -0.5" stroke="#2B2B33" stroke-width="2.3" fill="none" stroke-linecap="round"></path> <path d="M44 47.5 L45.5 51" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round"></path> <path d="M10 41 L23 44 M10 48 L23 46" stroke="#F7EFE6" stroke-width="1.5" stroke-linecap="round"></path> <path d="M60 41 L47 44 M60 48 L47 46" stroke="#F7EFE6" stroke-width="1.5" stroke-linecap="round"></path> </svg>`;
    const RELANCE = [
      { id: "koala",  kind: "svg",   svg: "koala",  ms: 5000, anim: "kzSneak",  ease: "ease-in-out" },
      { id: "renard", kind: "svg",   svg: "renard", ms: 5000, anim: "kzLurk",   ease: "ease-in-out" },
      { id: "chat",   kind: "emoji", glyph: "\u{1F63C}", ms: 3400, anim: "kzPounce", ease: "cubic-bezier(0.34,1.06,0.4,1)" },
      { id: "diable", kind: "emoji", glyph: "\u{1F608}", ms: 2800, anim: "kzDevil",  ease: "ease-in-out" },
      { id: "sourcil",kind: "emoji", glyph: "\u{1F928}", ms: 4200, anim: "kzBrow",   ease: "ease-in-out" }
    ];

    // Trois intensites d'emoji qui pleure, indexees sur le nombre de reports du
    // jour, planche 09. Ce n'est pas un reproche, c'est du theatre.
    const SOB = [
      { glyph: "\u{1F97A}", tears: 1 },
      { glyph: "\u{1F622}", tears: 3 },
      { glyph: "\u{1F62D}", tears: 6 }
    ];

    // Qui joue le personnage de relance. "drawn" active les cinq personnages
    // dessines du build public, "images" tire dans SNARK_KOALAS comme le perso.
    // C'est l'une des TROIS divergences entre les builds, avec DEFAULT_KOALAS
    // et SNARK_KOALAS. Toujours la reappliquer apres un alignement des builds.
    const RELANCE_MODE = "drawn";

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
  position: fixed; right: 16px; bottom: 16px; width: auto; height: auto;
  display: flex; align-items: flex-end; gap: 10px;
  pointer-events: auto; cursor: pointer; z-index: 2147483647; will-change: transform, opacity;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #333333;
}
.kz-inner { order: 2; flex: 0 0 auto; display: block; transform-origin: bottom center; }
.kz-koala--sport .kz-inner { animation: kzBounce .5s ease-in-out infinite; }
.kz-photo { display: block; height: auto; width: auto; max-height: 280px; max-width: 280px; pointer-events: none; -webkit-user-drag: none; user-select: none; filter: drop-shadow(0 9px 11px rgba(0,0,0,.22)); animation: kzSway 5.2s ease-in-out infinite; }
.kz-svg { width: auto; height: 200px; display: block; overflow: visible; }
/* Module M, planches 06 et 07. Le format du fichier decide du placement.
   Carre et portrait, la bulle reste a gauche. Paysage au dela de 1,3 fois plus
   large que haut, elle passe AU DESSUS, sa pointe se retourne vers le bas et
   elle se decale de 44 px vers la gauche. L'image n'est jamais deformee ni
   recadree, elle est mise a l'echelle pour tenir entierement dans son cadre. */
.kz-koala--land { flex-direction: column; align-items: flex-end; gap: 12px; }
.kz-koala--land .kz-bubble { order: 1; position: relative; transform-origin: bottom right; margin-right: 44px; }
.kz-koala--land .kz-inner { order: 2; }
.kz-koala--land .kz-bubble::after {
  content: ""; position: absolute; left: auto; right: 30px; top: auto; bottom: -7px;
  width: 13px; height: 13px; background: #FFFFFF;
  border-top: none; border-right: 1px solid #E0E0E0;
  border-bottom: 1px solid #E0E0E0; border-left: none;
  border-radius: 0 0 3px 0; transform: rotate(45deg);
}
.kz-koala--land .kz-bubble--cat::after { background: #2E3338; border-right-color: #454C52; border-bottom-color: #454C52; }
.kz-photo { border-radius: 16px; }
.kz-eye { transform-box: fill-box; transform-origin: center; animation: kzBlink 5.4s infinite; }
#kzArmR { transform-box: fill-box; transform-origin: 45% 82%; animation: kzWave 3.4s ease-in-out infinite; }

.kz-bubble {
  order: 1; flex: 0 0 auto; width: 364px; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 10px;
  background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 18px; padding: 16px;
  box-shadow: 0 8px 24px rgba(16,24,40,0.14);
  opacity: 0; transform: translateY(8px) scale(.97); transform-origin: bottom right;
  transition: opacity ${T.bubble}ms cubic-bezier(0.2,0,0,1), transform ${T.bubble}ms cubic-bezier(0.2,0,0,1);
}
.kz-bubble.kz-show { opacity: 1; transform: translateY(0) scale(1); }
.kz-bubble--act { gap: 12px; }
/* La pointe de la bulle, planche 06. Placement a gauche du personnage, elle est
   sur le bord DROIT de la bulle et pointe vers l'epaule. Declaration reprise
   telle quelle de la planche, ou elle apparait 20 fois, bordures haute et droite
   et rotation de 45 degres, ce qui oriente le coin vers la droite. */
.kz-bubble { position: relative; }
.kz-bubble::after {
  content: ""; position: absolute; right: -7px; bottom: 22px;
  width: 13px; height: 13px; background: #FFFFFF;
  border-top: 1px solid #E0E0E0; border-right: 1px solid #E0E0E0;
  border-radius: 0 3px 0 0; transform: rotate(45deg);
}
/* La bulle graphite de la relance porte une pointe graphite, pas blanche. */
.kz-bubble--cat::after { background: #2E3338; border-top-color: #454C52; border-right-color: #454C52; }
.kz-head { display: flex; align-items: center; gap: 8px; }
.kz-pill { flex: 0 0 auto; margin-right: auto; display: flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 9999px; background: #F2FBF3; color: #1F5C2E; font-size: 11px; font-weight: 500; }
.kz-pill--hail { background: #DCEFE0; }
.kz-pill--cat { background: #3E454B; color: #F0D9A8; }
.kz-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 9999px; background: #2FAE4A; }
.kz-lead { display: flex; align-items: baseline; gap: 8px; }
.kz-lead-n { flex: 0 0 auto; font-size: 22px; line-height: 26px; font-weight: 600; color: #1F5C2E; font-variant-numeric: tabular-nums; }
.kz-lead-t { flex: 1 1 auto; font-size: 17px; line-height: 23px; color: #333333; }
.kz-day { display: flex; align-items: center; gap: 7px; }
.kz-day-segs { display: flex; gap: 4px; flex: 1 1 auto; }
.kz-seg { flex: 1 1 0; height: 5px; border-radius: 9999px; background: #DCEFE0; }
.kz-seg--on { background: #2FAE4A; }
.kz-day-lab { flex: 0 0 auto; font-size: 11px; color: #666666; }
.kz-close { flex: 0 0 auto; padding: 0; border: none; background: none; color: #666666; font-size: 12px; line-height: 1; cursor: pointer; }
.kz-close:hover { color: #333333; }
.kz-timer { flex: 0 0 auto; font-size: 12px; font-weight: 500; color: #333333; font-variant-numeric: tabular-nums; }
.kz-bar { height: 4px; border-radius: 9999px; background: #F1F1F1; overflow: hidden; }
.kz-bar-f { height: 4px; width: 0; border-radius: 9999px; background: #2FAE4A; transition: width 1s linear; }
.kz-quote-row { display: flex; gap: 9px; }
.kz-mark { flex: 0 0 auto; color: #2FAE4A; font-size: 26px; line-height: 20px; font-family: Georgia, "Times New Roman", serif; }
.kz-mark--grey { color: #9F9F9F; }
.kz-quote-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.kz-quote-text { font-size: 16px; line-height: 23px; color: #333333; font-style: italic; }
.kz-author { display: flex; align-items: center; gap: 7px; }
.kz-author-line { flex: 0 0 auto; width: 14px; height: 1px; background: #C7E5CE; }
.kz-author-line--grey { background: #E0E0E0; }
.kz-author-name { font-size: 12px; line-height: 16px; color: #666666; }
.kz-rule { height: 1px; background: #F1F1F1; margin: 2px -16px; }
.kz-bubble--cat { width: 270px; background: #2E3338; border-color: #454C52; box-shadow: 0 10px 28px rgba(16,24,40,0.28); gap: 11px; }
.kz-bubble--cat.kz-show { transform: translateY(0) scale(1) rotate(-1.2deg); }
.kz-bubble--cat .kz-close { color: #9AA5AE; }
.kz-bubble--cat .kz-close:hover { color: #FFFFFF; }
.kz-bubble--cat .kz-mark { color: #F0D9A8; }
.kz-bubble--cat .kz-quote-text { color: #FFFFFF; }
.kz-bubble--cat .kz-author-line { background: #5C646B; }
.kz-bubble--cat .kz-author-name { color: #B9C2C9; }
.kz-bubble--cat .kz-rule { background: #454C52; }
.kz-bubble--cat .kz-foot { color: #B9C2C9; }
.kz-tally { display: flex; align-items: center; gap: 8px; }
.kz-tally-set { display: flex; gap: 3px; flex: 0 0 auto; }
.kz-stick { width: 9px; height: 14px; border-radius: 2px; background: #F0D9A8; }
.kz-tally-lab { flex: 1 1 auto; font-size: 12px; line-height: 16px; color: #B9C2C9; }
.kz-bubble--win { align-items: center; gap: 10px; }
.kz-win-mark { position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; }
.kz-ripple { position: absolute; inset: 0; border-radius: 9999px; background: #2FAE4A; opacity: 0; }
.kz-disc { position: relative; width: 44px; height: 44px; border-radius: 9999px; background: #DCEFE0; display: flex; align-items: center; justify-content: center; }
.kz-check { stroke-dasharray: 30; stroke-dashoffset: 30; }
.kz-spark { position: absolute; border-radius: 9999px; opacity: 0; }
.kz-win-t { font-size: 14px; line-height: 19px; font-weight: 500; color: #333333; }
.kz-win-row { display: flex; align-items: center; gap: 7px; }
.kz-win-lab { font-size: 12px; color: #666666; }
.kz-win-v { display: flex; align-items: baseline; gap: 3px; }
.kz-win-n { font-size: 17px; line-height: 20px; font-weight: 600; color: #1F5C2E; font-variant-numeric: tabular-nums; }
.kz-foot { font-size: 12px; line-height: 16px; color: #666666; }

  position: absolute; right: 18px; top: -12px; background: #2E3338; color: #FFFFFF; font-size: 13px; font-weight: 600;
  padding: 4px 9px; border-radius: 12px; white-space: nowrap; opacity: 0; transform: translateY(6px);
  transition: opacity .2s ease, transform .2s ease;
}

@keyframes kzBreath { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes kzArrive { 0% { transform: translate(26px,18px) rotate(8deg); opacity: 0; } 60% { transform: translate(0,-4px) rotate(-3deg); opacity: 1; } 100% { transform: translate(0,0) rotate(0deg); opacity: 1; } }
@keyframes kzLeave { 0% { transform: translate(0,0) rotate(0deg); opacity: 1; } 100% { transform: translate(26px,18px) rotate(8deg); opacity: 0; } }
@keyframes kzFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes kzFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes kzDraw { to { stroke-dashoffset: 0; } }
@keyframes kzPopIn { 0% { transform: scale(.4); opacity: 0; } 55% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes kzRipple { 0% { transform: scale(.6); opacity: .45; } 100% { transform: scale(2.1); opacity: 0; } }
@keyframes kzSpark { 0% { transform: translate(0,0) scale(0); opacity: 0; } 45% { transform: translate(var(--dx),var(--dy)) scale(1); opacity: 1; } 100% { transform: translate(calc(var(--dx) * 1.5),calc(var(--dy) * 1.5)) scale(.2); opacity: 0; } }
@keyframes kzRoll { 0% { transform: translateY(0); opacity: 1; } 30% { transform: translateY(-9px); opacity: .2; } 31% { transform: translateY(9px); opacity: .2; } 100% { transform: translateY(0); opacity: 1; } }
@keyframes kzCellIn { from { transform: translateY(7px) scale(.9); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
@keyframes kzPick { 0% { transform: scale(1); } 46% { transform: scale(1.18); } 100% { transform: scale(1); } } 100% { transform: scale(1.06); box-shadow: 0 0 0 3px rgba(169,130,7,0.35); } }
@keyframes kzMarkIn { from { transform: scale(.6) rotate(-12deg); opacity: 0; } 60% { transform: scale(1.06) rotate(2deg); opacity: 1; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
@keyframes kzQuoteIn { from { transform: translateY(9px); opacity: 0; filter: blur(3px); } to { transform: translateY(0); opacity: 1; filter: blur(0); } }
@keyframes kzSway { 0%,100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
@keyframes kzBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-11px); } }
@keyframes kzBlink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(.12); } }



@media (prefers-reduced-motion: reduce) {
  .kz-inner, .kz-photo, #kzArmR, .kz-eye { animation: none !important; }
  .kz-enter-rise, .kz-enter-drop, .kz-enter-pop, .kz-enter-peekR, .kz-enter-slideL,
  .kz-exit-waddle, .kz-exit-jump, .kz-exit-rollL, .kz-exit-rollR, .kz-exit-shrink,
  .kz-exit-balloon, .kz-exit-slideDown, .kz-exit-spinAway, .kz-exit-vortex,
  .kz-exit-faint, .kz-exit-moon { animation: none !important; }
  .kz-bubble, .kz-bar-f { transition: opacity 120ms linear !important; }
  .kz-bubble.kz-show { transform: none !important; }
  .kz-bubble--cat.kz-show { transform: rotate(-1.2deg) !important; }
}

.kz-actions { display: flex; gap: 8px; }
.kz-btn { font: inherit; font-size: 14px; font-weight: 500; height: 38px; border-radius: 9999px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.kz-btn--done { flex: 1 1 0; background: #146B2C; color: #FFFFFF; }
.kz-btn--later { flex: 0 0 auto; padding: 0; background: none; color: #666666; }
.kz-btn--done:hover { filter: brightness(1.07); }
.kz-btn--later:hover { color: #333333; }
.kz-btn--done[disabled] { background: #E0E0E0; color: #666666; cursor: default; filter: none; }
.kz-btn--go { flex: 1 1 0; height: 36px; background: #2FAE4A; color: #FFFFFF; font-size: 13px; }
.kz-btn--go:hover { filter: brightness(1.07); }
.kz-btn--never { flex: 0 0 auto; height: 36px; padding: 0 14px; background: none; border: 1px solid #5C646B; color: #B9C2C9; font-size: 13px; }
.kz-btn--never:hover { background: rgba(255,255,255,.07); }
.kz-focus-back { position: fixed; inset: 0; z-index: 2147483646; background: rgba(26,26,26,.55); opacity: 0; transition: opacity .35s ease; pointer-events: auto; cursor: default; }
.kz-focus-back.kz-show { opacity: 1; }
.kz-bubble--focus { border-color: transparent; box-shadow: 0 8px 24px rgba(16,24,40,0.24); }
@keyframes kzLurk { 0%, 100% { transform: rotate(-4deg) translateY(0); } 45% { transform: rotate(-6deg) translateY(-1px); } 70% { transform: rotate(-2deg) translateY(1px); } }
@keyframes kzSmirk { 0%, 44% { transform: scaleX(1); } 62%, 82% { transform: scaleX(1.14); } 100% { transform: scaleX(1); } }
@keyframes kzSlit { 0%, 88%, 100% { transform: scaleX(1); } 94% { transform: scaleX(2.4); } }
@keyframes kzCheek { 0%, 100% { opacity: 0.75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.12); } }
@keyframes kzFingers { 0%, 100% { transform: rotate(0deg); } 30% { transform: rotate(-9deg); } 60% { transform: rotate(7deg); } }
@keyframes kzEar { 0%, 100% { transform: rotate(0deg); } 40% { transform: rotate(-7deg); } 70% { transform: rotate(4deg); } }
@keyframes kzLean { 0%, 44% { transform: translateX(14px) rotate(9deg); opacity: 0; } 54% { transform: translateX(-3px) rotate(-5deg); opacity: 1; } 62%, 92% { transform: translateX(0) rotate(-2deg); opacity: 1; } 100% { transform: translateX(14px) rotate(9deg); opacity: 0; } }
@keyframes kzTail { 0%, 46% { transform: rotate(-4deg); } 54% { transform: rotate(16deg); } 60% { transform: rotate(-6deg); } 68% { transform: rotate(15deg); } 76% { transform: rotate(-4deg); } 100% { transform: rotate(-4deg); } }
@keyframes kzPounce { 0%, 60%, 100% { transform: translateY(0) scale(1, 1) rotate(-3deg); } 68% { transform: translateY(2px) scale(1.1, 0.88) rotate(-3deg); } 78% { transform: translateY(-9px) scale(0.94, 1.1) rotate(3deg); } 88% { transform: translateY(0) scale(1.04, 0.98) rotate(0deg); } }
@keyframes kzDevil { 0%, 100% { transform: rotate(-7deg) translateY(0) scale(1); } 25% { transform: rotate(7deg) translateY(-4px) scale(1.06); } 50% { transform: rotate(-5deg) translateY(0) scale(1); } 75% { transform: rotate(9deg) translateY(-6px) scale(1.08); } }
@keyframes kzBrow { 0%, 100% { transform: rotate(-6deg) scale(1); } 18% { transform: rotate(-10deg) scale(1.08); } 34% { transform: rotate(-4deg) scale(1); } 62% { transform: rotate(-8deg) scale(1.04); } }
@keyframes kzSobIn { 0%, 4% { transform: translateY(10px) scale(0.9); opacity: 0; } 12%, 88% { transform: translateY(0) scale(1); opacity: 1; } 96%, 100% { transform: translateY(6px) scale(0.94); opacity: 0; } }
@keyframes kzSobShake { 0%, 12% { transform: rotate(0deg); } 20% { transform: rotate(-7deg); } 28% { transform: rotate(6deg); } 36% { transform: rotate(-5deg); } 44% { transform: rotate(4deg); } 52%, 100% { transform: rotate(0deg); } }
@keyframes kzSobText { 0%, 20% { transform: translateY(6px); opacity: 0; } 30%, 86% { transform: translateY(0); opacity: 1; } 94%, 100% { transform: translateY(4px); opacity: 0; } }
@keyframes kzTear { 0%, 16% { transform: translateY(0) scale(0.5); opacity: 0; } 24% { transform: translateY(4px) scale(1); opacity: 1; } 60% { transform: translateY(30px) scale(0.9); opacity: 1; } 72%, 100% { transform: translateY(42px) scale(0.4); opacity: 0; } }
@keyframes kzStamp { 0%, 48% { transform: scale(0.2) rotate(-18deg); opacity: 0; } 58% { transform: scale(1.25) rotate(6deg); opacity: 1; } 64%, 92% { transform: scale(1) rotate(-3deg); opacity: 1; } 100% { transform: scale(0.2) rotate(-18deg); opacity: 0; } }
@keyframes kzHaha { 0%, 46% { transform: translateY(-24px) rotate(var(--r)); opacity: 0; } 54% { opacity: 0.9; } 88% { transform: translateY(var(--d)) rotate(calc(var(--r) * -1.6)); opacity: 0; } 100% { transform: translateY(var(--d)) rotate(var(--r)); opacity: 0; } }
@keyframes kzTypeLine { 0%, 50% { clip-path: inset(0 100% 0 0); } 74%, 100% { clip-path: inset(0 0 0 0); } }
@keyframes kzSwapA { 0%, 44% { opacity: 1; transform: translateY(0); } 50%, 94% { opacity: 0; transform: translateY(-8px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes kzSwapB { 0%, 44% { opacity: 0; transform: translateY(8px); } 52%, 94% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(8px); } }
.kz-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.kz-energy-q { font-size: 14px; line-height: 19px; font-weight: 500; color: #333333; }
.kz-energy-row { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
.kz-energy-btn { font: inherit; font-size: 12px; height: 34px; border-radius: 9px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.kz-energy-btn:hover { box-shadow: 0 0 0 2px rgba(47,174,74,.35); }
.kz-energy-btn.kz-picked { color: #FFFFFF; font-size: 13px; font-weight: 600; animation: kzPick 420ms cubic-bezier(0.34,1.06,0.4,1) both; }
.kz-e1 { background: #F7DAD8; color: #8F2723; }
.kz-e2 { background: #FBE6CE; color: #8A5108; }
.kz-e3 { background: #FAF0C9; color: #7A5E06; }
.kz-e4 { background: #E2F2E5; color: #33693F; }
.kz-e5 { background: #CFE9D5; color: #1F5C2E; }
/* La case choisie passe en aplat plein de SA bande, avec son anneau. */
.kz-energy-btn.kz-picked.kz-e1 { background: #8F2723; box-shadow: 0 0 0 3px rgba(143,39,35,.30); }
.kz-energy-btn.kz-picked.kz-e2 { background: #8A5108; box-shadow: 0 0 0 3px rgba(138,81,8,.30); }
.kz-energy-btn.kz-picked.kz-e3 { background: #7A5E06; box-shadow: 0 0 0 3px rgba(122,94,6,.30); }
.kz-energy-btn.kz-picked.kz-e4 { background: #33693F; box-shadow: 0 0 0 3px rgba(51,105,63,.30); }
.kz-energy-btn.kz-picked.kz-e5 { background: #1F5C2E; box-shadow: 0 0 0 3px rgba(31,92,46,.30); }
.kz-energy-btn:focus-visible, .kz-btn:focus-visible { outline: 3px solid #2FAE4A; outline-offset: 1px; }
.kz-energy-ends { display: flex; justify-content: space-between; }
.kz-energy-lo { font-size: 11px; color: #8F2723; }
.kz-energy-hi { font-size: 11px; color: #1F5C2E; }
/* Les hahaha de fond sur Jamais, planche 08. Ils tombent DERRIERE le texte et ne
   capturent aucun clic. */
.kz-hahas { position: absolute; left: 0; right: 0; top: 0; bottom: 0; overflow: hidden;
  pointer-events: none; border-radius: 18px; z-index: 0; }
.kz-haha { position: absolute; top: 0; color: #B9C2C9; opacity: 0; font-weight: 600;
  white-space: nowrap; will-change: transform, opacity; }
.kz-bubble--cat > *:not(.kz-hahas) { position: relative; z-index: 1; }
/* Le personnage de relance doit avoir une largeur, sinon un SVG sans width peut
   se replier a zero et la bulle parait seule. */
.kz-relance { display: block; width: auto; min-width: 78px; }
.kz-relance--emoji { font-size: 62px; line-height: 1; text-align: center; user-select: none; }
.kz-sob { position: relative; display: flex; align-items: center; justify-content: center; width: 96px; height: 96px; }
.kz-sob-face { font-size: 62px; line-height: 1; user-select: none; }
.kz-sob-tear { position: absolute; width: 9px; height: 12px; border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%; background: #4CB7FF; opacity: 0; }`;

    let running = false;

    // Le mouvement suit le reglage Animations, Automatique par defaut.
    let ANIM_MODE = "auto";
    function reduceMotion() {
      if (ANIM_MODE === "always") return false;
      if (ANIM_MODE === "never") return true;
      try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
    }

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

    const SNARK_KOALAS = ["images/cat-coach.png", "images/cat-contract.png"];
    function defaultUrls() {
      return DEFAULT_KOALAS
        .map((p) => { try { return api.runtime.getURL(p); } catch (e) { return ""; } })
        .filter(Boolean);
    }
    // SNARK_KOALAS est un chemin du paquet, pas une donnee integree, il a donc
    // besoin de la meme resolution que DEFAULT_KOALAS. Sans elle l'image ne se
    // charge jamais, la page visitee n'a pas ce chemin, et le repli SVG joue en
    // silence a chaque relance.
    function snarkUrls() {
      return SNARK_KOALAS
        .map((p) => { try { return api.runtime.getURL(p); } catch (e) { return ""; } })
        .filter(Boolean);
    }

    let KOALAS = defaultUrls();
    // La relance suit la meme personnalisation que le rappel, planche 09. Sans
    // koalas d'origine gardes, ce sont les images de l'utilisateur qui doivent
    // reagir au report, pas la paire figee de la planche. loadSettings() la
    // recalcule avec KOALAS.
    let RELANCE_POOL = snarkUrls();
    // RELANCE_MODE decide du casting de base, dessine ou personnalise, mais un
    // utilisateur qui a ses propres photos et n'a pas garde les koalas
    // d'origine doit les retrouver aussi pendant la relance, pas seulement au
    // rappel. loadSettings() la recalcule avec la meme condition que
    // RELANCE_POOL, juste au dessus.
    let RELANCE_PERSO = false;
    let lastKoala = -1;
    let QUOTES = (typeof KZ_QUOTES !== "undefined") ? KZ_QUOTES : [];
    let SPORT = (typeof KZ_SPORT !== "undefined") ? KZ_SPORT : [];
    let SNARK = (typeof KZ_SNARK !== "undefined") ? KZ_SNARK : [];

    function kzMsg(key, fallback) {
      try { const m = (api.i18n && api.i18n.getMessage) ? api.i18n.getMessage(key) : ""; return m || fallback; } catch (e) { return fallback; }
    }

    function sendOutcome(result, energy) { try { api.runtime.sendMessage({ type: "kz-outcome", result: result, energy: (typeof energy === "number" ? energy : null) }); } catch (e) { /* noop */ } }

    function fmtDuration(totalSec) {
      const s = Math.max(0, Math.round(Number(totalSec) || 0));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (h > 0) return h + " h " + String(m).padStart(2, "0");
      return m + " min";
    }

    function addRule(bubble) {
      bubble.appendChild(document.createElement("div")).className = "kz-rule";
    }

    function addFootLine(bubble, text) {
      if (!text) return;
      addRule(bubble);
      const el = document.createElement("div");
      el.className = "kz-foot";
      el.textContent = text;
      bubble.appendChild(el);
    }

    function appendScreenTime(bubble, seconds) {
      if (seconds == null) return;
      addFootLine(bubble, kzMsg("screenTodayLine", "Aujourd'hui, {d} d'écran").replace("{d}", fmtDuration(seconds)));
    }

    function mkPill(text, kind) {
      const p = document.createElement("div");
      p.className = "kz-pill" + (kind === "hail" ? " kz-pill--hail" : kind === "cat" ? " kz-pill--cat" : "");
      if (kind === "hail") p.appendChild(document.createElement("span")).className = "kz-dot";
      p.appendChild(document.createTextNode(text));
      return p;
    }

    // Le chiffre de tete passe en gros, comme dans la maquette. Sinon la phrase reste entiere.
    function mkQuoteRow(text, author, grey) {
      const row = document.createElement("div");
      row.className = "kz-quote-row";
      const mark = document.createElement("div");
      mark.className = "kz-mark" + (grey ? " kz-mark--grey" : "");
      mark.textContent = "\u201C";
      const col = document.createElement("div");
      col.className = "kz-quote-col";
      const t = document.createElement("div");
      t.className = "kz-quote-text";
      t.textContent = text;
      col.appendChild(t);
      if (author) {
        const a = document.createElement("div");
        a.className = "kz-author";
        const line = document.createElement("div");
        line.className = "kz-author-line" + (grey ? " kz-author-line--grey" : "");
        const name = document.createElement("div");
        name.className = "kz-author-name";
        name.textContent = author;
        a.appendChild(line); a.appendChild(name);
        col.appendChild(a);
      }
      row.appendChild(mark); row.appendChild(col);
      return row;
    }

    function mkLead(text) {
      const row = document.createElement("div");
      row.className = "kz-lead";
      const m = /^\s*(\d{1,3})\s+(\S[\s\S]*)$/.exec(text);
      if (m) {
        const n = document.createElement("div");
        n.className = "kz-lead-n";
        n.textContent = m[1];
        row.appendChild(n);
        const t = document.createElement("div");
        t.className = "kz-lead-t";
        t.textContent = m[2];
        row.appendChild(t);
      } else {
        const t = document.createElement("div");
        t.className = "kz-lead-t";
        t.textContent = text;
        row.appendChild(t);
      }
      return row;
    }

    // Ou en est la journee, un trait par objectif.
    function mkDayProgress(done, goal) {
      if (!goal || goal < 1) return null;
      const row = document.createElement("div");
      row.className = "kz-day";
      const segs = document.createElement("div");
      segs.className = "kz-day-segs";
      const shown = Math.min(goal, 8);
      for (let i = 0; i < shown; i++) {
        const seg = document.createElement("div");
        seg.className = "kz-seg" + (i < done ? " kz-seg--on" : "");
        segs.appendChild(seg);
      }
      const lab = document.createElement("div");
      lab.className = "kz-day-lab";
      lab.textContent = kzMsg("dayProgress", "{d} sur {g} aujourd'hui").replace("{d}", Math.min(done, goal)).replace("{g}", goal);
      row.appendChild(segs); row.appendChild(lab);
      return row;
    }

    // Les batons du chat, il compte les reports du jour.
    function mkTally(count, short) {
      const row = document.createElement("div");
      row.className = "kz-tally";
      const set = document.createElement("div");
      set.className = "kz-tally-set";
      for (let i = 0; i < Math.min(Math.max(1, count), 6); i++) {
        set.appendChild(document.createElement("div")).className = "kz-stick";
      }
      const lab = document.createElement("div");
      lab.className = "kz-tally-lab";
      const key = count <= 1 ? (short ? "tallyFirstShort" : "tallyFirst") : (short ? "tallyNthShort" : "tallyNth");
      lab.textContent = kzMsg(key, "{n}e report aujourd'hui, il compte").replace("{n}", count);
      row.appendChild(set); row.appendChild(lab);
      return row;
    }

    // Les lignes de la bulle se posent a 60 ms d'ecart.
    function stagger(bubble) {
      if (reduceMotion()) return;
      Array.prototype.forEach.call(bubble.children, (child, i) => {
        child.style.animation = "kzQuoteIn " + T.quote + "ms cubic-bezier(0.2,0,0,1) " + (i * T.line) + "ms both";
      });
    }

    // Echap vaut Plus tard, seule sortie depuis que la croix a disparu.
    // Un seul ecouteur par bulle, retire des qu'une issue est choisie.
    function armEscape(onLater) {
      const h = (e) => {
        if (e.key === "Escape") { e.stopPropagation(); disarm(); onLater(); }
      };
      const disarm = () => { try { document.removeEventListener("keydown", h, true); } catch (err) { /* noop */ } };
      document.addEventListener("keydown", h, true);
      return disarm;
    }

    function openBubble(wrap, bubble) {
      wrap.appendChild(bubble);
      requestAnimationFrame(() => requestAnimationFrame(() => bubble.classList.add("kz-show")));
      return bubble;
    }

    // Fondu croise de 200 ms entre deux bulles.
    async function swapBubble(wrap, oldBubble, newBubble) {
      if (oldBubble) {
        oldBubble.style.transition = "opacity " + T.swap + "ms linear";
        oldBubble.style.opacity = "0";
        await sleep(T.swap);
        oldBubble.remove();
      }
      return openBubble(wrap, newBubble);
    }

    const ENERGY_TONE = ["kz-e1", "kz-e1", "kz-e1", "kz-e2", "kz-e2", "kz-e3", "kz-e3", "kz-e4", "kz-e5", "kz-e5"];

    function showEnergyPicker(container, onPick) {
      const q = document.createElement("div");
      q.className = "kz-energy-q";
      q.textContent = kzMsg("energyQ", "Ton énergie, là maintenant");
      const row = document.createElement("div");
      row.className = "kz-energy-row";
      let picked = false;
      for (let i = 1; i <= 10; i++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "kz-energy-btn " + ENERGY_TONE[i - 1];
        b.textContent = String(i);
        // Les dix cases se posent en cascade a 60 ms d'ecart.
        if (!reduceMotion()) b.style.animation = "kzCellIn 260ms cubic-bezier(0.2,0,0,1) " + ((i - 1) * T.line) + "ms both";
        b.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (picked) return;
          picked = true;
          b.classList.add("kz-picked");
          if (!reduceMotion()) await sleep(420);
          onPick(i);
        });
        row.appendChild(b);
      }
      const ends = document.createElement("div");
      ends.className = "kz-energy-ends";
      const lo = document.createElement("div"); lo.className = "kz-energy-lo"; lo.textContent = kzMsg("energyLow", "À plat");
      const hi = document.createElement("div"); hi.className = "kz-energy-hi"; hi.textContent = kzMsg("energyHigh", "En pleine forme");
      ends.appendChild(lo); ends.appendChild(hi);
      // L'energie n'est plus facultative, donc pas de lien Passer. Mais sans
      // aucun filet, un utilisateur qui ne clique jamais (s'absente, ferme
      // l'ordinateur) laissait la sequence bloquee pour toujours, running
      // restant vrai a vie et avalant tous les rappels futurs en silence.
      // Ce filet ne PROPOSE rien a l'ecran, il se contente de debloquer la
      // suite sans energie enregistree si personne n'a repondu a temps.
      container.appendChild(q); container.appendChild(row); container.appendChild(ends);
      setTimeout(() => { if (!picked) { picked = true; onPick(null); } }, 20000);
    }

    // La coche se dessine en 300 ms, une onde part du cercle et le compteur de serie roule.
    const SPARKS = [
      { s: 5, c: "#2FAE4A", dx: "-22px", dy: "-16px", d: 0 },
      { s: 4, c: "#F5C877", dx: "20px", dy: "-18px", d: 60 },
      { s: 4, c: "#9BD4A8", dx: "24px", dy: "12px", d: 120 },
      { s: 5, c: "#2FAE4A", dx: "-20px", dy: "14px", d: 30 }
    ];
    function buildWin(b, streak) {
      const mark = document.createElement("div");
      mark.className = "kz-win-mark";
      const ripple = document.createElement("div");
      ripple.className = "kz-ripple";
      const disc = document.createElement("div");
      disc.className = "kz-disc";
      const check = svgFromString('<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path class="kz-check" d="M6 12.5 L10.5 17 L18 8" stroke="#1F5C2E" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      if (check) disc.appendChild(check);
      mark.appendChild(ripple); mark.appendChild(disc);
      SPARKS.forEach((sp) => {
        const d = document.createElement("div");
        d.className = "kz-spark";
        d.style.width = sp.s + "px"; d.style.height = sp.s + "px"; d.style.background = sp.c;
        d.style.setProperty("--dx", sp.dx); d.style.setProperty("--dy", sp.dy);
        if (!reduceMotion()) d.style.animation = "kzSpark 760ms ease-out " + (T.check + sp.d) + "ms both";
        mark.appendChild(d);
      });

      const title = document.createElement("div");
      title.className = "kz-win-t";
      title.textContent = kzMsg("winTitle", "Bien joué");
      b.appendChild(mark); b.appendChild(title);

      if (streak > 0) {
        const row = document.createElement("div");
        row.className = "kz-win-row";
        const lab = document.createElement("div");
        lab.className = "kz-win-lab";
        lab.textContent = kzMsg("winStreak", "Série");
        const val = document.createElement("div");
        val.className = "kz-win-v";
        const n = document.createElement("div");
        n.className = "kz-win-n";
        n.textContent = String(streak);
        const unit = document.createElement("div");
        unit.className = "kz-win-lab";
        unit.textContent = kzMsg("winDays", "jours");
        val.appendChild(n); val.appendChild(unit);
        row.appendChild(lab); row.appendChild(val);
        b.appendChild(row);
        if (!reduceMotion()) n.style.animation = "kzRoll 520ms cubic-bezier(0.2,0,0,1) " + (T.check + 120) + "ms both";
      }

      // Sur un noeud SVG importe, la propriete style n'est pas garantie selon
      // le moteur. On passe par les attributs, toujours acceptes.
      const path = b.querySelector(".kz-check");
      if (reduceMotion()) {
        if (path) path.setAttribute("stroke-dashoffset", "0");
      } else {
        if (path) path.setAttribute("style", "animation: kzDraw " + T.check + "ms cubic-bezier(0.2,0,0,1) 60ms both");
        disc.style.animation = "kzPopIn 420ms cubic-bezier(0.34,1.06,0.4,1) both";
        ripple.style.animation = "kzRipple 760ms ease-out " + T.check + "ms both";
      }
      return b;
    }

    async function loadSettings() {
      try {
        const r = await api.storage.local.get(["customKoalas", "includeDefaultKoalas", "customQuotes", "customSport", "includeDefaultQuotes", "animMode", "hiddenQuotes"]);
        ANIM_MODE = (r.animMode === "always" || r.animMode === "never") ? r.animMode : "auto";
        const customs = Array.isArray(r.customKoalas) ? r.customKoalas.filter((s) => typeof s === "string" && s) : [];
        const defs = defaultUrls();
        KOALAS = customs.length ? (r.includeDefaultKoalas ? customs.concat(defs) : customs) : defs;
        if (!KOALAS.length) KOALAS = [""];
        // Koalas d'origine non gardes, avec des images personnalisees en place,
        // la relance doit reagir avec CES images, pas avec la paire figee de la
        // planche. Sinon coche, ou aucune image personnalisee, elle garde la
        // paire d'origine.
        RELANCE_PERSO = !!(customs.length && !r.includeDefaultKoalas);
        RELANCE_POOL = RELANCE_PERSO ? customs : snarkUrls();
        if (!RELANCE_POOL.length) RELANCE_POOL = snarkUrls();

        const hidden = Array.isArray(r.hiddenQuotes) ? r.hiddenQuotes : [];
        const baseQ = ((typeof KZ_QUOTES !== "undefined") ? KZ_QUOTES : []).filter((q) => hidden.indexOf(q.t) < 0);
        const cq = Array.isArray(r.customQuotes) ? r.customQuotes.filter((q) => q && typeof q.t === "string" && q.t.trim()) : [];
        QUOTES = cq.length ? (r.includeDefaultQuotes ? baseQ.concat(cq) : cq) : baseQ;

        const baseS = (typeof KZ_SPORT !== "undefined") ? KZ_SPORT : [];
        const cs = Array.isArray(r.customSport) ? r.customSport.filter((s) => typeof s === "string" && s.trim()) : [];
        SPORT = cs.length ? cs : baseS;
      } catch (e) {
        KOALAS = defaultUrls();
        RELANCE_PERSO = false;
        RELANCE_POOL = snarkUrls();
        QUOTES = (typeof KZ_QUOTES !== "undefined") ? KZ_QUOTES : [];
        SPORT = (typeof KZ_SPORT !== "undefined") ? KZ_SPORT : [];
      }
    }

    // Les objectifs defilent dans l'ordre de la liste, un seul par visite.
    async function nextSport() {
      if (!SPORT.length) return kzMsg("sportFallback", "Bouge un peu");
      try {
        const r = await api.storage.local.get("sportIndex");
        const i = Math.max(0, Number(r && r.sportIndex) || 0) % SPORT.length;
        await api.storage.local.set({ sportIndex: (i + 1) % SPORT.length });
        return SPORT[i];
      } catch (e) { return SPORT[0]; }
    }

    function pickKoala(exclude) {
      let i = Math.floor(Math.random() * KOALAS.length);
      if (KOALAS.length > 1 && i === exclude) i = (i + 1) % KOALAS.length;
      lastKoala = i;
      return i;
    }

    // Un SVG passe par DOMParser puis importNode ne se DESSINE PAS dans certains
    // navigateurs, en particulier dans un Shadow DOM. Le noeud existe, il est
    // dans l'arbre, et rien n'apparait. C'est ce qui faisait disparaitre le vu de
    // la coche de validation et le personnage de la bulle de relance.
    // 2026-08-04, le puits "innerHTML" signale par le linter des extensions (et
    // son remplacant Range.createContextualFragment, egalement signale) sont
    // retires : on reconstruit le SVG noeud par noeud avec createElementNS et
    // setAttribute, jamais d'assignation d'une chaine dans le DOM. DOMParser ne
    // fait que LIRE une chaine comme un arbre de donnees ; le noeud etranger
    // qu'il produit n'est jamais insere tel quel (pas d'importNode), ce qui
    // evite a la fois le puits signale et le bug de rendu ci-dessus. Verifie
    // cote a cote (meme SVG, meme shadow root) contre les autres approches. Ce
    // sont NOS chaines, definies en tete de ce fichier, jamais du contenu de
    // page.
    function rebuildSvgNode(foreign, doc) {
      if (foreign.nodeType === Node.TEXT_NODE) return doc.createTextNode(foreign.nodeValue);
      if (foreign.nodeType !== Node.ELEMENT_NODE) return null;
      const ns = foreign.namespaceURI || "http://www.w3.org/2000/svg";
      const el = doc.createElementNS(ns, foreign.localName || foreign.tagName);
      for (let i = 0; i < foreign.attributes.length; i++) {
        const a = foreign.attributes[i];
        el.setAttribute(a.name, a.value);
      }
      for (let j = 0; j < foreign.childNodes.length; j++) {
        const child = rebuildSvgNode(foreign.childNodes[j], doc);
        if (child) el.appendChild(child);
      }
      return el;
    }
    function svgFromString(markup) {
      try {
        const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
        const root = parsed.documentElement;
        if (!root || root.nodeName === "parsererror") return null;
        return rebuildSvgNode(root, document);
      } catch (e) { /* noop */ }
      return null;
    }

    function svgNode() {
      return svgFromString(KOALA_SVG);
    }

    function setSvgFallback(container) {
      container.textContent = "";
      const n = svgNode();
      if (n) container.appendChild(n);
    }

    // Module M. Le cadre suit le format exact du fichier. Le carre de reference
    // fait 150 px, le cote court reste a 150 et le cote long est plafonne a
    // 280 px, donc rien n'est jamais deforme ni recadre.
    const KZ_CARRE = 150;
    const KZ_LONG_MAX = 280;
    const KZ_SEUIL_PAYSAGE = 1.9;

    function cadreImage(w, h) {
      if (!w || !h) return null;
      const ratio = w / h;
      const grand = Math.max(ratio, 1 / ratio);
      const court = KZ_CARRE;
      // Le cote long reste plafonne, mais on evite qu'une image large ecrase la
      // bulle. Au dela du carre de reference on limite la croissance.
      const long = Math.min(KZ_LONG_MAX, Math.round(KZ_CARRE * Math.min(grand, 1.6)));
      return (ratio >= 1)
        ? { w: long, h: Math.round(long / ratio), paysage: ratio > KZ_SEUIL_PAYSAGE }
        : { w: Math.round(court * ratio), h: court, paysage: false };
    }

    // Le placement se decide a la lecture des dimensions naturelles, une seule
    // bascule interne, aucun ecran conditionnel et aucun reglage de plus.
    function posePlacement(wrap, img, estPerso) {
      // Le paysage est une regle du build perso pour les images de l'utilisateur,
      // planches 06 et 07. Une image LIVREE avec l'extension ne doit jamais faire
      // basculer la mise en page, sinon la bulle passe au dessus et le personnage
      // se retrouve hors cadre.
      if (!estPerso) return;
      const c = cadreImage(img.naturalWidth, img.naturalHeight);
      if (!c) return;
      img.setAttribute("width", String(c.w));
      img.setAttribute("height", String(c.h));
      // La regle CSS .kz-photo pose width/height a auto avec un plafond en
      // max-width/max-height, ce qui l'emporte sur les attributs HTML
      // width/height ci-dessus (une image ne rend alors jamais a la taille
      // calculee, juste mise a l'echelle dans la boite de 280 par 280). Le
      // style en ligne a une specificite plus forte que la regle de classe
      // et fait vraiment appliquer le cadre voulu.
      img.style.width = c.w + "px";
      img.style.height = c.h + "px";
      wrap.classList.toggle("kz-koala--land", !!c.paysage);
    }

    // Remplit le conteneur photo d'un personnage, neuf ou reutilise. Separee de
    // buildKoala pour pouvoir rafraichir juste le visage d'un personnage qui
    // reste a l'ecran d'un rappel au suivant, sans rejouer d'entree.
    function fillKoalaPhoto(wrap, inner, src) {
      while (inner.firstChild) inner.removeChild(inner.firstChild);
      wrap.classList.remove("kz-koala--land");
      if (!src) { setSvgFallback(inner); return; }
      const img = document.createElement("img");
      img.className = "kz-photo";
      img.alt = "";
      img.decoding = "async";
      img.addEventListener("error", () => { setSvgFallback(inner); });
      // Le format n'est connu qu'une fois l'image lue. Si elle est deja en
      // cache, load ne se declenche pas, d'ou le second appel immediat.
      // Une image de l'utilisateur est une donnee integree, pas un chemin du
      // paquet. C'est ce qui distingue les deux cas.
      const estPerso = src.indexOf("data:") === 0 || src.indexOf("blob:") === 0;
      img.addEventListener("load", () => { posePlacement(wrap, img, estPerso); });
      img.src = src;
      if (img.complete && img.naturalWidth) posePlacement(wrap, img, estPerso);
      inner.appendChild(img);
    }

    function buildKoala(shadow, idx, srcOverride) {
      const wrap = document.createElement("div");
      wrap.className = "kz-koala";
      const inner = document.createElement("div");
      inner.className = "kz-inner";
      const src = (typeof srcOverride === "string" && srcOverride) ? srcOverride : KOALAS[idx];
      fillKoalaPhoto(wrap, inner, src);
      wrap.appendChild(inner);
      shadow.appendChild(wrap);
      return wrap;
    }

    // Change seulement le visage d'un personnage deja a l'ecran, garde tel
    // quel d'un rappel manque ou reporte sans reponse. Aucune sortie ni
    // entree n'est jouee, planche 09, le personnage ne quitte jamais l'ecran.
    function renewKoala(wrap, idx) {
      let inner = wrap.querySelector(".kz-inner");
      if (!inner) {
        inner = document.createElement("div");
        inner.className = "kz-inner";
        wrap.insertBefore(inner, wrap.firstChild);
      }
      fillKoalaPhoto(wrap, inner, KOALAS[idx]);
    }

    // Rotation des cinq personnages, un par report. Le koala sournois ouvre
    // toujours le cycle et le cycle repart a zero chaque matin, porte par la
    // paire snarkIndex/snarkDay, comparee a la date locale de l'appareil a
    // chaque relance. Sans snarkDay, l'index continuait indefiniment d'un
    // jour a l'autre, jamais remis a zero.
    function localDayKey() {
      const d = new Date();
      return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    }
    async function nextRelance() {
      let i = 0;
      try {
        const r = await api.storage.local.get(["snarkIndex", "snarkDay"]);
        const jour = localDayKey();
        i = (r.snarkDay === jour) ? (Math.max(0, Math.round(Number(r.snarkIndex) || 0)) % RELANCE.length) : 0;
        await api.storage.local.set({ snarkIndex: (i + 1) % RELANCE.length, snarkDay: jour });
      } catch (e) { /* noop */ }
      return RELANCE[i];
    }

    // Le personnage dessine ou l'emoji. Si RELANCE_MODE vaut "images", ou si
    // l'utilisateur a personnalise ses propres photos sans garder les koalas
    // d'origine, RELANCE_PERSO, ce sont ces images qui jouent, comme pour le
    // rappel. Remplit un personnage, existant ou neuf, avec le visage de la
    // relance. JAMAIS de repli sur wrap pour .kz-inner, sinon vider le
    // conteneur supprimerait le personnage entier.
    function fillRelance(wrap, perso) {
      wrap.classList.add("kz-koala--snark");
      let inner = wrap.querySelector(".kz-inner");
      if (!inner) {
        inner = document.createElement("div");
        inner.className = "kz-inner";
        wrap.insertBefore(inner, wrap.firstChild);
      }
      if (RELANCE_MODE === "images" || RELANCE_PERSO) {
        // En perso, on change la SOURCE de l'image deja en place, ce qui evite de
        // reconstruire le noeud et donc tout scintillement.
        const dejaLa = inner.querySelector("img.kz-photo");
        const src = rand(RELANCE_POOL);
        if (dejaLa) { dejaLa.src = src; return; }
        while (inner.firstChild) inner.removeChild(inner.firstChild);
        const img = document.createElement("img");
        img.className = "kz-photo";
        img.alt = "";
        img.decoding = "async";
        img.addEventListener("error", () => { setSvgFallback(inner); });
        img.src = src;
        inner.appendChild(img);
        return;
      }
      while (inner.firstChild) inner.removeChild(inner.firstChild);
      if (perso.kind === "emoji") {
        const d = document.createElement("div");
        d.className = "kz-relance kz-relance--emoji";
        d.textContent = perso.glyph;
        if (!reduceMotion()) d.setAttribute("style", "animation:" + perso.anim + " " + perso.ms + "ms " + perso.ease + " infinite both");
        inner.appendChild(d);
      } else {
        const svg = svgFromString(perso.svg === "renard" ? RELANCE_SVG_RENARD : RELANCE_SVG_KOALA);
        if (svg) {
          svg.setAttribute("class", "kz-relance");
          svg.setAttribute("height", "84");
          // Le SVG porte deja overflow:visible et transform-origin dans son
          // propre style, ecraser tout l'attribut les perdait, le personnage
          // pivotait alors sur le mauvais point et pouvait se faire rogner.
          if (!reduceMotion()) {
            const base = (svg.getAttribute("style") || "").replace(/animation:[^;]*;?/, "");
            svg.setAttribute("style", base + ";animation:" + perso.anim + " " + perso.ms + "ms " + perso.ease + " infinite both");
          }
          inner.appendChild(svg);
        } else { setSvgFallback(inner); }
      }
    }

    function mkRelance(shadow, perso) {
      const wrap = buildKoala(shadow, 0, (RELANCE_MODE === "images" || RELANCE_PERSO) ? rand(RELANCE_POOL) : null);
      fillRelance(wrap, perso);
      return wrap;
    }

    // ---------- Module K. La reaction au renoncement, planche 09 ----------
    // Rattachee au clic Jamais et non a Plus tard. Rien a cliquer, rien a fermer,
    // la scene part toute seule et ne bloque pas la page une seconde.
    function buildSobScene(repToday) {
      // repToday est le nombre de reports AVANT celui en cours. Le rang du report
      // actuel vaut donc repToday plus un, et l'index part de zero.
      const rang = Math.max(1, (Number(repToday) || 0) + 1);
      const idx = Math.min(SOB.length - 1, rang - 1);
      const spec = SOB[idx];
      const box = document.createElement("div");
      box.className = "kz-sob";
      const face = document.createElement("div");
      face.className = "kz-sob-face";
      face.textContent = spec.glyph;
      if (!reduceMotion()) {
        face.setAttribute("style", "animation:kzSobIn " + T.sob + "ms cubic-bezier(0.34,1.06,0.4,1) both, kzSobShake " + T.sob + "ms cubic-bezier(0.2,0,0,1) both");
      }
      box.appendChild(face);
      // Les larmes sont dessinees par nous, donc identiques sur toutes les
      // plateformes, contrairement a l'emoji qui vient du systeme.
      if (!reduceMotion()) {
        for (let i = 0; i < spec.tears; i++) {
          const t = document.createElement("div");
          t.className = "kz-sob-tear";
          t.setAttribute("style", "left:" + (i % 2 ? 58 : 32) + "px;top:44px;animation:kzTear "
            + T.tear + "ms cubic-bezier(0.4,0,1,1) " + (160 + i * T.tearGap) + "ms both");
          box.appendChild(t);
        }
      }
      return box;
    }

    // Planche 06. Sur Jamais, un GIF montre sa PREMIERE image figee. Un GIF anime
    // ne s'arrete pas par CSS, il faut dessiner sa premiere trame dans un canvas
    // et substituer la source. Un GIF fraichement charge est sur sa premiere
    // trame, donc un dessin immediat la capture. Si le dessin echoue, canvas
    // indisponible ou image d'une autre origine, on laisse le GIF tourner plutot
    // que de risquer un cadre vide.
    function figerPremiereImage(wrap) {
      if (!wrap) return false;
      const img = wrap.querySelector(".kz-photo");
      if (!img || !img.naturalWidth) return false;
      if (!/\.gif($|[?#])/i.test(img.src) && img.src.indexOf("image/gif") < 0) return false;
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx2d = c.getContext("2d");
        if (!ctx2d) return false;
        ctx2d.drawImage(img, 0, 0);
        const fixe = c.toDataURL("image/png");
        if (!fixe || fixe.length < 32) return false;
        img.src = fixe;
        return true;
      } catch (e) { return false; }
    }

    async function playSob(wrap, bubble, repToday) {
      // La bulle sort, l'emoji arrive a sa place. Sur Jamais ou mouvement reduit,
      // la scene est SUPPRIMEE et non ralentie, sans texte de remplacement.
      if (reduceMotion()) return;
      if (bubble) {
        bubble.setAttribute("style", (bubble.getAttribute("style") || "")
          + ";transition:opacity " + T.bubble + "ms cubic-bezier(0.2,0,0,1);opacity:0");
        await sleep(T.bubble);
        bubble.remove();
      }
      let inner = wrap.querySelector(".kz-inner");
      if (!inner) {
        inner = document.createElement("div");
        inner.className = "kz-inner";
        wrap.insertBefore(inner, wrap.firstChild);
      }
      while (inner.firstChild) inner.removeChild(inner.firstChild);
      inner.appendChild(buildSobScene(repToday));
      await sleep(T.sob);
    }

    function showQuoteBubble(wrap, quoteText, author, screenToday) {
      const b = document.createElement("div");
      b.className = "kz-bubble";
      b.appendChild(mkPill(kzMsg("bubblePillQuote", "Pensée du jour")));
      const row = mkQuoteRow(quoteText, author || kzMsg("authorUnknown", "Anonyme"), false);
      b.appendChild(row);
      appendScreenTime(b, screenToday);
      openBubble(wrap, b);
      // Le guillemet arrive en premier, la phrase monte en perdant son flou, l'auteur suit.
      if (!reduceMotion()) {
        const mark = b.querySelector(".kz-mark");
        const text = b.querySelector(".kz-quote-text");
        const auth = b.querySelector(".kz-author");
        if (mark) mark.style.animation = "kzMarkIn 300ms cubic-bezier(0.34,1.06,0.4,1) both";
        if (text) text.style.animation = "kzQuoteIn " + T.quote + "ms cubic-bezier(0.2,0,0,1) 120ms both";
        if (auth) auth.style.animation = "kzQuoteIn " + T.quote + "ms cubic-bezier(0.2,0,0,1) 260ms both";
      }
      return b;
    }

    // La pique. Bulle graphite de travers, batons de comptage, deux issues.
    function showSnarkBubble(wrap, text, repToday, handlers) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--cat";
      const head = document.createElement("div");
      head.className = "kz-head";
      head.appendChild(mkPill(kzMsg("bubblePillSnark", "Le chat a tout vu"), "cat"));
      b.appendChild(head);
      b.appendChild(mkQuoteRow(text, kzMsg("snarkAuthor", "Le chat"), true));
      addRule(b);
      b.appendChild(mkTally(repToday, false));
      const actions = document.createElement("div");
      actions.className = "kz-actions";
      const go = document.createElement("button");
      go.type = "button"; go.className = "kz-btn kz-btn--go"; go.textContent = kzMsg("snarkGo", "Bon, j'y vais");
      const never = document.createElement("button");
      never.type = "button"; never.className = "kz-btn kz-btn--never"; never.textContent = kzMsg("snarkNever", "Jamais");
      go.addEventListener("click", (e) => { e.stopPropagation(); handlers.onGo(); });
      never.addEventListener("click", (e) => { e.stopPropagation(); handlers.onNever(); });
      actions.appendChild(go); actions.appendChild(never);
      b.appendChild(actions);
      return openBubble(wrap, b);
    }

    // Reponse verte et droite quand tu y vas.
    function buildGoBubble(nextMinutes, doneToday, goal) {
      const b = document.createElement("div");
      b.className = "kz-bubble";
      b.appendChild(mkPill(kzMsg("snarkGo", "Bon, j'y vais")));
      const t = document.createElement("div");
      t.className = "kz-quote-text";
      t.style.fontStyle = "normal";
      t.textContent = nextMinutes > 0
        ? kzMsg("snarkGoText", "Parfait. Je te laisse tranquille, on se revoit dans {n} minutes.").replace("{n}", nextMinutes)
        : kzMsg("snarkGoTextShort", "Parfait. Je te laisse tranquille.");
      b.appendChild(t);
      const day = mkDayProgress(doneToday, goal);
      if (day) b.appendChild(day);
      return b;
    }

    // Reponse graphite et de travers quand le chat reprend la main.
    // Les hahaha qui tombent en fond sur Jamais, planche 08. Decales et de
    // tailles differentes, sinon l'effet fait mecanique.
    const HAHAS = [
      { x: "6%", d: 0,   s: 13, r: "-9deg",  dy: "120px" },
      { x: "24%", d: 180, s: 18, r: "7deg",   dy: "150px" },
      { x: "44%", d: 90,  s: 11, r: "-14deg", dy: "132px" },
      { x: "62%", d: 300, s: 16, r: "11deg",  dy: "162px" },
      { x: "80%", d: 220, s: 12, r: "-6deg",  dy: "140px" }
    ];
    function addHahas(bubble) {
      if (reduceMotion()) return;
      const fond = document.createElement("div");
      fond.className = "kz-hahas";
      HAHAS.forEach((h) => {
        const n = document.createElement("div");
        n.className = "kz-haha";
        n.textContent = kzMsg("snarkHaha", "hahaha");
        n.setAttribute("style",
          "left:" + h.x + ";font-size:" + h.s + "px;--r:" + h.r + ";--d:" + h.dy
          + ";animation:kzHaha 1500ms cubic-bezier(0.4,0,1,1) " + h.d + "ms 1 both");
        fond.appendChild(n);
      });
      bubble.appendChild(fond);
    }

    function buildNeverBubble(repToday) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--cat";
      b.appendChild(mkPill(kzMsg("snarkNever", "Jamais"), "cat"));
      const t = document.createElement("div");
      t.className = "kz-quote-text";
      t.textContent = kzMsg("snarkNeverText", "Jamais, quel joli mot. Je le note dans mon carnet.");
      b.appendChild(t);
      b.appendChild(mkTally(repToday, true));
      addHahas(b);
      return b;
    }

    // Le rappel. Le koala salue, le chiffre passe en gros, la journee se lit d'un coup d'oeil.
    function showSportBubble(wrap, promptText, doneToday, goal, handlers) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--act";
      // Accessibilite, la bulle est focusable et annoncee. Echap vaut Plus tard.
      b.setAttribute("tabindex", "0");
      b.setAttribute("role", "dialog");
      b.setAttribute("aria-label", kzMsg("bubbleAria", "Rappel Koala Zen"));
      const head = document.createElement("div");
      head.className = "kz-head";
      head.appendChild(mkPill(kzMsg("bubblePillHabit", "Coucou, c'est l'heure"), "hail"));
      b.appendChild(head);
      b.appendChild(mkLead(promptText));
      const day = mkDayProgress(doneToday, goal);
      if (day) b.appendChild(day);
      const actions = document.createElement("div");
      actions.className = "kz-actions";
      const done = document.createElement("button");
      done.type = "button"; done.className = "kz-btn kz-btn--done"; done.textContent = kzMsg("btnDone", "C'est fait");
      const later = document.createElement("button");
      later.type = "button"; later.className = "kz-btn kz-btn--later"; later.textContent = kzMsg("btnLater", "Plus tard");
      done.addEventListener("click", (e) => { e.stopPropagation(); handlers.onDone(); });
      later.addEventListener("click", (e) => { e.stopPropagation(); handlers.onLater(); });
      actions.appendChild(done); actions.appendChild(later);
      b.appendChild(actions);
      openBubble(wrap, b);
      stagger(b);
      return b;
    }

    // La pique et ses deux issues. Quoi qu'on reponde, l'occasion reste un report.
    async function runSnark(shadow, ctx, aRetirer) {
      const line = rand(SNARK);
      if (!line) return;
      const perso = await nextRelance();
      let kc;
      if (aRetirer) {
        // Le personnage est DEJA a l'ecran. Il ne sort pas, il ne rentre pas, son
        // visage change sur place, comme le dit la planche 09. La bulle
        // precedente, celle de l'energie, part avec lui.
        kc = aRetirer;
        const vieille = kc.querySelector(".kz-bubble");
        if (vieille && vieille.parentNode) vieille.parentNode.removeChild(vieille);
        fillRelance(kc, perso);
        await sleep(T.swap);
      } else {
        kc = mkRelance(shadow, perso);
        playEnter(kc);
        await sleep(T.arrive + 60);
      }

      let snark = null;
      let desarmeSnark = null;
      const answer = await new Promise((resolve) => {
        let settled = false;
        const finish = (r) => {
          if (settled) return;
          settled = true;
          if (desarmeSnark) desarmeSnark();
          resolve(r);
        };
        snark = showSnarkBubble(kc, line, ctx.repToday, {
          onGo: () => finish("go"),
          onNever: () => finish("never")
        });
        stagger(snark);
        desarmeSnark = armEscape(() => finish("timeout"));
        setTimeout(() => finish("timeout"), 11000);
      });

      // Les deux reponses partagent la meme mecanique, un fondu croise de 200 ms.
      if (answer === "go" || answer === "never") {
        const reply = (answer === "go")
          ? buildGoBubble(ctx.nextMinutes, ctx.doneToday, ctx.goal)
          : buildNeverBubble(ctx.repToday);
        await swapBubble(kc, snark, reply);
        stagger(reply);
        await sleep(3200);
        // Le renoncement definitif, et seulement lui, declenche les larmes.
        if (answer === "never") {
          // Le personnage se fige avant les larmes, planche 06.
          figerPremiereImage(kc);
          await playSob(kc, reply, ctx.repToday);
        }
        await playExit(kc);
        kc.remove();
        return;
      }
      // Personne n'a repondu. Le personnage ne quitte jamais l'ecran de lui
      // meme, seule sa bulle de relance s'efface. Il reste tel quel pour le
      // prochain rappel, qui le retrouvera et changera seulement son visage.
      if (snark && snark.parentNode) snark.parentNode.removeChild(snark);
    }

    async function runFocus(shadow, ctx) {
      // Voile qui bloque la page, seule chose propre au mode focus.
      const seconds = ctx.focusSeconds;
      const back = document.createElement("div");
      back.className = "kz-focus-back";
      shadow.appendChild(back);
      requestAnimationFrame(() => back.classList.add("kz-show"));

      const fmt = (v) => String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0");
      const removeBack = async () => { back.classList.remove("kz-show"); await sleep(320); back.remove(); };

      const k1 = buildKoala(shadow, pickKoala(lastKoala));
      k1.classList.add("kz-koala--sport");
      playEnter(k1);
      await sleep(T.arrive + 60);

      const prompt = await nextSport();
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--act kz-bubble--focus";
      const head = document.createElement("div"); head.className = "kz-head";
      head.appendChild(mkPill(kzMsg("bubblePillFocus", "Pause focus")));
      const timer = document.createElement("div"); timer.className = "kz-timer"; timer.textContent = fmt(seconds);
      timer.setAttribute("aria-hidden", "true");
      head.appendChild(timer);
      // Region vocale du minuteur. Annoncee toutes les 10 s, jamais chaque
      // seconde, sinon le lecteur d'ecran devient inutilisable.
      const vocal = document.createElement("div");
      vocal.className = "kz-sr";
      vocal.setAttribute("aria-live", "polite");
      vocal.setAttribute("role", "status");
      vocal.textContent = kzMsg("focusRemaining", "Encore {n} secondes").replace("{n}", seconds);
      head.appendChild(vocal);
      const bar = document.createElement("div"); bar.className = "kz-bar";
      const barFill = document.createElement("div"); barFill.className = "kz-bar-f";
      bar.appendChild(barFill);
      const actions = document.createElement("div"); actions.className = "kz-actions";
      const done = document.createElement("button");
      done.type = "button"; done.className = "kz-btn kz-btn--done"; done.disabled = true;
      done.textContent = kzMsg("btnDoneIn", "Fait dans {n} s").replace("{n}", seconds);
      const later = document.createElement("button");
      later.type = "button"; later.className = "kz-btn kz-btn--later"; later.textContent = kzMsg("btnLater", "Plus tard");
      actions.appendChild(done); actions.appendChild(later);
      b.appendChild(head); b.appendChild(mkLead(prompt)); b.appendChild(bar); b.appendChild(actions);
      openBubble(k1, b);
      stagger(b);

      let settled = false;
      let desarmeF = null;
      const outcome = await new Promise((resolve) => {
        const finish = (r) => {
          if (settled) return;
          settled = true;
          if (desarmeF) desarmeF();
          resolve(r);
        };
        later.addEventListener("click", (e) => { e.stopPropagation(); finish("later"); });
        desarmeF = armEscape(() => finish("later"));
        let left = seconds;
        const t = setInterval(() => {
          if (settled) { clearInterval(t); return; }
          left -= 1;
          timer.textContent = fmt(Math.max(0, left));
          barFill.style.width = Math.round(((seconds - Math.max(0, left)) / seconds) * 100) + "%";
          done.textContent = kzMsg("btnDoneIn", "Fait dans {n} s").replace("{n}", Math.max(0, left));
          if (left > 0 && left % 10 === 0) {
            vocal.textContent = kzMsg("focusRemaining", "Encore {n} secondes").replace("{n}", left);
          }
          if (left <= 0) {
            clearInterval(t);
            timer.remove(); bar.remove();
            done.disabled = false;
            done.textContent = kzMsg("btnDone", "C'est fait");
            vocal.textContent = kzMsg("focusOver", "La pause est terminee, tu peux valider");
            done.addEventListener("click", (e) => { e.stopPropagation(); finish("done"); }, { once: true });
          }
        }, 1000);
      });

      if (outcome === "later") {
        await afterLater(shadow, k1, b, ctx);
        await removeBack();
        return;
      }
      await afterDone(shadow, k1, b, ctx);
      await removeBack();
    }

    // Rappel passe, on note l'energie puis le chat entre en scene.
    async function afterLater(shadow, k1, bubble, ctx) {
      const energy = await new Promise((resolve) => { swapBubble(k1, bubble, energyBubbleNode(resolve)); });
      // Enregistre des le choix, avant l'animation de sortie. Si l'onglet se
      // ferme entre temps, le report est deja compte.
      sendOutcome("later", energy);
      k1.classList.remove("kz-koala--sport");
      await runSnark(shadow, { repToday: ctx.repToday + 1, doneToday: ctx.doneToday, goal: ctx.goal, nextMinutes: ctx.snoozeMinutes }, k1);
    }

    // Habitude faite, coche puis citation en recompense.
    async function afterDone(shadow, k1, bubble, ctx) {
      const energy = await new Promise((resolve) => { swapBubble(k1, bubble, energyBubbleNode(resolve)); });
      // Enregistre avant de feliciter. L'ecran de validation annonce une serie,
      // il ne doit pas l'annoncer avant que la donnee soit ecrite.
      sendOutcome("done", energy);
      const win = k1.querySelector(".kz-bubble");
      await swapBubble(k1, win, winBubbleNode(ctx.streak + 1));
      await sleep(T.hold);
      k1.classList.remove("kz-koala--sport");
      await playExit(k1);
      k1.remove();

      await sleep(900);
      const k2 = buildKoala(shadow, pickKoala(lastKoala));
      let d2 = false;
      k2.addEventListener("click", () => { d2 = true; });
      playEnter(k2);
      await sleep(T.arrive + 60);
      const q = rand(QUOTES);
      showQuoteBubble(k2, q.t, q.a, ctx.screenToday);
      await waitOrDismiss(9500, () => d2);
      await playExit(k2);
      k2.remove();
    }

    function energyBubbleNode(resolve) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--act";
      showEnergyPicker(b, (v) => resolve(v));
      return b;
    }
    function winBubbleNode(streak) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--act kz-bubble--win";
      buildWin(b, streak);
      return b;
    }

    function playEnter(wrap) {
      if (reduceMotion()) { wrap.style.animation = "kzFadeIn " + T.reduced + "ms linear both"; return; }
      wrap.style.animation = "kzArrive " + T.arrive + "ms cubic-bezier(0.34,1.06,0.4,1) both, kzBreath 5s ease-in-out 300ms infinite";
    }

    async function playExit(wrap) {
      if (reduceMotion()) {
        wrap.style.animation = "kzFadeOut " + T.reduced + "ms linear both";
        await sleep(T.reduced + 20);
        return;
      }
      wrap.style.animation = "kzLeave " + T.leave + "ms cubic-bezier(0.2,0,0,1) both";
      await sleep(T.leave + 30);
    }

    // Le nettoyage de secours. Sur une exception, tout doit disparaitre sans
    // laisser de trace. Mais un report ou un rappel manque sans reponse laisse
    // volontairement le personnage a l'ecran, garderKoala evite alors de le
    // reprendre au moment ou la sequence se termine normalement.
    function clearKoalas(garderKoala) {
      const host = document.getElementById(HOST_ID);
      if (!host || !host.shadowRoot) return;
      const sel = garderKoala ? ".kz-focus, .kz-focus-back" : ".kz-koala, .kz-focus, .kz-focus-back";
      host.shadowRoot.querySelectorAll(sel).forEach((n) => n.remove());
    }

    async function waitOrDismiss(ms, isDismissed) {
      const step = 100;
      let t = 0;
      while (t < ms) { if (isDismissed()) return; await sleep(step); t += step; }
    }

    async function runSequence(opts) {
      if (running) return;
      running = true;
      const ctx = {
        focus: !!(opts && opts.focus),
        focusSeconds: Math.max(5, Math.min(120, Math.round((opts && opts.focusSeconds) || 30))),
        screenToday: (opts && opts.screenToday != null) ? opts.screenToday : null,
        snoozeMinutes: Math.max(0, Math.round((opts && opts.snoozeMinutes) || 0)),
        intervalMinutes: Math.max(0, Math.round((opts && opts.intervalMinutes) || 0)),
        doneToday: Math.max(0, Math.round((opts && opts.doneToday) || 0)),
        repToday: Math.max(0, Math.round((opts && opts.repToday) || 0)),
        goal: Math.max(0, Math.round((opts && opts.habitGoal) || 0)),
        streak: Math.max(0, Math.round((opts && opts.streak) || 0))
      };
      const shadow = ensureShadow();
      await loadSettings();

      // Mis a vrai quand la sequence se termine en laissant volontairement le
      // personnage a l'ecran, report ou rappel manque sans reponse. Le nettoyage
      // de secours du finally ne doit alors pas le reprendre.
      let garder = false;

      try {
        if (ctx.focus) { await runFocus(shadow, ctx); return; }

        // Un personnage reste parfois de la relance d'un rappel precedent, sans
        // reponse. Il ne quitte jamais l'ecran de lui meme, donc ce rappel doit
        // le retrouver et changer seulement son visage, jamais en construire un
        // second par dessus.
        const dejaLa = shadow.querySelector(".kz-koala");
        let k1;
        if (dejaLa) {
          k1 = dejaLa;
          k1.classList.remove("kz-koala--snark");
          k1.classList.add("kz-koala--sport");
          renewKoala(k1, pickKoala(lastKoala));
        } else {
          k1 = buildKoala(shadow, pickKoala(lastKoala));
          k1.classList.add("kz-koala--sport");
          playEnter(k1);
          await sleep(T.arrive + 60);
        }

        let bubble = null;
        const prompt = await nextSport();
        let desarme = null;
        const outcome = await new Promise((resolve) => {
          let settled = false;
          const finish = (r) => {
            if (settled) return;
            settled = true;
            if (desarme) desarme();
            resolve(r);
          };
          bubble = showSportBubble(k1, prompt, ctx.doneToday, ctx.goal, {
            onDone: () => finish("done"),
            onLater: () => finish("later")
          });
          desarme = armEscape(() => finish("later"));
          setTimeout(() => finish("missed"), 18000);
        });

        // Plus de croix. Ce chemin ne peut plus etre atteint, il est conserve
        // par prudence si une issue "closed" revenait un jour.
        if (outcome === "closed") {
          sendOutcome("missed", null);
          if (bubble) bubble.remove();
          k1.classList.remove("kz-koala--sport");
          await playExit(k1);
          k1.remove();
          return;
        }

        if (outcome === "missed") {
          sendOutcome("missed", null);
          if (bubble) bubble.remove();
          k1.classList.remove("kz-koala--sport");
          // Meme releve sans vide que sur Plus tard. Le personnage ne quitte
          // jamais l'ecran, le nouveau visage arrive et l'ancien s'en va derriere.
          await runSnark(shadow, { repToday: ctx.repToday + 1, doneToday: ctx.doneToday, goal: ctx.goal, nextMinutes: ctx.intervalMinutes }, k1);
          garder = true;
          return;
        }

        if (outcome === "later") {
          await afterLater(shadow, k1, bubble, ctx);
          garder = true;
          return;
        }
        await afterDone(shadow, k1, bubble, ctx);
      } catch (e) {
        // Le finally ci dessous efface l'ecran. Sans cette capture, une exception
        // faisait disparaitre le koala SANS AUCUNE TRACE, ni erreur ni indice.
        // C'est ce qui a rendu trois tours d'enquete si penibles.
        try { console.warn("Koala Zen, sequence interrompue,", e && e.message); } catch (_) { /* noop */ }
      } finally {
        clearKoalas(garder);
        running = false;
      }
    }

    api.runtime.onMessage.addListener((msg) => {
      if (msg && msg.type === "kz-show") {
        runSequence({
          focus: msg.focus,
          focusSeconds: msg.focusSeconds,
          screenToday: msg.screenToday,
          snoozeMinutes: msg.snoozeMinutes,
          intervalMinutes: msg.intervalMinutes,
          doneToday: msg.doneToday,
          repToday: msg.repToday,
          habitGoal: msg.habitGoal,
          streak: msg.streak
        });
      }
    });
  })();
}
