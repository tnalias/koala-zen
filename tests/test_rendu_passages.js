// Rendu des animaux de passage, module L. passages.js est charge TEL QUEL sous
// jsdom avec une API d'extension simulee. On verifie le DOM produit, la
// geometrie, les interruptions et l'absence totale de trace dans les donnees.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = process.argv[2] || "build/koala-zen";
let ok = 0, ko = 0;
const echecs = [];
function verifie(nom, cond, detail) {
  if (cond) ok++;
  else { ko++; echecs.push(nom + (detail ? "  ->  " + detail : "")); }
}

const SRC = fs.readFileSync(path.join(RACINE, "passages.js"), "utf8");

// opts.url et opts.storageGet servent au coucou de visioconference, qui lit sa
// propre page et son propre stockage independamment du reste du fichier.
function charge(largeur, animMode, opts) {
  opts = opts || {};
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    pretendToBeVisual: true, runScripts: "outside-only", url: opts.url || "https://example.com/"
  });
  const w = dom.window;
  Object.defineProperty(w, "innerWidth", { value: largeur === undefined ? 1400 : largeur, writable: true });
  w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  const journal = { ecrits: [], envoyes: [] };
  const ecouteurs = [];
  w.chrome = {
    runtime: { onMessage: { addListener: (f) => ecouteurs.push(f) }, sendMessage: (m) => journal.envoyes.push(m) },
    storage: { local: {
      get: opts.storageGet || (async () => ({})),
      set: async (o) => journal.ecrits.push(o)
    } }
  };
  // On declare EXACTEMENT comme quotes.js le fait, par const de haut niveau, et
  // non comme une propriete de window. Sinon le test valide un chemin de lecture
  // que le produit n'emprunte jamais.
  const PHRASES = [
    "Coucou, j-espere que tu passes une belle journee",
    "Petit passage, pour rien",
    "Je passais juste par la, rien a signaler",
    "Il fait beau quelque part, forcement",
    "Tu as l-air occupe, je ne dis rien de plus",
    "Bonne fin de journee, sincerement",
    "Je vais faire un somme, tu devrais essayer",
    "Rien a te demander, juste te dire bonjour"
  ];
  // Lot distinct du coucou de visioconference, jamais confondu avec PHRASES
  // ci-dessus, pour pouvoir prouver lequel des deux lots s'est affiche.
  const REUNION = opts.meetingPhrases || [
    "Bonne reu, phrase de test un",
    "Bonne reu, phrase de test deux",
    "Bonne reu, phrase de test trois"
  ];
  // Deux appels a eval separes NE PARTAGENT PAS leur portee, alors que deux
  // scripts de contenu declares au manifeste tournent dans le meme monde isole et
  // partagent leur portee globale lexicale. C'est precisement ce qui permet a
  // passages.js de lire KZ_HELLO par son nom nu. On evalue donc ensemble, pour
  // modeliser la realite au lieu de valider un chemin qui n'existe pas.
  w.eval("const KZ_HELLO = " + JSON.stringify(PHRASES) + ";\n"
    + "const KZ_MEETING = " + JSON.stringify(REUNION) + ";\n" + SRC);
  return { w, doc: w.document, journal, ecouteurs, P: w.KZ_PASSAGES };
}
const attends = (ms) => new Promise((r) => setTimeout(r, ms || 30));
function calque(doc) {
  const h = doc.getElementById("kz-passage-host");
  return h && h.shadowRoot ? h.shadowRoot.querySelector(".kz-pass-layer") : null;
}

/* ============ 1. Les cinq scenes montent quelque chose ============ */
const TABLE = [
  ["cross", 15000, "cat"], ["sit", 20000, "cat"], ["yawn", 22500, "cat"],
  ["meetCats", 14000, "both"], ["meetFox", 14000, "both"]
];
async function testScenes() {
  const env = charge();
  verifie("le chat seul ou en rencontre, cinq scenes sont declarees",
    Object.keys(env.P.SCENES).length === 5, String(Object.keys(env.P.SCENES).length));
  for (const [id, ms, who] of TABLE) {
    verifie("la scene " + id + " existe", typeof env.P.SCENES[id] === "function");
  }
  for (const [id, ms] of TABLE) {
    const e = charge();
    e.P.play({ variant: id, ms: 40, who: "cat", coat: 2, phrase: 1 });
    await attends(10);
    const l = calque(e.doc);
    verifie(id + ", le calque est monte", !!l);
    verifie(id + ", un dessin est present", !!(l && l.querySelector("svg")), id);
    verifie(id + ", une bulle est presente", !!(l && l.querySelector(".kz-pass-bubble")));
    verifie(id + ", la bulle porte du texte reel et pas une image",
      !!(l && (l.querySelector(".kz-pass-bubble").textContent || "").length > 5));
    verifie(id + ", la bulle a sa pointe", !!(l && l.querySelector(".kz-pass-tip")));
    await attends(160);
    verifie(id + ", tout est retire a la fin", !calque(e.doc), id);
  }
}

/* ============ 1b. Les deux personnages d'une rencontre ============ */
async function testRencontre() {
  for (const id of ["meetCats", "meetFox"]) {
    const e = charge();
    e.P.play({ variant: id, ms: 40, coat: 2, phrase: 1 });
    await attends(10);
    const l = calque(e.doc);
    const corps = l.querySelectorAll(".kz-pass-body");
    const bulles = l.querySelectorAll(".kz-pass-bubble");
    verifie(id + ", deux personnages sont montes", corps.length === 2, String(corps.length));
    verifie(id + ", deux bulles sont montees", bulles.length === 2, String(bulles.length));
    verifie(id + ", les deux bulles portent des phrases differentes",
      bulles[0].textContent !== bulles[1].textContent,
      JSON.stringify([bulles[0].textContent, bulles[1].textContent]));
    // Le premier personnage n'est jamais mirore, sa bulle pointe a droite.
    const svg1 = corps[0].querySelector("svg");
    verifie(id + ", le premier personnage n'est pas mirore",
      !/scaleX\(-1\)/.test(svg1.getAttribute("style") || ""));
    verifie(id + ", la bulle du premier personnage pointe a droite",
      bulles[0].querySelector(".kz-pass-tip").style.right === "26px");
    // Le second est mirore, tete a gauche, sa bulle suit ce cote.
    const svg2 = corps[1].querySelector("svg");
    verifie(id + ", le second personnage est mirore, tete a gauche",
      /scaleX\(-1\)/.test(svg2.getAttribute("style") || ""), svg2.getAttribute("style"));
    verifie(id + ", la bulle du second personnage pointe a gauche",
      bulles[1].querySelector(".kz-pass-tip").style.left === "26px");
    await attends(160);
  }

  // Le renard remplace le second chat, jamais le koala ni l'arbre.
  const eFox = charge();
  eFox.P.play({ variant: "meetFox", ms: 40, coat: 0, phrase: 0 });
  await attends(10);
  const lFox = calque(eFox.doc);
  const corpsFox = lFox.querySelectorAll(".kz-pass-body");
  verifie("le renard a la hauteur dediee, pas celle du chat",
    corpsFox[1].style.height === "127px", corpsFox[1].style.height);
  verifie("le renard porte sa propre couleur de robe, jamais celle des pelages de chat",
    /#E4923F/.test(corpsFox[1].querySelector("svg").outerHTML));
  await attends(160);

  // Deux chats, jamais le renard : les deux corps utilisent les pelages, pas
  // la couleur propre au renard.
  const eCats = charge();
  eCats.P.play({ variant: "meetCats", ms: 40, coat: 0, phrase: 0 });
  await attends(10);
  const lCats = calque(eCats.doc);
  const corpsCats = lCats.querySelectorAll(".kz-pass-body");
  verifie("deux chats, ni l'un ni l'autre n'est le renard",
    corpsCats[0].querySelector("svg").outerHTML.indexOf("#E4923F") === -1
      && corpsCats[1].querySelector("svg").outerHTML.indexOf("#E4923F") === -1);
  await attends(160);
}

/* ============ 2. Le calque est inerte et invisible aux lecteurs ============ */
async function testCalque() {
  const env = charge();
  env.P.play({ variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  const hote = env.doc.getElementById("kz-passage-host");
  verifie("l'hote est invisible aux lecteurs d'ecran", hote.getAttribute("aria-hidden") === "true");
  const st = hote.shadowRoot.querySelector("style").textContent;
  verifie("le calque est en position fixed", /\.kz-pass-layer[^}]*position: fixed/.test(st));
  verifie("le calque ne capte aucun clic", /\.kz-pass-layer[^}]*pointer-events: none/.test(st));
  verifie("le calque couvre les quatre cotes",
    /\.kz-pass-layer[^}]*left: 0[^}]*right: 0[^}]*top: 0[^}]*bottom: 0/.test(st));
  verifie("aucun element du calque n'est focusable",
    !hote.shadowRoot.querySelector("button, a, input, [tabindex]"));
  verifie("mouvement reduit du systeme, le calque disparait",
    /prefers-reduced-motion: reduce\) \{ \.kz-pass-layer \{ display: none/.test(st));
  await attends(240);
}

/* ============ 3. Geometrie de la planche 13 ============ */
async function testGeometrie() {
  const env = charge();
  const G = env.P.G;
  verifie("marge basse relative a la fenetre", G.margin === "6vh", String(G.margin));
  verifie("chat de 140 px", G.cat === 140, String(G.cat));
  verifie("renard de 127 px, meme proportion que la planche", G.fox === 127, String(G.fox));
  verifie("jamais de geometrie de koala ni d'arbre",
    !("koala" in G) && !("treeW" in G) && !("branch" in G));
  verifie("bulle de 220 px", G.bubbleMin === 220, String(G.bubbleMin));
  verifie("bulle de 240 px au dela de 40 signes", G.bubbleMax === 240 && G.longAt === 40);
  verifie("sortie rapide de 200 ms sur rappel", G.fadeOut === 200, String(G.fadeOut));
  verifie("sept pelages de chat", env.P.COATS.length === 7, String(env.P.COATS.length));

  // walkify() greffe la marche sur le y propre a chaque patte, jamais une
  // valeur figee. Trois des sept pelages ne sont pas a y=58 et restaient
  // jambes plantees, tout en traversant l'ecran, avec une valeur figee.
  for (let i = 0; i < env.P.COATS.length; i++) {
    const e = charge();
    e.P.play({ variant: "cross", ms: 40, coat: i, phrase: 0 });
    await attends(10);
    const svg = calque(e.doc).querySelector("svg");
    const pattes = svg.querySelectorAll("rect");
    const animees = [...pattes].filter((r) => /animation:/.test(r.getAttribute("style") || ""));
    verifie("pelage " + i + ", les pattes sont animees",
      pattes.length > 0 && animees.length === pattes.length,
      pattes.length + " pattes, " + animees.length + " animees");
    await attends(60);
  }

  // La piste large de 100 pour cent rend les translateX equivalents a des
  // pourcentages de fenetre, c'est ce qui protege un redimensionnement.
  const st = SRC.match(/\.kz-pass-track \{([\s\S]*?)\}\n/)[1];
  verifie("la piste fait 100 pour cent de large", /width: 100%/.test(st), st);
  verifie("la piste est ancree a une hauteur relative a la fenetre, jamais un pixel fixe",
    /bottom: \$\{G\.margin\}/.test(st) && !/bottom: \$\{G\.margin\}px/.test(st), st);

  // Bulle courte contre bulle longue.
  const e2 = charge();
  e2.P.play({ variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 1 });
  await attends(20);
  let b = calque(e2.doc).querySelector(".kz-pass-bubble");
  verifie("phrase courte, bulle a 220 px", b.style.width === "220px", b.style.width);
  // pose() ancre toujours la bulle depuis la droite du personnage, cote
  // tete, jamais l'inverse. Sa pointe doit donc etre du cote droit, cote
  // personnage, pas a gauche dans le vide.
  let pointe = b.querySelector(".kz-pass-tip");
  verifie("la pointe de la bulle est du cote du personnage, pas a gauche dans le vide",
    pointe.style.right === "26px" && !pointe.style.left, pointe.style.cssText);
  await attends(240);
  const e3 = charge();
  e3.P.play({ variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  b = calque(e3.doc).querySelector(".kz-pass-bubble");
  verifie("phrase longue, bulle a 240 px", b.style.width === "240px", b.style.width);
  await attends(240);
}

/* ============ 4. Le responsive de la planche ============ */
async function testResponsive() {
  const e1 = charge(500);
  e1.P.play({ variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  verifie("sous 600 px, aucun passage", !calque(e1.doc));

  const e2 = charge(800);
  e2.P.play({ variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  verifie("entre 600 et 900 px, le passage a lieu", !!calque(e2.doc));
  await attends(240);

  const e3 = charge(1400);
  e3.P.play({ variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  verifie("au dela de 900 px, le passage a lieu", !!calque(e3.doc));
  await attends(240);

  // Sous 900 px, un seul personnage entre : une rencontre a deux (who "both")
  // ne doit pas se jouer, meme si elle serait au dessus du seuil de 600.
  const e4 = charge(800);
  e4.P.play({ variant: "meetCats", ms: 200, who: "both", coat: 0, phrase: 0 });
  await attends(20);
  verifie("sous 900 px, une rencontre a deux ne se joue pas", !calque(e4.doc));

  const e5 = charge(900);
  e5.P.play({ variant: "meetCats", ms: 200, who: "both", coat: 0, phrase: 0 });
  await attends(20);
  verifie("a partir de 900 px, une rencontre a deux se joue", !!calque(e5.doc));
  await attends(240);
}

/* ============ 5. Les animations sur Jamais ============ */
async function testJamais() {
  const env = charge(1400);
  env.ecouteurs.forEach((f) => f({ type: "kz-passage", animMode: "never", variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 }));
  await attends(30);
  verifie("animations sur Jamais, aucun passage et rien a la place", !calque(env.doc));

  const e2 = charge(1400);
  e2.ecouteurs.forEach((f) => f({ type: "kz-passage", animMode: "always", variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 }));
  await attends(30);
  verifie("animations sur Toujours, le passage a lieu", !!calque(e2.doc));
  await attends(240);
}

/* ============ 6. Les interruptions de la planche 13 ============ */
async function testInterruptions() {
  // Un rappel qui tombe, sortie rapide de 200 ms.
  const e1 = charge();
  e1.P.play({ variant: "cross", ms: 4000, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  verifie("passage en cours avant le rappel", !!calque(e1.doc));
  e1.ecouteurs.forEach((f) => f({ type: "kz-show" }));
  await attends(20);
  const l = calque(e1.doc);
  verifie("un rappel declenche une sortie en fondu", !l || /opacity:0/.test(l.getAttribute("style") || ""));
  await attends(260);
  verifie("apres la sortie rapide, plus rien dans le DOM", !calque(e1.doc));

  // Visio detectee, retrait immediat sans transition.
  const e2 = charge();
  e2.P.play({ variant: "cross", ms: 4000, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  e2.P.stop("call");
  verifie("visio detectee, retrait immediat sans transition", !calque(e2.doc));

  // Popup ouvert, sortie normale.
  const e3 = charge();
  e3.P.play({ variant: "cross", ms: 4000, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  e3.ecouteurs.forEach((f) => f({ type: "kz-passage-stop", reason: "popup" }));
  await attends(20);
  verifie("popup ouvert, le passage se retire", !calque(e3.doc));

  // Un seul passage a la fois.
  const e4 = charge();
  e4.P.play({ variant: "cross", ms: 3000, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  e4.P.play({ variant: "yawn", ms: 3000, who: "cat", coat: 1, phrase: 2 });
  await attends(20);
  // On compte sur TOUT l'hote, pas sur le premier calque, sinon un second
  // calque monte a cote passerait inapercu.
  const racine = e4.doc.getElementById("kz-passage-host").shadowRoot;
  const nbCalques = racine.querySelectorAll(".kz-pass-layer").length;
  const nbPistes = racine.querySelectorAll(".kz-pass-track").length;
  verifie("un second passage ne monte pas un calque de plus", nbCalques === 1, String(nbCalques));
  verifie("un second passage ne superpose aucune piste", nbPistes === 1, String(nbPistes));
  e4.P.stop("call");

  // Onglet masque, l'animation se gele.
  const e5 = charge();
  e5.P.play({ variant: "cross", ms: 3000, who: "cat", coat: 0, phrase: 0 });
  await attends(20);
  Object.defineProperty(e5.doc, "hidden", { value: true, configurable: true });
  e5.doc.dispatchEvent(new e5.w.Event("visibilitychange"));
  await attends(10);
  const corps = calque(e5.doc).querySelector(".kz-pass-body");
  verifie("onglet masque, l'animation est gelee", corps.style.animationPlayState === "paused",
    corps.style.animationPlayState);
  Object.defineProperty(e5.doc, "hidden", { value: false, configurable: true });
  e5.doc.dispatchEvent(new e5.w.Event("visibilitychange"));
  await attends(10);
  verifie("retour sur l'onglet, l'animation reprend", corps.style.animationPlayState === "running",
    corps.style.animationPlayState);
  e5.P.stop("call");
}

/* ============ 7. Aucune trace dans les donnees ============ */
async function testAucuneTrace() {
  const env = charge();
  env.P.play({ variant: "yawn", ms: 200, who: "cat", coat: 3, phrase: 4 });
  await attends(250);
  verifie("un passage n'ecrit rien en stockage", env.journal.ecrits.length === 0,
    JSON.stringify(env.journal.ecrits));
  verifie("un passage n'envoie aucun message a l'arriere plan", env.journal.envoyes.length === 0,
    JSON.stringify(env.journal.envoyes));
  verifie("passages.js ne touche jamais statsDaily", SRC.indexOf("statsDaily") === -1);
  verifie("passages.js ne touche jamais screenDaily", SRC.indexOf("screenDaily") === -1);
  verifie("passages.js n'envoie jamais kz-outcome", SRC.indexOf("kz-outcome") === -1);
}

/* ============ 8. Fidelite a la planche ============ */
async function testFidelite() {
  verifie("courbe unique de la planche", SRC.indexOf('cubic-bezier(0.2, 0, 0, 1)') > -1);
  verifie("aucune courbe inventee",
    (SRC.match(/cubic-bezier\([^)]*\)/g) || []).every((c) =>
      ["cubic-bezier(0.2, 0, 0, 1)", "cubic-bezier(0.2,0,0,1)", "cubic-bezier(0.34,1.06,0.4,1)",
       "cubic-bezier(0.4,0,1,1)", "cubic-bezier(0.3,0,0.2,1)"].indexOf(c) > -1),
    JSON.stringify((SRC.match(/cubic-bezier\([^)]*\)/g) || []).filter((c) =>
      ["cubic-bezier(0.2, 0, 0, 1)", "cubic-bezier(0.2,0,0,1)", "cubic-bezier(0.34,1.06,0.4,1)",
       "cubic-bezier(0.4,0,1,1)", "cubic-bezier(0.3,0,0.2,1)"].indexOf(c) === -1)));
  verifie("ombre de bulle conforme a la planche",
    SRC.indexOf("0 8px 24px rgba(16,24,40,0.14)") > -1);
  verifie("rayon de bulle a 16", /border-radius: 16px/.test(SRC));
  verifie("texte de bulle en 16 sur 23, agrandi pour rester lisible", /font-size: 16px; line-height: 23px/.test(SRC));
  verifie("pointe de 16 px", /width: 16px; height: 16px/.test(SRC));
  verifie("le clignement est obligatoire", SRC.indexOf("kzEyeBlink") > -1);
  verifie("le clignement passe par une paupiere et jamais une opacite",
    SRC.indexOf("kzEyeBlink") > -1 && /kzEyeBlink[\s\S]{0,200}scaleY/.test(SRC));
  verifie("la marche est greffee sur les pelages", SRC.indexOf("function walkify") > -1);
  verifie("pattes alternees par kzCatLegA et kzCatLegB",
    SRC.indexOf("kzCatLegA") > -1 && SRC.indexOf("kzCatLegB") > -1);
  // Jamais .style sur un noeud SVG importe, lecon de buildWin.
  verifie("aucun acces .style sur un noeud SVG importe",
    SRC.indexOf("function anim") > -1 && /anim\(node[^)]*\)\s*\{[\s\S]{0,300}setAttribute\("style"/.test(SRC));
  // Un SVG passe par DOMParser puis importNode ne se DESSINE PAS, notamment dans
  // un Shadow DOM. Les animaux auraient donc traverse la page INVISIBLES, calque
  // monte, pistes animees, et rien a l'ecran. Meme cause que le vu de la coche.
  verifie("aucun appel a importNode ou adoptNode dans les passages",
    !/\.importNode\(|\.adoptNode\(/.test(SRC));
  // 2026-08-04, innerHTML puis Range.createContextualFragment (avertissements
  // addons-linter, corriges plutot qu'acceptes) : le SVG est reconstruit noeud
  // par noeud avec createElementNS et setAttribute, jamais d'assignation d'une
  // chaine dans le DOM. DOMParser ne fait que LIRE la chaine comme un arbre de
  // donnees, verifie cote a cote avec DOMParser+importNode (qui ne dessine
  // rien) et avec innerHTML (identique), voir PROJECT_HANDOFF.md.
  verifie("les SVG des passages sont construits par reconstruction createElementNS",
    /function svgFrom[\s\S]{0,260}rebuildNode/.test(SRC)
    && /function rebuildNode[\s\S]{0,300}createElementNS/.test(SRC));
  verifie("le SVG est lu depuis un document DOMParser jetable, jamais importe dans le document courant",
    /new DOMParser\(\)\.parseFromString\(markup, "image\/svg\+xml"\)/.test(SRC));
  verifie("la regle du setAttribute sur les SVG tient toujours",
    /setAttribute\("style"/.test(SRC));
  verifie("plus aucune assignation .innerHTML ni appel a createContextualFragment dans les passages, le linter des extensions ne doit plus rien signaler ici",
    (SRC.match(/\.innerHTML\s*=/g) || []).length === 0
    && !/\.createContextualFragment\(/.test(SRC));
}

/* ============ 9. Le coucou de visioconference ============ */
// Independant de l'ordonnanceur des animaux de passage, ce coucou se
// declenche seul a la lecture de la page, sur la meme liste de domaines que
// le silence des rappels pendant un appel, planche 15, decision 5.
async function testCoucouVisio() {
  const CFG = { passages: true, mutedPatterns: ["kmeet.infomaniak.com", "meet.google.com"], pausedUntil: 0, animMode: "always" };

  // Domaine reconnu, reglage actif, aucune pause, le coucou se joue une fois,
  // avec le lot de phrases dedie et non les phrases habituelles.
  const e1 = charge(1400, undefined, { url: "https://kmeet.infomaniak.com/salle-1", storageGet: async () => CFG });
  e1.P.G.meetingDelay = 5;
  await attends(60);
  const l1 = calque(e1.doc);
  verifie("le coucou de visio monte un calque sur un domaine reconnu", !!l1);
  const texte1 = l1 ? l1.querySelector(".kz-pass-bubble").textContent : "";
  verifie("le coucou de visio utilise le lot dedie, pas les phrases habituelles",
    /Bonne reu, phrase de test/.test(texte1), texte1);

  // Sous domaine d'un domaine reconnu, meme regle que le silence des rappels.
  const e2 = charge(1400, undefined, { url: "https://xyz.meet.google.com/abc", storageGet: async () => CFG });
  e2.P.G.meetingDelay = 5;
  await attends(60);
  verifie("un sous-domaine d'un domaine reconnu declenche aussi le coucou", !!calque(e2.doc));

  // Domaine hors liste, rien ne se joue.
  const e3 = charge(1400, undefined, { url: "https://exemple-quelconque.com/", storageGet: async () => CFG });
  e3.P.G.meetingDelay = 5;
  await attends(60);
  verifie("un domaine hors liste ne declenche rien", !calque(e3.doc));

  // Reglage animaux de passage decoche, rien ne se joue meme sur le bon domaine.
  const e4 = charge(1400, undefined, {
    url: "https://kmeet.infomaniak.com/salle-2",
    storageGet: async () => Object.assign({}, CFG, { passages: false })
  });
  e4.P.G.meetingDelay = 5;
  await attends(60);
  verifie("le reglage animaux de passage decoche annule aussi le coucou de visio", !calque(e4.doc));

  // Pause en cours, rien ne se joue non plus.
  const e5 = charge(1400, undefined, {
    url: "https://kmeet.infomaniak.com/salle-3",
    storageGet: async () => Object.assign({}, CFG, { pausedUntil: Date.now() + 60000 })
  });
  e5.P.G.meetingDelay = 5;
  await attends(60);
  verifie("une pause en cours annule le coucou de visio", !calque(e5.doc));

  // Le delai avant affichage est bien respecte, jamais immediat.
  const e6 = charge(1400, undefined, { url: "https://kmeet.infomaniak.com/salle-4", storageGet: async () => CFG });
  e6.P.G.meetingDelay = 60;
  await attends(10);
  verifie("le coucou n'apparait pas avant le delai", !calque(e6.doc));
  await attends(80);
  verifie("le coucou apparait une fois le delai ecoule", !!calque(e6.doc));

  // Le nombre de phrases n'est pas fige a dix, un lot plus long ne doit pas
  // laisser les phrases suivantes hors de portee du tirage.
  const REUNION_LONGUE = Array.from({ length: 15 }, (_, i) => "Phrase numero " + i);
  const e7 = charge(1400, undefined, {
    url: "https://kmeet.infomaniak.com/salle-5",
    storageGet: async () => CFG,
    meetingPhrases: REUNION_LONGUE
  });
  e7.P.G.meetingDelay = 5;
  e7.w.Math.random = () => 0.99; // force le plus haut index possible, chat et phrase
  await attends(60);
  const l7 = calque(e7.doc);
  const texte7 = l7 ? l7.querySelector(".kz-pass-bubble").textContent : "";
  verifie("une phrase au dela du dixieme index reste atteignable",
    texte7 === "Phrase numero 14", texte7);

  // hostDeVisio est une fonction pure, testable directement sur chaque page.
  verifie("hostDeVisio reconnait le domaine exact", e1.P.hostDeVisio(["kmeet.infomaniak.com"]));
  verifie("hostDeVisio reconnait un sous-domaine", e2.P.hostDeVisio(["meet.google.com"]));
  verifie("hostDeVisio refuse un domaine hors liste", !e3.P.hostDeVisio(["kmeet.infomaniak.com"]));
  verifie("hostDeVisio accepte l'ecriture etoilee du reglage",
    e1.P.hostDeVisio(["*.infomaniak.com"]));
}

(async () => {
  const suites = [
    ["Les cinq scenes", testScenes],
    ["Les deux personnages d'une rencontre", testRencontre],
    ["Le calque", testCalque],
    ["Geometrie de la planche", testGeometrie],
    ["Responsive", testResponsive],
    ["Animations sur Jamais", testJamais],
    ["Interruptions", testInterruptions],
    ["Aucune trace dans les donnees", testAucuneTrace],
    ["Fidelite a la planche", testFidelite],
    ["Le coucou de visioconference", testCoucouVisio]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko, avantKo = ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === avantKo ? "ok " : "KO ", nom, ok + ko - avant);
  }
  console.log("\n=== rendu des passages : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
