// Animaux de passage, rendu dans la page. Cinq scenes gratuites qui ne
// demandent rien, le chat seul, et parfois deux chats ou un chat et un
// renard qui se croisent et se saluent. Jamais le koala, jamais l'arbre.
// L'ordonnancement est fait par background.js, ce fichier ne decide de rien,
// il joue la scene qu'on lui demande et s'effface.
// Les dessins et les courbes viennent de la planche de design, reprises telles quelles.
if (globalThis.__kzPassLoaded !== true) {
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
    // Sept pelages redessines le 2026-09-18 a partir d'un gabarit commun :
    // tete ronde posee sur une poitrine qui la relie au corps, grands yeux
    // avec reflet, oreilles a l'interieur rose, joue, nez triangle, bouche
    // en w, moustaches cote museau. Regles que walkify et blinkify exigent :
    // les pattes sont les SEULS rect, la queue est le premier path et vit
    // dans un g.kz-tail (sa pointe claire bat avec elle), chaque oeil est
    // un g dont la sclere porte un jaune ou un vert de la liste de blinkify.
    // Les oreilles portent la classe kz-ear pour le tressaillement.
    const COATS = [
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"><g class="kz-tail"><path d="M26 54 C 10 52, 4 36, 14 26" stroke="#2A2E33" stroke-width="7.5" fill="none" stroke-linecap="round"></path></g><rect x="30" y="54" width="9" height="16" rx="4.5" fill="#2A2E33"></rect><rect x="64" y="54" width="9" height="16" rx="4.5" fill="#2A2E33"></rect><ellipse cx="52" cy="47" rx="30" ry="17" fill="#3B4046"></ellipse><rect x="40" y="55" width="9" height="15" rx="4.5" fill="#3B4046"></rect><rect x="74" y="55" width="9" height="15" rx="4.5" fill="#3B4046"></rect><ellipse cx="78" cy="42" rx="11" ry="10" fill="#3B4046"></ellipse><path class="kz-ear" d="M74 20 Q70 4 72 2 Q80 6 88 12 Z" fill="#2A2E33"></path><path class="kz-ear" d="M99 19 Q103 4 101 2 Q94 6 87 11 Z" fill="#2A2E33"></path><path d="M77 17 Q74 8 75 7 Q80 10 85 13 Z" fill="#8C6F73"></path><path d="M97 17 Q99 8 98 7 Q94 10 89 12 Z" fill="#8C6F73"></path><circle cx="87" cy="29" r="17" fill="#3B4046"></circle><ellipse cx="88" cy="37" rx="8" ry="5" fill="#5A6068" opacity="0.55"></ellipse><ellipse cx="101" cy="35" rx="3.6" ry="2.2" fill="#8A6A6A" opacity="0.75"></ellipse><g><ellipse cx="80" cy="29" rx="5" ry="5.4" fill="#C9DFA0"></ellipse><circle cx="80.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="79.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><g><ellipse cx="94" cy="29" rx="5" ry="5.4" fill="#C9DFA0"></ellipse><circle cx="94.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="93.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><path d="M84.6 35.2 L89.4 35.2 L87 38.4 Z" fill="#8A6A6A"></path><path d="M87 38.4 q-2.6 3.4 -5.2 0.6 M87 38.4 q2.6 3.4 5.2 0.6" stroke="#22262A" stroke-width="1.5" fill="none" stroke-linecap="round"></path><path d="M101 32 L111 29.5 M102 35.5 L112.5 35.5 M101.5 39 L111 41" stroke="#DDE3E6" stroke-width="1.4" stroke-linecap="round" opacity="0.9"></path></svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"><g class="kz-tail"><path d="M26 54 C 10 52, 4 36, 14 26" stroke="#7C868E" stroke-width="7.5" fill="none" stroke-linecap="round"></path></g><rect x="30" y="54" width="9" height="16" rx="4.5" fill="#7C868E"></rect><rect x="64" y="54" width="9" height="16" rx="4.5" fill="#7C868E"></rect><ellipse cx="52" cy="47" rx="30" ry="17" fill="#9AA5AE"></ellipse><rect x="40" y="55" width="9" height="15" rx="4.5" fill="#9AA5AE"></rect><rect x="74" y="55" width="9" height="15" rx="4.5" fill="#9AA5AE"></rect><ellipse cx="78" cy="42" rx="11" ry="10" fill="#9AA5AE"></ellipse><path class="kz-ear" d="M74 20 Q70 4 72 2 Q80 6 88 12 Z" fill="#7C868E"></path><path class="kz-ear" d="M99 19 Q103 4 101 2 Q94 6 87 11 Z" fill="#7C868E"></path><path d="M77 17 Q74 8 75 7 Q80 10 85 13 Z" fill="#F2B8B8"></path><path d="M97 17 Q99 8 98 7 Q94 10 89 12 Z" fill="#F2B8B8"></path><circle cx="87" cy="29" r="17" fill="#9AA5AE"></circle><ellipse cx="88" cy="37" rx="8" ry="5" fill="#E4E8EA" opacity="0.55"></ellipse><ellipse cx="101" cy="35" rx="3.6" ry="2.2" fill="#F2A5A5" opacity="0.75"></ellipse><g><ellipse cx="80" cy="29" rx="5" ry="5.4" fill="#F6E9B4"></ellipse><circle cx="80.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="79.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><g><ellipse cx="94" cy="29" rx="5" ry="5.4" fill="#F6E9B4"></ellipse><circle cx="94.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="93.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><path d="M84.6 35.2 L89.4 35.2 L87 38.4 Z" fill="#E08C6E"></path><path d="M87 38.4 q-2.6 3.4 -5.2 0.6 M87 38.4 q2.6 3.4 5.2 0.6" stroke="#22262A" stroke-width="1.5" fill="none" stroke-linecap="round"></path><path d="M101 32 L111 29.5 M102 35.5 L112.5 35.5 M101.5 39 L111 41" stroke="#F7EFE6" stroke-width="1.4" stroke-linecap="round" opacity="0.9"></path></svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"><g class="kz-tail"><path d="M26 54 C 10 52, 4 36, 14 26" stroke="#B0652A" stroke-width="7.5" fill="none" stroke-linecap="round"></path><path d="M17 31 C 13 28, 13 26, 14 26" stroke="#F0DCC4" stroke-width="7.5" fill="none" stroke-linecap="round"></path></g><rect x="30" y="54" width="9" height="16" rx="4.5" fill="#B0652A"></rect><rect x="64" y="54" width="9" height="16" rx="4.5" fill="#B0652A"></rect><ellipse cx="52" cy="47" rx="30" ry="17" fill="#D18B4E"></ellipse><ellipse cx="54" cy="55" rx="19" ry="9" fill="#F0DCC4"></ellipse><path d="M36 34 q3 8 -1 15 M46 31 q3 9 -1 17 M56 31 q3 9 -1 17 M66 34 q3 7 0 13" stroke="#B0652A" stroke-width="3.2" fill="none" stroke-linecap="round" opacity="0.7"></path><rect x="40" y="55" width="9" height="15" rx="4.5" fill="#D18B4E"></rect><rect x="74" y="55" width="9" height="15" rx="4.5" fill="#D18B4E"></rect><ellipse cx="78" cy="42" rx="11" ry="10" fill="#D18B4E"></ellipse><path class="kz-ear" d="M74 20 Q70 4 72 2 Q80 6 88 12 Z" fill="#B0652A"></path><path class="kz-ear" d="M99 19 Q103 4 101 2 Q94 6 87 11 Z" fill="#B0652A"></path><path d="M77 17 Q74 8 75 7 Q80 10 85 13 Z" fill="#F2B8B8"></path><path d="M97 17 Q99 8 98 7 Q94 10 89 12 Z" fill="#F2B8B8"></path><circle cx="87" cy="29" r="17" fill="#D18B4E"></circle><path d="M81 14 q1 6 -1 9 M87 12 q0 6 0 10 M93 14 q-1 6 1 9" stroke="#B0652A" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0.7"></path><ellipse cx="88" cy="37" rx="8" ry="5" fill="#F0DCC4" opacity="0.55"></ellipse><ellipse cx="101" cy="35" rx="3.6" ry="2.2" fill="#F2A5A5" opacity="0.75"></ellipse><g><ellipse cx="80" cy="29" rx="5" ry="5.4" fill="#F0DE9C"></ellipse><circle cx="80.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="79.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><g><ellipse cx="94" cy="29" rx="5" ry="5.4" fill="#F0DE9C"></ellipse><circle cx="94.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="93.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><path d="M84.6 35.2 L89.4 35.2 L87 38.4 Z" fill="#C96C6C"></path><path d="M87 38.4 q-2.6 3.4 -5.2 0.6 M87 38.4 q2.6 3.4 5.2 0.6" stroke="#22262A" stroke-width="1.5" fill="none" stroke-linecap="round"></path><path d="M101 32 L111 29.5 M102 35.5 L112.5 35.5 M101.5 39 L111 41" stroke="#F7EFE6" stroke-width="1.4" stroke-linecap="round" opacity="0.9"></path></svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"><g class="kz-tail"><path d="M26 54 C 10 52, 4 36, 14 26" stroke="#2E3237" stroke-width="7.5" fill="none" stroke-linecap="round"></path></g><rect x="30" y="54" width="9" height="16" rx="4.5" fill="#2E3237"></rect><rect x="64" y="54" width="9" height="16" rx="4.5" fill="#2E3237"></rect><ellipse cx="52" cy="47" rx="30" ry="17" fill="#3F444A"></ellipse><ellipse cx="54" cy="55" rx="19" ry="9" fill="#F2F0EE"></ellipse><rect x="40" y="55" width="9" height="15" rx="4.5" fill="#3F444A"></rect><rect x="74" y="55" width="9" height="15" rx="4.5" fill="#3F444A"></rect><ellipse cx="78" cy="42" rx="11" ry="10" fill="#3F444A"></ellipse><ellipse cx="77" cy="46" rx="6" ry="7" fill="#F2F0EE"></ellipse><path class="kz-ear" d="M74 20 Q70 4 72 2 Q80 6 88 12 Z" fill="#2E3237"></path><path class="kz-ear" d="M99 19 Q103 4 101 2 Q94 6 87 11 Z" fill="#2E3237"></path><path d="M77 17 Q74 8 75 7 Q80 10 85 13 Z" fill="#8C6F73"></path><path d="M97 17 Q99 8 98 7 Q94 10 89 12 Z" fill="#8C6F73"></path><circle cx="87" cy="29" r="17" fill="#3F444A"></circle><ellipse cx="88" cy="38" rx="7.5" ry="5" fill="#F2F0EE"></ellipse><ellipse cx="101" cy="35" rx="3.6" ry="2.2" fill="#F2A5A5" opacity="0.75"></ellipse><g><ellipse cx="80" cy="29" rx="5" ry="5.4" fill="#F0DE9C"></ellipse><circle cx="80.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="79.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><g><ellipse cx="94" cy="29" rx="5" ry="5.4" fill="#F0DE9C"></ellipse><circle cx="94.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="93.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><path d="M84.6 35.2 L89.4 35.2 L87 38.4 Z" fill="#D6A2A2"></path><path d="M87 38.4 q-2.6 3.4 -5.2 0.6 M87 38.4 q2.6 3.4 5.2 0.6" stroke="#22262A" stroke-width="1.5" fill="none" stroke-linecap="round"></path><path d="M101 32 L111 29.5 M102 35.5 L112.5 35.5 M101.5 39 L111 41" stroke="#F2F0EE" stroke-width="1.4" stroke-linecap="round" opacity="0.9"></path></svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"><g class="kz-tail"><path d="M26 54 C 10 52, 4 36, 14 26" stroke="#C4AC8C" stroke-width="7.5" fill="none" stroke-linecap="round"></path></g><rect x="30" y="54" width="9" height="16" rx="4.5" fill="#C4AC8C"></rect><rect x="64" y="54" width="9" height="16" rx="4.5" fill="#C4AC8C"></rect><ellipse cx="52" cy="47" rx="30" ry="17" fill="#DCC6A8"></ellipse><rect x="40" y="55" width="9" height="15" rx="4.5" fill="#DCC6A8"></rect><rect x="74" y="55" width="9" height="15" rx="4.5" fill="#DCC6A8"></rect><ellipse cx="78" cy="42" rx="11" ry="10" fill="#DCC6A8"></ellipse><path class="kz-ear" d="M74 20 Q70 4 72 2 Q80 6 88 12 Z" fill="#C4AC8C"></path><path class="kz-ear" d="M99 19 Q103 4 101 2 Q94 6 87 11 Z" fill="#C4AC8C"></path><path d="M77 17 Q74 8 75 7 Q80 10 85 13 Z" fill="#F2B8B8"></path><path d="M97 17 Q99 8 98 7 Q94 10 89 12 Z" fill="#F2B8B8"></path><circle cx="87" cy="29" r="17" fill="#DCC6A8"></circle><ellipse cx="88" cy="37" rx="8" ry="5" fill="#F5EBDD" opacity="0.55"></ellipse><ellipse cx="101" cy="35" rx="3.6" ry="2.2" fill="#F2A5A5" opacity="0.75"></ellipse><g><ellipse cx="80" cy="29" rx="5" ry="5.4" fill="#BFD79A"></ellipse><circle cx="80.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="79.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><g><ellipse cx="94" cy="29" rx="5" ry="5.4" fill="#BFD79A"></ellipse><circle cx="94.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="93.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><path d="M84.6 35.2 L89.4 35.2 L87 38.4 Z" fill="#D98A8A"></path><path d="M87 38.4 q-2.6 3.4 -5.2 0.6 M87 38.4 q2.6 3.4 5.2 0.6" stroke="#22262A" stroke-width="1.5" fill="none" stroke-linecap="round"></path><path d="M101 32 L111 29.5 M102 35.5 L112.5 35.5 M101.5 39 L111 41" stroke="#F7EFE6" stroke-width="1.4" stroke-linecap="round" opacity="0.9"></path><path d="M73 47 Q80 52 90 46" stroke="#C96C6C" stroke-width="3.2" fill="none" stroke-linecap="round"></path><circle cx="82" cy="50.5" r="2.3" fill="#F2C94C"></circle></svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"><g class="kz-tail"><path d="M26 54 C 10 52, 4 36, 14 26" stroke="#6F5540" stroke-width="7.5" fill="none" stroke-linecap="round"></path><path d="M17 31 C 13 28, 13 26, 14 26" stroke="#C9AE92" stroke-width="7.5" fill="none" stroke-linecap="round"></path></g><rect x="30" y="54" width="9" height="16" rx="4.5" fill="#6F5540"></rect><rect x="64" y="54" width="9" height="16" rx="4.5" fill="#6F5540"></rect><ellipse cx="52" cy="47" rx="30" ry="17" fill="#8A6B4F"></ellipse><ellipse cx="40" cy="42" rx="7" ry="5" fill="#6F5540"></ellipse><ellipse cx="58" cy="38" rx="5" ry="4" fill="#6F5540"></ellipse><ellipse cx="66" cy="52" rx="5" ry="3.5" fill="#6F5540"></ellipse><rect x="40" y="55" width="9" height="15" rx="4.5" fill="#8A6B4F"></rect><rect x="74" y="55" width="9" height="15" rx="4.5" fill="#8A6B4F"></rect><ellipse cx="78" cy="42" rx="11" ry="10" fill="#8A6B4F"></ellipse><path class="kz-ear" d="M74 20 Q70 4 72 2 Q80 6 88 12 Z" fill="#6F5540"></path><path class="kz-ear" d="M99 19 Q103 4 101 2 Q94 6 87 11 Z" fill="#6F5540"></path><path d="M77 17 Q74 8 75 7 Q80 10 85 13 Z" fill="#F2B8B8"></path><path d="M97 17 Q99 8 98 7 Q94 10 89 12 Z" fill="#F2B8B8"></path><circle cx="87" cy="29" r="17" fill="#8A6B4F"></circle><ellipse cx="88" cy="37" rx="8" ry="5" fill="#C9AE92" opacity="0.55"></ellipse><ellipse cx="101" cy="35" rx="3.6" ry="2.2" fill="#F2A5A5" opacity="0.75"></ellipse><g><ellipse cx="80" cy="29" rx="5" ry="5.4" fill="#F0DE9C"></ellipse><circle cx="80.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="79.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><g><ellipse cx="94" cy="29" rx="5" ry="5.4" fill="#F0DE9C"></ellipse><circle cx="94.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="93.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><path d="M84.6 35.2 L89.4 35.2 L87 38.4 Z" fill="#C97F6C"></path><path d="M87 38.4 q-2.6 3.4 -5.2 0.6 M87 38.4 q2.6 3.4 5.2 0.6" stroke="#22262A" stroke-width="1.5" fill="none" stroke-linecap="round"></path><path d="M101 32 L111 29.5 M102 35.5 L112.5 35.5 M101.5 39 L111 41" stroke="#F7EFE6" stroke-width="1.4" stroke-linecap="round" opacity="0.9"></path></svg>`,
      `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"><g class="kz-tail"><path d="M26 54 C 10 52, 4 36, 14 26" stroke="#6E7880" stroke-width="7.5" fill="none" stroke-linecap="round"></path><path d="M17 31 C 13 28, 13 26, 14 26" stroke="#E4E8EA" stroke-width="7.5" fill="none" stroke-linecap="round"></path></g><rect x="30" y="54" width="9" height="16" rx="4.5" fill="#6E7880"></rect><rect x="64" y="54" width="9" height="16" rx="4.5" fill="#6E7880"></rect><ellipse cx="52" cy="47" rx="30" ry="17" fill="#A9B2B9"></ellipse><path d="M36 34 q3 8 -1 15 M46 31 q3 9 -1 17 M56 31 q3 9 -1 17 M66 34 q3 7 0 13" stroke="#6E7880" stroke-width="3.2" fill="none" stroke-linecap="round" opacity="0.7"></path><rect x="40" y="55" width="9" height="15" rx="4.5" fill="#A9B2B9"></rect><rect x="74" y="55" width="9" height="15" rx="4.5" fill="#A9B2B9"></rect><ellipse cx="78" cy="42" rx="11" ry="10" fill="#A9B2B9"></ellipse><path class="kz-ear" d="M74 20 Q70 4 72 2 Q80 6 88 12 Z" fill="#6E7880"></path><path class="kz-ear" d="M99 19 Q103 4 101 2 Q94 6 87 11 Z" fill="#6E7880"></path><path d="M77 17 Q74 8 75 7 Q80 10 85 13 Z" fill="#F2B8B8"></path><path d="M97 17 Q99 8 98 7 Q94 10 89 12 Z" fill="#F2B8B8"></path><circle cx="87" cy="29" r="17" fill="#A9B2B9"></circle><path d="M81 14 q1 6 -1 9 M87 12 q0 6 0 10 M93 14 q-1 6 1 9" stroke="#6E7880" stroke-width="2.6" fill="none" stroke-linecap="round" opacity="0.7"></path><ellipse cx="88" cy="37" rx="8" ry="5" fill="#E4E8EA" opacity="0.55"></ellipse><ellipse cx="101" cy="35" rx="3.6" ry="2.2" fill="#F2A5A5" opacity="0.75"></ellipse><g><ellipse cx="80" cy="29" rx="5" ry="5.4" fill="#F6E9B4"></ellipse><circle cx="80.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="79.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><g><ellipse cx="94" cy="29" rx="5" ry="5.4" fill="#F6E9B4"></ellipse><circle cx="94.8" cy="29.6" r="2.7" fill="#22262A"></circle><circle cx="93.2" cy="27.6" r="1.2" fill="#FFFFFF"></circle></g><path d="M84.6 35.2 L89.4 35.2 L87 38.4 Z" fill="#E08C6E"></path><path d="M87 38.4 q-2.6 3.4 -5.2 0.6 M87 38.4 q2.6 3.4 5.2 0.6" stroke="#22262A" stroke-width="1.5" fill="none" stroke-linecap="round"></path><path d="M101 32 L111 29.5 M102 35.5 L112.5 35.5 M101.5 39 L111 41" stroke="#F7EFE6" stroke-width="1.4" stroke-linecap="round" opacity="0.9"></path></svg>`
    ];
    // Le renard de la rencontre, meme gabarit que les chats, museau allonge,
    // masque creme, chaussettes sombres, queue touffue a pointe blanche.
    // Dessine tete a droite comme les chats, mirore par CSS au montage,
    // jamais retourne ici.
    const FOX_SVG = `<svg viewBox="0 0 116 80" aria-hidden="true" style="display:block"><g class="kz-tail"><path d="M26 52 C 8 54, 0 36, 12 22" stroke="#C96C24" stroke-width="11" fill="none" stroke-linecap="round"></path><path d="M14 30 C 10 26, 10 24, 12 22" stroke="#F7EFE6" stroke-width="11" fill="none" stroke-linecap="round"></path></g><rect x="30" y="54" width="8" height="16" rx="4" fill="#3A3F43"></rect><rect x="64" y="54" width="8" height="16" rx="4" fill="#3A3F43"></rect><ellipse cx="52" cy="46" rx="30" ry="16" fill="#E4923F"></ellipse><ellipse cx="55" cy="54" rx="19" ry="8" fill="#F7EFE6"></ellipse><rect x="40" y="55" width="8" height="15" rx="4" fill="#3A3F43"></rect><rect x="74" y="55" width="8" height="15" rx="4" fill="#3A3F43"></rect><ellipse cx="78" cy="42" rx="11" ry="10" fill="#E4923F"></ellipse><path class="kz-ear" d="M73 22 Q68 4 71 1 Q80 6 88 13 Z" fill="#E4923F"></path><path class="kz-ear" d="M100 21 Q105 4 102 1 Q94 6 86 12 Z" fill="#E4923F"></path><path d="M71.5 4 Q69 3 71 1 Q75 3 78 6 Z" fill="#3A3F43"></path><path d="M101.5 4 Q104 3 102 1 Q98 3 95 6 Z" fill="#3A3F43"></path><path d="M76 18 Q73 9 74 8 Q79 11 84 14 Z" fill="#F7EFE6" opacity="0.8"></path><path d="M98 18 Q100 9 99 8 Q95 11 89 13 Z" fill="#F7EFE6" opacity="0.8"></path><circle cx="87" cy="30" r="17" fill="#E4923F"></circle><path d="M78 32 Q86 27 94 32 Q102 36 103 42 Q97 48 88 47 Q78 46 74 40 Q74 34 78 32 Z" fill="#F7EFE6"></path><ellipse cx="99" cy="36" rx="3.4" ry="2" fill="#F2B48D" opacity="0.8"></ellipse><g><ellipse cx="80" cy="30" rx="4.6" ry="4.8" fill="#5C4436"></ellipse><circle cx="81.4" cy="28.4" r="1.4" fill="#FFFFFF"></circle></g><g><ellipse cx="94" cy="30" rx="4.6" ry="4.8" fill="#5C4436"></ellipse><circle cx="95.4" cy="28.4" r="1.4" fill="#FFFFFF"></circle></g><ellipse cx="101.5" cy="42" rx="2.8" ry="2.2" fill="#2B2B33"></ellipse><path d="M100.5 44 q-3 3 -6 0.6" stroke="#2B2B33" stroke-width="1.5" fill="none" stroke-linecap="round"></path><path d="M96 36 L104 32 M97 39 L106 38" stroke="#F7EFE6" stroke-width="1.4" stroke-linecap="round" opacity="0.9"></path></svg>`;
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
.kz-ear { transform-box: fill-box; transform-origin: 50% 100%; }
@keyframes kzCatWalk { 0%, 3% { transform: translateX(-120px); } 32%, 66% { transform: translateX(calc(50% + 130px)); } 97%, 100% { transform: translateX(calc(100% + 120px)); } }
@keyframes kzCatBob { 0%, 6% { transform: translateY(0); } 16% { transform: translateY(-1.5px); } 26% { transform: translateY(0); } 36% { transform: translateY(-1.5px); } 40%, 58% { transform: translateY(0); } 68% { transform: translateY(-1.5px); } 78% { transform: translateY(0); } 88% { transform: translateY(-1.5px); } 94%, 100% { transform: translateY(0); } }
@keyframes kzCatLegA { 0% { transform: rotate(0deg); } 3.4% { transform: rotate(0deg); } 6.8% { transform: rotate(-12deg); } 10.2% { transform: rotate(10.2deg); } 13.6% { transform: rotate(-12deg); } 17% { transform: rotate(10.2deg); } 20.4% { transform: rotate(-12deg); } 23.8% { transform: rotate(10.2deg); } 27.2% { transform: rotate(-12deg); } 30.6% { transform: rotate(10.2deg); } 34% { transform: rotate(-12deg); } 37.4% { transform: rotate(10.2deg); } 40.8% { transform: rotate(0deg); } 44.2% { transform: rotate(0deg); } 47.6% { transform: rotate(0deg); } 51% { transform: rotate(0deg); } 54.4% { transform: rotate(0deg); } 57.8% { transform: rotate(0deg); } 61.2% { transform: rotate(-12deg); } 64.6% { transform: rotate(10.2deg); } 68% { transform: rotate(-12deg); } 71.4% { transform: rotate(10.2deg); } 74.8% { transform: rotate(-12deg); } 78.2% { transform: rotate(10.2deg); } 81.6% { transform: rotate(-12deg); } 85% { transform: rotate(10.2deg); } 88.4% { transform: rotate(-12deg); } 91.8% { transform: rotate(10.2deg); } 95.2% { transform: rotate(0deg); } 98.6% { transform: rotate(0deg); } }
@keyframes kzCatLegB { 0% { transform: rotate(0deg); } 3.4% { transform: rotate(0deg); } 6.8% { transform: rotate(10.2deg); } 10.2% { transform: rotate(-12deg); } 13.6% { transform: rotate(10.2deg); } 17% { transform: rotate(-12deg); } 20.4% { transform: rotate(10.2deg); } 23.8% { transform: rotate(-12deg); } 27.2% { transform: rotate(10.2deg); } 30.6% { transform: rotate(-12deg); } 34% { transform: rotate(10.2deg); } 37.4% { transform: rotate(-12deg); } 40.8% { transform: rotate(0deg); } 44.2% { transform: rotate(0deg); } 47.6% { transform: rotate(0deg); } 51% { transform: rotate(0deg); } 54.4% { transform: rotate(0deg); } 57.8% { transform: rotate(0deg); } 61.2% { transform: rotate(10.2deg); } 64.6% { transform: rotate(-12deg); } 68% { transform: rotate(10.2deg); } 71.4% { transform: rotate(-12deg); } 74.8% { transform: rotate(10.2deg); } 78.2% { transform: rotate(-12deg); } 81.6% { transform: rotate(10.2deg); } 85% { transform: rotate(-12deg); } 88.4% { transform: rotate(10.2deg); } 91.8% { transform: rotate(-12deg); } 95.2% { transform: rotate(0deg); } 98.6% { transform: rotate(0deg); } }
@keyframes kzCatTail { 0%, 100% { transform: rotate(-7deg); } 50% { transform: rotate(9deg); } }
@keyframes kzCatHello { 0%, 32% { transform: translateY(6px) scale(0.94); opacity: 0; } 36%, 62% { transform: translateY(0) scale(1); opacity: 1; } 66%, 100% { transform: translateY(4px) scale(0.96); opacity: 0; } }
@keyframes kzCatWave { 0%, 41% { transform: rotate(0deg); } 45% { transform: rotate(-64deg); } 48% { transform: rotate(-44deg); } 51% { transform: rotate(-64deg); } 54% { transform: rotate(-44deg); } 57%, 100% { transform: rotate(0deg); } }
@keyframes kzMeetCat { 0%, 3% { transform: translateX(-120px); } 30%, 70% { transform: translateX(calc(50% - 95px)); } 97%, 100% { transform: translateX(-140px); } }
@keyframes kzMeetFox { 0%, 3% { transform: translateX(calc(100% + 120px)); } 30%, 70% { transform: translateX(calc(50% + 95px)); } 97%, 100% { transform: translateX(calc(100% + 140px)); } }
@keyframes kzSay1 { 0%, 33% { transform: translateY(6px) scale(0.94); opacity: 0; } 38%, 48% { transform: translateY(0) scale(1); opacity: 1; } 52%, 100% { transform: translateY(4px) scale(0.96); opacity: 0; } }
@keyframes kzSay2 { 0%, 51% { transform: translateY(6px) scale(0.94); opacity: 0; } 56%, 66% { transform: translateY(0) scale(1); opacity: 1; } 70%, 100% { transform: translateY(4px) scale(0.96); opacity: 0; } }
@keyframes kzEyeBlink { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.08); } }
@keyframes kzEarTwitch { 0%, 86%, 100% { transform: rotate(0deg); } 89% { transform: rotate(-10deg); } 92% { transform: rotate(6deg); } 95% { transform: rotate(-3deg); } }
@keyframes kzEyeBlinkSay { 0%, 36%, 42%, 56%, 62%, 100% { transform: scaleY(1); } 39%, 59% { transform: scaleY(0.08); } }
`;
    // Aucune regle CSS prefers-reduced-motion ici : elle cachait le calque quel
    // que soit le reglage Animations, donc en mode "Toujours" les passages
    // etaient invisibles tout en consommant leur creneau. Le mouvement reduit
    // du systeme est respecte par reduceMotion() ci-dessous, qui suit le
    // reglage, exactement comme content.js.

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
        // La queue vit dans un groupe avec sa pointe claire : c'est le groupe
        // qui bat, sinon la pointe restait plantee en l'air pendant que la
        // queue bougeait dessous.
        const parent = queue.parentNode;
        const cible = (parent && String(parent.nodeName).toLowerCase() === "g" && (parent.getAttribute("class") || "") === "kz-tail") ? parent : queue;
        cible.setAttribute("style", (cible.getAttribute("style") || "") + ";transform-origin:" + (tailOrigin || "26px 54px"));
        anim(cible, "kzCatTail", 1600, "ease-in-out");
        cible.style && (cible.style.animationIterationCount = "infinite");
      }
      // Les oreilles tressaillent de temps en temps, decalees l'une de l'autre.
      const oreilles = svg.querySelectorAll(".kz-ear");
      Array.prototype.forEach.call(oreilles, (o, i) => {
        anim(o, "kzEarTwitch", 7000, "ease-in-out", i * 2600);
        o.style && (o.style.animationIterationCount = "infinite");
      });
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
          // Quand l'oeil est un groupe (sclere, pupille, reflet), c'est le
          // groupe entier qui se ferme. Sinon la paupiere ne fermait que la
          // sclere et la pupille noire restait posee sur la fourrure.
          const cible = (n.parentNode && String(n.parentNode.nodeName).toLowerCase() === "g") ? n.parentNode : n;
          cible.setAttribute("class", "kz-eyes");
          anim(cible, "kzEyeBlink", 6500, "ease-in-out");
          cible.style && (cible.style.animationIterationCount = "infinite");
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

    // Racine fermee, comme content.js (2026-09-29) : la page ne l'atteint pas.
    const KZ_SHADOWS = (globalThis.__kzShadows instanceof WeakMap) ? globalThis.__kzShadows : (globalThis.__kzShadows = new WeakMap());
    // 2026-10-01, constate sur rtn.ch : le conteneur, fixe et sans
    // z-index, s'empilait au niveau 0 de la page, et le lecteur radio colle en
    // bas (z-index positif) passait devant les animaux. Le conteneur entre donc
    // dans la couche superieure du navigateur (popover manuel) : aucun z-index
    // d'un site ne peut passer devant. Le z-index maximal reste en secours
    // pour un navigateur sans popover. Rien d'autre ne change : 0 x 0 px, pas
    // de fond, pas de clic intercepte, pas de fermeture par Echap.
    function kzAuDessus(h) {
      if (!h || typeof h.showPopover !== "function") return;
      try { if (h.getAttribute("popover") !== "manual") h.setAttribute("popover", "manual"); } catch (e) { return; }
      let ouvert = false;
      try { ouvert = h.matches(":popover-open"); } catch (e) { ouvert = false; }
      if (!ouvert) { try { h.showPopover(); } catch (e) { /* le z-index maximal reste */ } }
    }
    function host() {
      let h = document.getElementById(HOST_ID);
      const connu = h ? KZ_SHADOWS.get(h) : null;
      if (connu) {
        // Meme regle que content.js : un conteneur d'une version precedente
        // garde une feuille perimee, on la remplace si elle differe.
        const st = connu.querySelector("style");
        if (st && st.textContent !== STYLES) st.textContent = STYLES;
        kzAuDessus(h);
        return connu;
      }
      if (h) h.remove();
      h = document.createElement("div");
      h.id = HOST_ID;
      h.setAttribute("aria-hidden", "true");
      h.setAttribute("style", "all:initial;position:fixed;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147483647;");
      const sh = h.attachShadow({ mode: "closed" });
      KZ_SHADOWS.set(h, sh);
      const st = document.createElement("style");
      st.textContent = STYLES;
      sh.appendChild(st);
      // Comme les bulles de content.js : un clic sur un animal ne remonte
      // jamais a la page, qui pourrait y voir un clic « a cote » de sa fenetre.
      ["pointerdown", "pointerup", "mousedown", "mouseup", "click", "dblclick", "auxclick", "contextmenu", "touchstart", "touchend"].forEach((t) => { h.addEventListener(t, (e) => { e.stopPropagation(); }); });
      (document.body || document.documentElement).appendChild(h);
      kzAuDessus(h);
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
        if (cR) cR.setAttribute("style", "transform:scaleX(-1)");
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
        if (cR) cR.setAttribute("style", "transform:scaleX(-1)");
        walkify(cR, sp.ms, "26px 52px"); blinkify(cR);
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
      // sp.pool "evening" designe les passages de fin de journee, 17 h a 21 h :
      // KZ_EVENING est une liste de cinq lots, sp.slot choisit l'heure.
      let phrases;
      if (sp.pool === "meeting") {
        phrases = (typeof KZ_MEETING !== "undefined" && Array.isArray(KZ_MEETING)) ? KZ_MEETING : [];
      } else if (sp.pool === "evening") {
        const lots = (typeof KZ_EVENING !== "undefined" && Array.isArray(KZ_EVENING)) ? KZ_EVENING : [];
        phrases = Array.isArray(lots[sp.slot]) ? lots[sp.slot] : [];
      } else if (sp.pool === "weekend") {
        // Samedi et dimanche : le chat s'etonne qu'on travaille, et salue l'originalite.
        phrases = (typeof KZ_WEEKEND !== "undefined" && Array.isArray(KZ_WEEKEND)) ? KZ_WEEKEND : [];
      } else {
        phrases = (typeof KZ_HELLO !== "undefined" && Array.isArray(KZ_HELLO)) ? KZ_HELLO : [];
      }
      const p1 = phrases[sp.phrase % Math.max(1, phrases.length)] || "";
      const p2 = phrases[(sp.phrase + 3) % Math.max(1, phrases.length)] || p1;
      if (!p1) { clear(); return; }

      // Le passage en cours porte sa propre fin. pauseDepuis note l'instant ou
      // l'onglet a ete masque : au retour, la fin recule d'autant, sinon les
      // animations CSS reprenaient la ou elles s'etaient figees pendant que
      // l'horloge de clear() avait continue, et le chat disparaissait au
      // milieu de l'ecran.
      const mien = { layer: layer, bulleVue: false, fin: Date.now() + sp.ms, pauseDepuis: 0 };
      vivant = mien;
      try {
        SCENES[sp.variant](layer, sp, p1, p2);
      } catch (e) {
        // Une scene qui echoue ne doit jamais laisser vivant a vrai, sinon plus
        // aucun passage ne jouerait sur cette page.
        if (vivant === mien) clear();
        return;
      }
      // La bulle est consideree vue passe la moitie de la scene, ce qui decide
      // si un passage interrompu consomme son creneau de deux heures.
      setTimeout(() => { if (vivant === mien) mien.bulleVue = true; }, Math.round(sp.ms * 0.5));
      // Attente par pas courts plutot qu'un seul sleep : la fin peut reculer, et
      // un stop() survenu entre-temps remplace ou vide vivant. Dans ce cas ce
      // tour ne touche plus a rien, il n'efface jamais le passage suivant.
      while (vivant === mien && (mien.pauseDepuis || Date.now() < mien.fin + 80)) {
        await sleep(Math.max(20, Math.min(250, mien.fin + 80 - Date.now())));
      }
      if (vivant === mien) clear();
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

    // Onglet masque, l'animation se gele et reprend au retour, et la fin du
    // passage recule du temps passe masque, voir play().
    document.addEventListener("visibilitychange", () => {
      if (!vivant) return;
      const etat = document.hidden ? "paused" : "running";
      const tous = vivant.layer.querySelectorAll("*");
      Array.prototype.forEach.call(tous, (n) => { if (n.style) n.style.animationPlayState = etat; });
      if (document.hidden) {
        if (!vivant.pauseDepuis) vivant.pauseDepuis = Date.now();
      } else if (vivant.pauseDepuis) {
        vivant.fin += Date.now() - vivant.pauseDepuis;
        vivant.pauseDepuis = 0;
      }
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
        // Le coucou dit "avant que ca commence". Injecte tardivement dans une
        // page de visio ouverte depuis longtemps (bouton du popup, rappel de
        // rendez-vous de l'agenda), il tomberait en plein appel : au-dela de
        // quinze secondes apres le chargement de la page, il ne joue pas.
        try { if (typeof performance !== "undefined" && performance.now && performance.now() > 15000) return; } catch (e) { /* noop */ }
        const r = await api.storage.local.get(["passages", "passagesMeeting", "mutedPatterns", "pausedUntil", "animMode"]);
        // Meme interdit prioritaire que le reste, le reglage eteint (general ou
        // celui du coucou) ou une pause en cours annulent le coucou avant toute
        // autre verification.
        if (r.passages === false || r.passagesMeeting === false) return;
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
