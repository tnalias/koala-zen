// Animaux de passage, rendu dans la page. Cinq scenes gratuites qui ne
// demandent rien, le chat seul, et parfois deux chats ou un chat et un
// renard qui se croisent et se saluent. Jamais le koala, jamais l'arbre.
// L'ordonnancement est fait par background.js, ce fichier ne decide de rien,
// il joue la scene qu'on lui demande et s'effface.
// Les dessins et les courbes viennent de la planche de design, reprises telles quelles.
if (!globalThis.__kzPassLoaded) {
  globalThis.__kzPassLoaded = true;

  (function () {
    const api = globalThis.browser || globalThis.chrome;
    const HOST_ID = "kz-passage-host";

    // Geometrie de la planche 13. Une seule source pour toutes les scenes.
    const G = {
      margin: "6vh",     // marge basse de la fenetre, au dessus du bord
      cat: 140,          // hauteur du chat
      fox: 127,          // hauteur du renard, meme proportion que la planche (60/66 du chat)
      bubbleMin: 220,    // largeur de bulle, phrase courte
      bubbleMax: 240,    // largeur de bulle, phrase longue
      longAt: 40,        // au dela de 40 signes la phrase est longue
      noneAt: 600,       // sous cette largeur, aucun passage
      twoAt: 900,        // sous cette largeur, aucune rencontre a deux personnages
      fadeOut: 200,      // sortie rapide quand un rappel tombe
      reduced: 120,
      meetingDelay: 2000 // delai avant le coucou de visioconference
    };

    const EASE = "cubic-bezier(0.2, 0, 0, 1)";

    /* ---------------- dessins, reprises de la planche ---------------- */
    const COATS = [
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"> <path d="M22 46 q-18 -6 -14 -26" stroke="#34383D" stroke-width="4" fill="none" stroke-linecap="round"></path> <rect x="30" y="44" width="5" height="28" rx="2.5" fill="#34383D"></rect> <rect x="70" y="44" width="5" height="28" rx="2.5" fill="#34383D"></rect> <ellipse cx="54" cy="40" rx="26" ry="9" fill="#43484E"></ellipse> <rect x="38" y="44" width="5" height="28" rx="2.5" fill="#43484E"></rect> <rect x="62" y="44" width="5" height="28" rx="2.5" fill="#43484E"></rect> <path d="M78 24 L74 6 L90 16 Z" fill="#34383D"></path><path d="M96 22 L102 6 L88 14 Z" fill="#34383D"></path> <circle cx="88" cy="26" r="11" fill="#4E545A"></circle> <g><ellipse cx="83" cy="26" rx="3.4" ry="2.8" fill="#C9DFA0"></ellipse><path d="M83 24 L83 28" stroke="#22262A" stroke-width="2" stroke-linecap="round"></path></g><g><ellipse cx="94" cy="26" rx="3.4" ry="2.8" fill="#C9DFA0"></ellipse><path d="M94 24 L94 28" stroke="#22262A" stroke-width="2" stroke-linecap="round"></path></g><ellipse cx="90" cy="31" rx="2" ry="1.5" fill="#5E4A4A"></ellipse><path d="M90 33 q3 3 6 0" stroke="#22262A" stroke-width="1.8" fill="none" stroke-linecap="round"></path> <path d="M97 28 L108 26 M97 32 L108 34" stroke="#DDE3E6" stroke-width="1.4" stroke-linecap="round"></path> </svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"> <path d="M18 50 q-14 -4 -10 -16" stroke="#7C868E" stroke-width="8" fill="none" stroke-linecap="round"></path> <rect x="32" y="58" width="9" height="12" rx="4.5" fill="#7C868E"></rect> <rect x="68" y="58" width="9" height="12" rx="4.5" fill="#7C868E"></rect> <ellipse cx="52" cy="44" rx="32" ry="22" fill="#9AA5AE"></ellipse> <rect x="40" y="58" width="9" height="12" rx="4.5" fill="#9AA5AE"></rect> <rect x="60" y="58" width="9" height="12" rx="4.5" fill="#9AA5AE"></rect> <path d="M74 20 L72 6 L86 14 Z" fill="#7C868E"></path><path d="M96 20 L100 6 L88 13 Z" fill="#7C868E"></path> <circle cx="86" cy="26" r="16" fill="#A9B2B9"></circle> <g><ellipse cx="80" cy="24" rx="4.8" ry="4.2" fill="#F6E9B4"></ellipse><circle cx="79.5" cy="23.5" r="2" fill="#22262A"></circle><circle cx="81.4" cy="22.2" r="0.9" fill="#FFFFFF"></circle></g><g><ellipse cx="93" cy="25" rx="4.8" ry="4.2" fill="#F6E9B4"></ellipse><circle cx="93.8" cy="25.8" r="2" fill="#22262A"></circle><circle cx="95.6" cy="24.4" r="0.9" fill="#FFFFFF"></circle></g><ellipse cx="74" cy="32" rx="6" ry="4.5" fill="#A9B2B9"></ellipse><ellipse cx="98" cy="32" rx="6" ry="4.5" fill="#A9B2B9"></ellipse><ellipse cx="88" cy="32" rx="2.6" ry="2" fill="#E08C6E"></ellipse><path d="M88 34 q4 4 8 0" stroke="#22262A" stroke-width="2" fill="none" stroke-linecap="round"></path> <path d="M100 28 L111 26 M100 32 L111 34" stroke="#E4E8EA" stroke-width="1.4" stroke-linecap="round"></path> </svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"> <path d="M18 50 q-14 -4 -10 -16" stroke="#B57334" stroke-width="8" fill="none" stroke-linecap="round"></path> <rect x="32" y="58" width="9" height="12" rx="4.5" fill="#B57334"></rect> <rect x="68" y="58" width="9" height="12" rx="4.5" fill="#B57334"></rect> <ellipse cx="52" cy="44" rx="32" ry="22" fill="#D18B4E"></ellipse> <ellipse cx="54" cy="52" rx="22" ry="12" fill="#F0DCC4"></ellipse> <rect x="40" y="58" width="9" height="12" rx="4.5" fill="#D18B4E"></rect> <rect x="60" y="58" width="9" height="12" rx="4.5" fill="#D18B4E"></rect> <path d="M74 20 L72 6 L86 14 Z" fill="#B57334"></path><path d="M96 20 L100 6 L88 13 Z" fill="#B57334"></path> <circle cx="86" cy="26" r="16" fill="#DC9A5E"></circle> <g><ellipse cx="80" cy="24" rx="4.8" ry="4.2" fill="#F0DE9C"></ellipse><circle cx="79.5" cy="23.5" r="2" fill="#22262A"></circle><circle cx="81.4" cy="22.2" r="0.9" fill="#FFFFFF"></circle></g><g><ellipse cx="93" cy="25" rx="4.8" ry="4.2" fill="#F0DE9C"></ellipse><circle cx="93.8" cy="25.8" r="2" fill="#22262A"></circle><circle cx="95.6" cy="24.4" r="0.9" fill="#FFFFFF"></circle></g><ellipse cx="74" cy="32" rx="6" ry="4.5" fill="#DC9A5E"></ellipse><ellipse cx="98" cy="32" rx="6" ry="4.5" fill="#DC9A5E"></ellipse><ellipse cx="88" cy="32" rx="2.6" ry="2" fill="#C96C6C"></ellipse><path d="M88 34 q4 4 8 0" stroke="#22262A" stroke-width="2" fill="none" stroke-linecap="round"></path> <path d="M100 28 L111 26 M100 32 L111 34" stroke="#F7EFE6" stroke-width="1.4" stroke-linecap="round"></path> </svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"> <path d="M18 50 q-14 -4 -10 -16" stroke="#33373C" stroke-width="8" fill="none" stroke-linecap="round"></path> <rect x="32" y="58" width="9" height="12" rx="4.5" fill="#33373C"></rect> <rect x="68" y="58" width="9" height="12" rx="4.5" fill="#33373C"></rect> <ellipse cx="52" cy="44" rx="32" ry="22" fill="#3F444A"></ellipse> <ellipse cx="60" cy="52" rx="16" ry="10" fill="#F2F0EE"></ellipse> <rect x="40" y="58" width="9" height="12" rx="4.5" fill="#F2F0EE"></rect> <rect x="60" y="58" width="9" height="12" rx="4.5" fill="#F2F0EE"></rect> <path d="M74 20 L72 6 L86 14 Z" fill="#33373C"></path><path d="M96 20 L100 6 L88 13 Z" fill="#33373C"></path> <circle cx="86" cy="26" r="16" fill="#4A5057"></circle> <g><ellipse cx="80" cy="24" rx="4.8" ry="4.2" fill="#F0DE9C"></ellipse><circle cx="79.5" cy="23.5" r="2" fill="#22262A"></circle><circle cx="81.4" cy="22.2" r="0.9" fill="#FFFFFF"></circle></g><g><ellipse cx="93" cy="25" rx="4.8" ry="4.2" fill="#F0DE9C"></ellipse><circle cx="93.8" cy="25.8" r="2" fill="#22262A"></circle><circle cx="95.6" cy="24.4" r="0.9" fill="#FFFFFF"></circle></g><ellipse cx="74" cy="32" rx="6" ry="4.5" fill="#4A5057"></ellipse><ellipse cx="98" cy="32" rx="6" ry="4.5" fill="#4A5057"></ellipse><ellipse cx="88" cy="32" rx="2.6" ry="2" fill="#D6A2A2"></ellipse><path d="M88 34 q4 4 8 0" stroke="#22262A" stroke-width="2" fill="none" stroke-linecap="round"></path> <path d="M100 28 L111 26 M100 32 L111 34" stroke="#F2F0EE" stroke-width="1.4" stroke-linecap="round"></path> </svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"> <path d="M18 50 q-14 -4 -10 -16" stroke="#C4AC8C" stroke-width="8" fill="none" stroke-linecap="round"></path> <rect x="32" y="58" width="9" height="12" rx="4.5" fill="#C4AC8C"></rect> <rect x="68" y="58" width="9" height="12" rx="4.5" fill="#C4AC8C"></rect> <ellipse cx="52" cy="44" rx="32" ry="22" fill="#DCC6A8"></ellipse> <rect x="40" y="58" width="9" height="12" rx="4.5" fill="#DCC6A8"></rect> <rect x="60" y="58" width="9" height="12" rx="4.5" fill="#DCC6A8"></rect> <path d="M74 20 L72 6 L86 14 Z" fill="#C4AC8C"></path><path d="M96 20 L100 6 L88 13 Z" fill="#C4AC8C"></path> <circle cx="86" cy="26" r="16" fill="#E5D3BB"></circle> <g><ellipse cx="80" cy="24" rx="4.8" ry="4.2" fill="#BFD79A"></ellipse><circle cx="79.5" cy="23.5" r="2" fill="#22262A"></circle><circle cx="81.4" cy="22.2" r="0.9" fill="#FFFFFF"></circle></g><g><ellipse cx="93" cy="25" rx="4.8" ry="4.2" fill="#BFD79A"></ellipse><circle cx="93.8" cy="25.8" r="2" fill="#22262A"></circle><circle cx="95.6" cy="24.4" r="0.9" fill="#FFFFFF"></circle></g><ellipse cx="74" cy="32" rx="6" ry="4.5" fill="#E5D3BB"></ellipse><ellipse cx="98" cy="32" rx="6" ry="4.5" fill="#E5D3BB"></ellipse><ellipse cx="88" cy="32" rx="2.6" ry="2" fill="#D98A8A"></ellipse><path d="M88 34 q4 4 8 0" stroke="#22262A" stroke-width="2" fill="none" stroke-linecap="round"></path> <path d="M100 28 L111 26 M100 32 L111 34" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"></path> </svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"> <path d="M20 46 q-4 -22 10 -18" stroke="#6F5540" stroke-width="6" fill="none" stroke-linecap="round"></path> <rect x="32" y="46" width="7" height="24" rx="3.5" fill="#6F5540"></rect> <rect x="68" y="46" width="7" height="24" rx="3.5" fill="#6F5540"></rect> <ellipse cx="52" cy="40" rx="27" ry="14" fill="#8A6B4F"></ellipse> <rect x="40" y="46" width="7" height="24" rx="3.5" fill="#8A6B4F"></rect> <rect x="60" y="46" width="7" height="24" rx="3.5" fill="#8A6B4F"></rect> <path d="M76 22 L72 6 L88 15 Z" fill="#6F5540"></path><path d="M94 24 q10 -12 8 2 q-2 6 -8 2 Z" fill="#6F5540"></path> <circle cx="86" cy="27" r="14" fill="#997A5C"></circle> <ellipse cx="80" cy="25" rx="4.4" ry="3.8" fill="#F0DE9C"></ellipse><ellipse cx="92" cy="27" rx="4.4" ry="3.8" fill="#F0DE9C"></ellipse><circle cx="78" cy="24" r="1.8" fill="#22262A"></circle><circle cx="94" cy="29" r="1.8" fill="#22262A"></circle><ellipse cx="87" cy="33" rx="2.4" ry="1.8" fill="#C97F6C"></ellipse><path d="M87 35 q4 4 8 -1" stroke="#22262A" stroke-width="2" fill="none" stroke-linecap="round"></path><path d="M89 37 q3 5 6 1" fill="#C97F6C"></path> <path d="M98 29 L109 27 M98 33 L109 35" stroke="#F0E8E0" stroke-width="1.4" stroke-linecap="round"></path> </svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"> <path d="M20 46 q-16 -4 -12 -22" stroke="#7C868E" stroke-width="6" fill="none" stroke-linecap="round"></path> <rect x="32" y="46" width="7" height="24" rx="3.5" fill="#7C868E"></rect> <rect x="68" y="46" width="7" height="24" rx="3.5" fill="#7C868E"></rect> <ellipse cx="52" cy="40" rx="27" ry="14" fill="#9AA5AE"></ellipse> <path d="M42 28 L40 34 M52 27 L51 33 M62 28 L61 34" stroke="#6E7880" stroke-width="3" stroke-linecap="round"></path> <rect x="40" y="46" width="7" height="24" rx="3.5" fill="#9AA5AE"></rect> <rect x="60" y="46" width="7" height="24" rx="3.5" fill="#9AA5AE"></rect> <path d="M76 22 L72 6 L88 15 Z" fill="#7C868E"></path><path d="M94 22 L100 6 L86 14 Z" fill="#7C868E"></path> <circle cx="86" cy="27" r="14" fill="#A9B2B9"></circle> <g><ellipse cx="81" cy="26" rx="3.4" ry="2.8" fill="#F6E9B4"></ellipse><path d="M81 24 L81 28" stroke="#22262A" stroke-width="2" stroke-linecap="round"></path></g><g><ellipse cx="92" cy="26" rx="3.4" ry="2.8" fill="#F6E9B4"></ellipse><path d="M92 24 L92 28" stroke="#22262A" stroke-width="2" stroke-linecap="round"></path></g><ellipse cx="88" cy="32" rx="2.4" ry="1.8" fill="#E08C6E"></ellipse><path d="M88 34 q4 4 8 0" stroke="#22262A" stroke-width="2" fill="none" stroke-linecap="round"></path> <path d="M98 29 L109 27 M98 33 L109 35" stroke="#E4E8EA" stroke-width="1.4" stroke-linecap="round"></path> </svg>`
    ];
    // Le renard de la rencontre, planche 12, marche naturellement vers la
    // gauche. Dessine tel quel, mirore par miroir CSS cote a cote au montage,
    // jamais retourne ici, exactement la regle des pelages de chat.
    const FOX_SVG = `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"> <path d="M20 48 q-18 -8 -12 -28" stroke="#C96C24" stroke-width="9" fill="none" stroke-linecap="round"></path> <path d="M9 26 q-2 -6 1 -10" stroke="#F7EFE6" stroke-width="9" fill="none" stroke-linecap="round"></path> <rect x="34" y="50" width="7" height="20" rx="3.5" fill="#3A3F43"></rect> <rect x="68" y="50" width="7" height="20" rx="3.5" fill="#3A3F43"></rect> <ellipse cx="52" cy="42" rx="28" ry="15" fill="#E4923F"></ellipse> <ellipse cx="54" cy="50" rx="20" ry="8" fill="#F7EFE6"></ellipse> <rect x="42" y="50" width="7" height="20" rx="3.5" fill="#3A3F43"></rect> <rect x="60" y="50" width="7" height="20" rx="3.5" fill="#3A3F43"></rect> <path d="M74 20 L69 2 L88 13 Z" fill="#C96C24"></path><path d="M96 19 L102 2 L86 12 Z" fill="#C96C24"></path> <path d="M77 20 L74 8 L86 14 Z" fill="#3A3F43"></path><path d="M94 19 L98 8 L87 13 Z" fill="#3A3F43"></path> <circle cx="86" cy="28" r="15" fill="#E4923F"></circle> <path d="M86 20 q-12 4 -11 14 q1 10 11 11 q10 -1 11 -11 q1 -10 -11 -14 Z" fill="#F7EFE6"></path> <ellipse cx="80" cy="26" rx="4.6" ry="4.2" fill="#5C4436"></ellipse><circle cx="81.4" cy="24.6" r="1.3" fill="#FFFFFF"></circle> <ellipse cx="93" cy="27" rx="4.6" ry="4.2" fill="#5C4436"></ellipse><circle cx="94.4" cy="25.6" r="1.3" fill="#FFFFFF"></circle> <ellipse cx="88" cy="35" rx="2.6" ry="2" fill="#2B2B33"></ellipse><path d="M88 37 q4 4 8 0" stroke="#2B2B33" stroke-width="1.9" fill="none" stroke-linecap="round"></path> <ellipse cx="75" cy="33" rx="4" ry="2.6" fill="#F2B48D"></ellipse><ellipse cx="99" cy="33" rx="4" ry="2.6" fill="#F2B48D"></ellipse> <path d="M100 30 L109 28 M100 34 L109 36" stroke="#F7EFE6" stroke-width="1.4" stroke-linecap="round"></path> </svg>`;
    const STYLES = `
:host { all: initial; }
.kz-pass-layer { position: fixed; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; z-index: 2147482000; overflow: hidden; }
.kz-pass-track { position: absolute; left: 0; bottom: ${G.margin}; width: 100%; height: 0; }
.kz-pass-body { position: absolute; left: 0; bottom: 0; }
.kz-pass-svg { display: block; }
.kz-pass-bubble {
  position: absolute; box-sizing: border-box; background: #FFFFFF; border: 1px solid #E0E0E0;
  border-radius: 16px; padding: 13px 15px; box-shadow: 0 8px 24px rgba(16,24,40,0.14);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 16px; line-height: 23px; color: #333333; opacity: 0;
}
.kz-pass-tip { position: absolute; width: 16px; height: 16px; background: #FFFFFF; border-left: 1px solid #E0E0E0; border-bottom: 1px solid #E0E0E0; border-radius: 0 0 0 3px; transform: rotate(-45deg); }
.kz-eyes { transform-box: fill-box; transform-origin: center; }
@keyframes kzCatWalk { 0%, 3% { transform: translateX(-120px); } 32%, 66% { transform: translateX(calc(50% + 130px)); } 97%, 100% { transform: translateX(calc(100% + 120px)); } }
@keyframes kzCatBob { 0%, 6% { transform: translateY(0); } 16% { transform: translateY(-1.5px); } 26% { transform: translateY(0); } 36% { transform: translateY(-1.5px); } 40%, 58% { transform: translateY(0); } 68% { transform: translateY(-1.5px); } 78% { transform: translateY(0); } 88% { transform: translateY(-1.5px); } 94%, 100% { transform: translateY(0); } }
@keyframes kzCatLegA { 0% { transform: rotate(0deg); } 3.4% { transform: rotate(0deg); } 6.8% { transform: rotate(-12deg); } 10.2% { transform: rotate(10.2deg); } 13.6% { transform: rotate(-12deg); } 17% { transform: rotate(10.2deg); } 20.4% { transform: rotate(-12deg); } 23.8% { transform: rotate(10.2deg); } 27.2% { transform: rotate(-12deg); } 30.6% { transform: rotate(10.2deg); } 34% { transform: rotate(-12deg); } 37.4% { transform: rotate(10.2deg); } 40.8% { transform: rotate(0deg); } 44.2% { transform: rotate(0deg); } 47.6% { transform: rotate(0deg); } 51% { transform: rotate(0deg); } 54.4% { transform: rotate(0deg); } 57.8% { transform: rotate(0deg); } 61.2% { transform: rotate(-12deg); } 64.6% { transform: rotate(10.2deg); } 68% { transform: rotate(-12deg); } 71.4% { transform: rotate(10.2deg); } 74.8% { transform: rotate(-12deg); } 78.2% { transform: rotate(10.2deg); } 81.6% { transform: rotate(-12deg); } 85% { transform: rotate(10.2deg); } 88.4% { transform: rotate(-12deg); } 91.8% { transform: rotate(10.2deg); } 95.2% { transform: rotate(0deg); } 98.6% { transform: rotate(0deg); } }
@keyframes kzCatLegB { 0% { transform: rotate(0deg); } 3.4% { transform: rotate(0deg); } 6.8% { transform: rotate(10.2deg); } 10.2% { transform: rotate(-12deg); } 13.6% { transform: rotate(10.2deg); } 17% { transform: rotate(-12deg); } 20.4% { transform: rotate(10.2deg); } 23.8% { transform: rotate(-12deg); } 27.2% { transform: rotate(10.2deg); } 30.6% { transform: rotate(-12deg); } 34% { transform: rotate(10.2deg); } 37.4% { transform: rotate(-12deg); } 40.8% { transform: rotate(0deg); } 44.2% { transform: rotate(0deg); } 47.6% { transform: rotate(0deg); } 51% { transform: rotate(0deg); } 54.4% { transform: rotate(0deg); } 57.8% { transform: rotate(0deg); } 61.2% { transform: rotate(10.2deg); } 64.6% { transform: rotate(-12deg); } 68% { transform: rotate(10.2deg); } 71.4% { transform: rotate(-12deg); } 74.8% { transform: rotate(10.2deg); } 78.2% { transform: rotate(-12deg); } 81.6% { transform: rotate(10.2deg); } 85% { transform: rotate(-12deg); } 88.4% { transform: rotate(10.2deg); } 91.8% { transform: rotate(-12deg); } 95.2% { transform: rotate(0deg); } 98.6% { transform: rotate(0deg); } }
@keyframes kzCatTail { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(9deg); } }
@keyframes kzCatHello { 0%, 32% { transform: translateY(6px) scale(0.94); opacity: 0; } 36%, 62% { transform: translateY(0) scale(1); opacity: 1; } 66%, 100% { transform: translateY(4px) scale(0.96); opacity: 0; } }
@keyframes kzCatWave { 0%, 41% { transform: rotate(0deg); } 45% { transform: rotate(-64deg); } 48% { transform: rotate(-44deg); } 51% { transform: rotate(-64deg); } 54% { transform: rotate(-44deg); } 57%, 100% { transform: rotate(0deg); } }
@keyframes kzMeetCat { 0%, 3% { transform: translateX(-120px); } 30%, 70% { transform: translateX(calc(50% - 80px)); } 97%, 100% { transform: translateX(-140px); } }
@keyframes kzMeetFox { 0%, 3% { transform: translateX(calc(100% + 120px)); } 30%, 70% { transform: translateX(calc(50% + 80px)); } 97%, 100% { transform: translateX(calc(100% + 140px)); } }
@keyframes kzSay1 { 0%, 33% { transform: translateY(6px) scale(0.94); opacity: 0; } 38%, 48% { transform: translateY(0) scale(1); opacity: 1; } 52%, 100% { transform: translateY(4px) scale(0.96); opacity: 0; } }
@keyframes kzSay2 { 0%, 51% { transform: translateY(6px) scale(0.94); opacity: 0; } 56%, 66% { transform: translateY(0) scale(1); opacity: 1; } 70%, 100% { transform: translateY(4px) scale(0.96); opacity: 0; } }
@keyframes kzEyeBlink { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.08); } }
@keyframes kzEyeBlinkSay { 0%, 36%, 42%, 56%, 62%, 100% { transform: scaleY(1); } 39%, 59% { transform: scaleY(0.08); } }
@media (prefers-reduced-motion: reduce) { .kz-pass-layer { display: none; } }
`;

    /* ---------------- outils ---------------- */
    let ANIM_MODE = "always";
    function reduceMotion() {
      if (ANIM_MODE === "never") return true;
      if (ANIM_MODE === "always") return false;
      try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
      catch (e) { return false; }
    }
    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    // Un SVG passe par DOMParser puis importNode existe dans l'arbre et ne se
    // DESSINE PAS, en particulier dans un Shadow DOM. Les animaux etaient donc
    // INVISIBLES, le calque se montait, les pistes s'animaient, et rien
    // n'apparaissait. Meme cause que le vu de la coche et le personnage de la
    // bulle de relance, meme correction.
    // 2026-08-04, le puits "innerHTML" signale par le linter des extensions
    // (et son remplacant Range.createContextualFragment, egalement signale)
    // sont retires : on reconstruit le SVG noeud par noeud avec createElementNS
    // et setAttribute, jamais d'assignation d'une chaine dans le DOM. DOMParser
    // ne fait ici que LIRE une chaine comme un arbre de donnees ; le noeud
    // etranger qu'il produit n'est jamais insere tel quel (pas d'importNode),
    // ce qui evite a la fois le puits signale et le bug de rendu ci-dessus.
    // Verifie cote a cote (meme SVG, meme shadow root) contre les trois autres
    // approches. Ce sont NOS chaines, definies en tete de ce fichier, jamais du
    // contenu de page. La regle qui tient toujours, jamais .style sur un noeud
    // SVG, setAttribute seulement.
    function rebuildNode(foreign, doc) {
      if (foreign.nodeType === Node.TEXT_NODE) return doc.createTextNode(foreign.nodeValue);
      if (foreign.nodeType !== Node.ELEMENT_NODE) return null;
      const ns = foreign.namespaceURI || "http://www.w3.org/2000/svg";
      const el = doc.createElementNS(ns, foreign.localName || foreign.tagName);
      for (let i = 0; i < foreign.attributes.length; i++) {
        const a = foreign.attributes[i];
        el.setAttribute(a.name, a.value);
      }
      for (let j = 0; j < foreign.childNodes.length; j++) {
        const child = rebuildNode(foreign.childNodes[j], doc);
        if (child) el.appendChild(child);
      }
      return el;
    }
    function svgFrom(markup) {
      try {
        const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
        const root = parsed.documentElement;
        if (!root || root.nodeName === "parsererror") return null;
        return rebuildNode(root, document);
      } catch (e) { return null; }
    }
    function anim(node, name, ms, ease, delay) {
      if (!node) return;
      node.setAttribute("style", (node.getAttribute("style") || "")
        + ";animation:" + name + " " + ms + "ms " + (ease || EASE) + " " + (delay || 0) + "ms 1 both");
    }

    // Les pelages de la planche sont statiques. On y greffe la marche du chat
    // de reference, pattes alternees et queue. Quatre rect par pelage, la
    // queue en premier path. Le pivot de chaque patte suit SON PROPRE y, pas
    // une valeur fixe, trois des sept pelages et le renard ne sont pas a
    // y=58, une valeur figee les laissait immobiles, jambes plantees, tout en
    // traversant l'ecran. tailOrigin reste optionnel, le renard passe le sien.
    function walkify(svg, ms, tailOrigin) {
      if (!svg) return;
      const pattes = svg.querySelectorAll("rect");
      Array.prototype.forEach.call(pattes, (r, i) => {
        const x = parseFloat(r.getAttribute("x")) + parseFloat(r.getAttribute("width")) / 2;
        const y = r.getAttribute("y");
        r.setAttribute("style", (r.getAttribute("style") || "") + ";transform-origin:" + x + "px " + y + "px");
        anim(r, i % 2 ? "kzCatLegB" : "kzCatLegA", ms, "linear");
      });
      const queue = svg.querySelector("path");
      if (queue) {
        queue.setAttribute("style", (queue.getAttribute("style") || "") + ";transform-origin:" + (tailOrigin || "18px 50px"));
        anim(queue, "kzCatTail", 1600, "ease-in-out");
        queue.style && (queue.style.animationIterationCount = "infinite");
      }
    }

    // Le clignement est obligatoire sur tous les animaux, paupiere sur l'axe
    // vertical et jamais une opacite. Sans lui les yeux fixes sont inquietants.
    // Le brun du renard rejoint les jaunes du chat, meme mecanique.
    function blinkify(svg, ms) {
      if (!svg) return;
      const yeux = svg.querySelectorAll("ellipse, circle");
      Array.prototype.forEach.call(yeux, (n) => {
        const f = (n.getAttribute("fill") || "").toUpperCase();
        if (f === "#F6E9B4" || f === "#F0DE9C" || f === "#FAF0C9" || f === "#5C4436" || f === "#C9DFA0" || f === "#BFD79A") {
          n.setAttribute("class", "kz-eyes");
          anim(n, "kzEyeBlink", 6500, "ease-in-out");
          n.style && (n.style.animationIterationCount = "infinite");
        }
      });
    }

    // gauche sert au second personnage d'une rencontre, mirore par CSS, dont
    // la tete finit a gauche de son propre corps. La pointe suit ce cote.
    function mkBubble(texte, gauche) {
      const b = document.createElement("div");
      b.className = "kz-pass-bubble";
      b.style.width = (texte.length > G.longAt ? G.bubbleMax : G.bubbleMin) + "px";
      b.textContent = texte;
      const t = document.createElement("div");
      t.className = "kz-pass-tip";
      // pose() ancre toujours la bulle depuis la droite du personnage, cote
      // tete. La pointe reste donc du cote droit de la bulle, cote
      // personnage, jamais a gauche dans le vide.
      if (gauche) { t.style.left = "26px"; } else { t.style.right = "26px"; }
      t.style.bottom = "-9px";
      b.appendChild(t);
      return b;
    }

    /* ---------------- montage ---------------- */
    let vivant = null;

    function host() {
      let h = document.getElementById(HOST_ID);
      if (h && h.shadowRoot) return h.shadowRoot;
      h = document.createElement("div");
      h.id = HOST_ID;
      h.setAttribute("aria-hidden", "true");
      const sh = h.attachShadow({ mode: "open" });
      const st = document.createElement("style");
      st.textContent = STYLES;
      sh.appendChild(st);
      (document.body || document.documentElement).appendChild(h);
      return sh;
    }

    function clear() {
      const h = document.getElementById(HOST_ID);
      if (h) h.remove();
      vivant = null;
    }

    /* ---------------- briques de scene ---------------- */
    function piste(layer, kfNom, ms) {
      const p = document.createElement("div");
      p.className = "kz-pass-track";
      if (kfNom && !reduceMotion()) anim(p, kfNom, ms, "linear");
      layer.appendChild(p);
      return p;
    }
    function corps(piste, svg, hauteur, cote) {
      const d = document.createElement("div");
      d.className = "kz-pass-body";
      d.style.height = hauteur + "px";
      if (cote === "right") { d.style.left = "auto"; d.style.right = "0"; }
      if (svg) {
        svg.setAttribute("class", "kz-pass-svg");
        svg.setAttribute("height", String(hauteur));
        const vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
        if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
          svg.setAttribute("width", String(Math.round((hauteur * vb[2]) / vb[3])));
        }
        d.appendChild(svg);
      }
      piste.appendChild(d);
      return d;
    }
    // Ancree depuis la DROITE du personnage, cote tete, et non depuis la
    // gauche. Le chat est dessine tete a droite de son propre corps, un
    // ancrage a gauche eloigne la bulle de la tete d'autant plus que le chat
    // est grand, et grandit avec lui au lieu de rester colle a cote.
    function pose(bulle, hote, dx, dy) {
      hote.appendChild(bulle);
      bulle.style.right = dx + "px";
      bulle.style.bottom = dy + "px";
    }
    // Symetrique de pose(), pour le second personnage d'une rencontre. Mirore
    // par scaleX(-1), sa tete finit a gauche de son propre corps, la bulle suit.
    function poseGauche(bulle, hote, dx, dy) {
      hote.appendChild(bulle);
      bulle.style.left = dx + "px";
      bulle.style.bottom = dy + "px";
    }

    /* ---------------- les cinq scenes ---------------- */
    // Chaque scene monte ses elements puis rend la main. Les keyframes de la
    // planche sont exprimees en pourcentage de la scene, donc la duree du
    // passage suffit a les cadencer, sans aucun minuteur intermediaire.
    const SCENES = {
      // 1. Le chat traverse, s'arrete au milieu, salue, repart.
      cross: (layer, sp, phrase) => {
        const p = piste(layer, "kzCatWalk", sp.ms);
        const c = svgFrom(COATS[sp.coat]);
        walkify(c, sp.ms); blinkify(c);
        const b = corps(p, c, G.cat);
        if (!reduceMotion()) anim(b, "kzCatBob", sp.ms, "ease-in-out");
        const bu = mkBubble(phrase);
        pose(bu, b, Math.round(G.cat * 0.2), G.cat - 6);
        anim(bu, "kzCatHello", sp.ms);
      },
      // 2. Le gros s'assoit pile au milieu.
      sit: (layer, sp, phrase) => {
        const p = piste(layer, "kzCatWalk", sp.ms);
        const c = svgFrom(COATS[sp.coat]);
        walkify(c, sp.ms); blinkify(c);
        const b = corps(p, c, G.cat);
        const bu = mkBubble(phrase);
        pose(bu, b, Math.round(G.cat * 0.2), G.cat - 6);
        anim(bu, "kzCatHello", sp.ms);
      },
      // 3. Le gros baille, la bulle sort apres le baillement.
      yawn: (layer, sp, phrase) => {
        const p = piste(layer, "kzCatWalk", sp.ms);
        const c = svgFrom(COATS[sp.coat]); walkify(c, sp.ms); blinkify(c);
        const b = corps(p, c, G.cat);
        if (!reduceMotion()) anim(b, "kzCatBob", sp.ms, "ease-in-out");
        const bu = mkBubble(phrase);
        pose(bu, b, Math.round(G.cat * 0.2), G.cat - 6);
        anim(bu, "kzCatHello", sp.ms, EASE, Math.round(sp.ms * 0.12));
      },
      // 4. Deux chats entrent par les cotes opposes, s'arretent nez a nez, se
      // saluent chacun a son tour puis repartent d'ou ils viennent. Une seule
      // bulle affichee a la fois, l'autre est retiree avant.
      meetCats: (layer, sp, p1, p2) => {
        const pL = piste(layer, "kzMeetCat", sp.ms);
        const cL = svgFrom(COATS[sp.coat]);
        walkify(cL, sp.ms); blinkify(cL);
        const bL = corps(pL, cL, G.cat);
        const buL = mkBubble(p1);
        pose(buL, bL, Math.round(G.cat * 0.2), G.cat - 6);
        anim(buL, "kzSay1", sp.ms);

        const pR = piste(layer, "kzMeetFox", sp.ms);
        const cR = svgFrom(COATS[(sp.coat + 3) % COATS.length]);
        cR.setAttribute("style", "transform:scaleX(-1)");
        walkify(cR, sp.ms); blinkify(cR);
        const bR = corps(pR, cR, G.cat);
        const buR = mkBubble(p2, true);
        poseGauche(buR, bR, Math.round(G.cat * 0.2), G.cat - 6);
        anim(buR, "kzSay2", sp.ms);
      },
      // 5. Le renard croise le chat, le plus rare. Meme choregraphie que
      // meetCats, le renard remplace le second chat.
      meetFox: (layer, sp, p1, p2) => {
        const pL = piste(layer, "kzMeetCat", sp.ms);
        const cL = svgFrom(COATS[sp.coat]);
        walkify(cL, sp.ms); blinkify(cL);
        const bL = corps(pL, cL, G.cat);
        const buL = mkBubble(p1);
        pose(buL, bL, Math.round(G.cat * 0.2), G.cat - 6);
        anim(buL, "kzSay1", sp.ms);

        const pR = piste(layer, "kzMeetFox", sp.ms);
        const cR = svgFrom(FOX_SVG);
        cR.setAttribute("style", "transform:scaleX(-1)");
        walkify(cR, sp.ms, "20px 48px"); blinkify(cR);
        const bR = corps(pR, cR, G.fox);
        const buR = mkBubble(p2, true);
        poseGauche(buR, bR, Math.round(G.fox * 0.2), G.fox - 6);
        anim(buR, "kzSay2", sp.ms);
      }
    };

    /* ---------------- pilotage ---------------- */
    async function play(sp) {
      // Un plaisir gratuit, pas une information. Sur Jamais, rien, et rien a la place.
      if (reduceMotion()) return;
      // Sous 600 px aucun passage. Sous 900 px, un seul personnage entre, donc
      // pas de rencontre a deux (sp.who vaut "both" pour meetCats/meetFox).
      if (window.innerWidth < G.noneAt) return;
      if (sp.who === "both" && window.innerWidth < G.twoAt) return;
      if (vivant) return;
      if (!SCENES[sp.variant]) return;

      const sh = host();
      const layer = document.createElement("div");
      layer.className = "kz-pass-layer";
      sh.appendChild(layer);

      // KZ_HELLO est declare par const dans quotes.js. Un const de haut niveau
      // N'EST PAS une propriete de l'objet global, donc globalThis.KZ_HELLO etait
      // TOUJOURS undefined, la liste de phrases restait vide, et le passage
      // avortait en silence sur le test de p1 juste en dessous. AUCUN animal ne
      // pouvait donc jamais traverser. Il faut lire l'identifiant nu, comme le
      // fait content.js pour KZ_SNARK.
      // sp.pool distingue le coucou de visioconference des phrases habituelles,
      // meme fonctionnement, un second lot de vingt phrases dans quotes.js.
      const phrases = sp.pool === "meeting"
        ? ((typeof KZ_MEETING !== "undefined" && Array.isArray(KZ_MEETING)) ? KZ_MEETING : [])
        : ((typeof KZ_HELLO !== "undefined" && Array.isArray(KZ_HELLO)) ? KZ_HELLO : []);
      const p1 = phrases[sp.phrase % Math.max(1, phrases.length)] || "";
      const p2 = phrases[(sp.phrase + 3) % Math.max(1, phrases.length)] || p1;
      if (!p1) { clear(); return; }

      vivant = { layer: layer, bulleVue: false, fin: Date.now() + sp.ms };
      SCENES[sp.variant](layer, sp, p1, p2);
      // La bulle est consideree vue passe la moitie de la scene, ce qui decide
      // si un passage interrompu consomme son creneau de deux heures.
      setTimeout(() => { if (vivant) vivant.bulleVue = true; }, Math.round(sp.ms * 0.5));
      await sleep(sp.ms + 80);
      clear();
    }

    // Interruptions de la planche 13. Chaque motif a sa sortie propre.
    function stop(raison) {
      if (!vivant) return;
      if (raison === "call") { clear(); return; }            // retrait immediat, sans transition
      if (raison === "reminder") {                             // sortie rapide de 200 ms
        const l = vivant.layer;
        l.setAttribute("style", "transition:opacity " + G.fadeOut + "ms " + EASE + ";opacity:0");
        setTimeout(clear, G.fadeOut + 20);
        return;
      }
      clear();                                                 // popup, changement de page
    }

    // Onglet masque, l'animation se gele et reprend au retour.
    document.addEventListener("visibilitychange", () => {
      if (!vivant) return;
      const etat = document.hidden ? "paused" : "running";
      const tous = vivant.layer.querySelectorAll("*");
      Array.prototype.forEach.call(tous, (n) => { if (n.style) n.style.animationPlayState = etat; });
    });
    window.addEventListener("pagehide", () => stop("page"));

    api.runtime.onMessage.addListener((msg) => {
      if (!msg) return;
      if (msg.type === "kz-passage") {
        ANIM_MODE = msg.animMode || ANIM_MODE;
        play(msg);
      } else if (msg.type === "kz-show") {
        stop("reminder");     // un rappel qui tombe interrompt le passage
      } else if (msg.type === "kz-passage-stop") {
        stop(msg.reason || "popup");
      }
    });

    /* ---------------- coucou de visioconference ---------------- */
    // Au tout debut d'une visioconference, le chat traverse une fois pour dire
    // bonjour, deux secondes apres l'arrivee sur la page. Independant de
    // l'ordonnanceur des animaux de passage gere par background.js, celui-ci
    // se declenche seul, a la simple lecture de la page, sur la meme liste de
    // domaines que le silence des rappels pendant un appel, planche 15,
    // decision 5, jamais une detection materielle de camera ou de micro.
    function hostDeVisio(patterns) {
      let host = "";
      try { host = String(location.hostname || "").toLowerCase(); } catch (e) { return false; }
      if (!host || !Array.isArray(patterns)) return false;
      return patterns.some((brut) => {
        const base = String(brut).trim().toLowerCase().replace(/^\*\./, "").replace(/\/.*$/, "");
        return !!base && (host === base || host.endsWith("." + base));
      });
    }

    async function coucouVisio() {
      try {
        const r = await api.storage.local.get(["passages", "mutedPatterns", "pausedUntil", "animMode"]);
        // Meme interdit prioritaire que le reste, le reglage eteint ou une
        // pause en cours annulent le coucou avant toute autre verification.
        if (r.passages === false) return;
        if (r.pausedUntil && Date.now() < r.pausedUntil) return;
        if (!hostDeVisio(r.mutedPatterns)) return;
        ANIM_MODE = r.animMode || ANIM_MODE;
        await sleep(G.meetingDelay);
        // Le nombre de phrases n'est pas fige, KZ_MEETING peut grandir. Un
        // reste fixe a 10 laisserait les phrases suivantes hors de portee, le
        // modulo de play() ne les atteindrait jamais.
        const nPhrases = (typeof KZ_MEETING !== "undefined" && Array.isArray(KZ_MEETING) && KZ_MEETING.length) ? KZ_MEETING.length : 10;
        play({
          variant: "cross",
          ms: 15000,
          coat: Math.floor(Math.random() * COATS.length),
          phrase: Math.floor(Math.random() * nPhrases),
          animMode: r.animMode,
          pool: "meeting"
        });
      } catch (e) { /* noop */ }
    }
    coucouVisio();

    globalThis.KZ_PASSAGES = { play: play, stop: stop, SCENES: SCENES, G: G, COATS: COATS, FOX_SVG: FOX_SVG, hostDeVisio: hostDeVisio, coucouVisio: coucouVisio };
  })();
}
