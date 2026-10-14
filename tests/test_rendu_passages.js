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
let OUVRIR_RACINES = true;
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
  // opts.avant(w) permet de regler la fenetre AVANT le chargement des scripts,
  // par exemple l'horloge de la page pour le coucou de visioconference.
  // Cinq lots du soir, distincts des deux autres, pour prouver quel lot et
  // quelle heure se sont affiches.
  const SOIR = [17, 18, 19, 20, 21].map((h) => ["Soir " + h + " h, phrase un", "Soir " + h + " h, phrase deux", "Soir " + h + " h, phrase trois", "Soir " + h + " h, phrase quatre"]);
  // 2026-09-29 : le produit ferme ses racines (mode "closed"). Les tests ont
  // besoin d'y regarder : ils les ouvrent ici, sauf quand un test verifie
  // justement qu'elles sont fermees (OUVRIR_RACINES a faux). jsdom ne sait
  // pas produire de clic de confiance : __kzEssaiJsdom le remplace.
  if (OUVRIR_RACINES) {
    const attache = w.Element.prototype.attachShadow;
    w.Element.prototype.attachShadow = function (o) { return attache.call(this, Object.assign({}, o, { mode: "open" })); };
  }
  w.__kzEssaiJsdom = true;
  if (typeof opts.avant === "function") opts.avant(w);
  w.eval("const KZ_HELLO = " + JSON.stringify(PHRASES) + ";\n"
    + "const KZ_MEETING = " + JSON.stringify(REUNION) + ";\n"
    + (opts.sansSoir ? "" : "const KZ_EVENING = " + JSON.stringify(SOIR) + ";\n")
    + "const KZ_WEEKEND = " + JSON.stringify(["Week-end, phrase un", "Week-end, phrase deux", "Week-end, phrase trois"]) + ";\n" + SRC);
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
    e.P.play({ variant: id, ms: 160, who: "cat", coat: 2, phrase: 1 });
    await attends(10);
    const l = calque(e.doc);
    verifie(id + ", le calque est monte", !!l);
    verifie(id + ", un dessin est present", !!(l && l.querySelector("svg")), id);
    verifie(id + ", une bulle est presente", !!(l && l.querySelector(".kz-pass-bubble")));
    verifie(id + ", la bulle porte du texte reel et pas une image",
      !!(l && (l.querySelector(".kz-pass-bubble").textContent || "").length > 5));
    verifie(id + ", la bulle a sa pointe", !!(l && l.querySelector(".kz-pass-tip")));
    await attends(320);
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
  // 2026-09-16 : la regle CSS prefers-reduced-motion cachait le calque quel que
  // soit le reglage Animations. En mode "Toujours", les passages etaient donc
  // invisibles tout en consommant leur creneau. C'est reduceMotion(), qui suit
  // le reglage, qui decide, jamais une regle CSS globale.
  verifie("aucune regle CSS ne cache le calque sur mouvement reduit, c'est reduceMotion() qui decide",
    !/prefers-reduced-motion/.test(st));
  const srcP = fs.readFileSync(path.join(RACINE, "passages.js"), "utf8");
  verifie("play() s'arrete des l'entree sur mouvement reduit",
    /async function play\(sp\) \{[\s\S]{0,200}if \(reduceMotion\(\)\) return;/.test(srcP));
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

/* ============ 10. Robustesse, revue du 2026-09-16 ============ */
async function testRobustesse() {
  // Onglet masque : les animations CSS se figent, et la fin du passage recule
  // d'autant. Avant, l'horloge de clear() continuait et le chat disparaissait
  // au milieu de l'ecran au retour.
  const e1 = charge();
  e1.P.play({ variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 });
  await attends(60);
  verifie("le passage est monte", !!calque(e1.doc));
  Object.defineProperty(e1.doc, "hidden", { value: true, configurable: true });
  e1.doc.dispatchEvent(new e1.w.Event("visibilitychange"));
  await attends(400);
  verifie("onglet masque, le passage attend au lieu de disparaitre", !!calque(e1.doc));
  Object.defineProperty(e1.doc, "hidden", { value: false, configurable: true });
  e1.doc.dispatchEvent(new e1.w.Event("visibilitychange"));
  await attends(60);
  verifie("au retour, le passage est encore la pour le temps qui lui restait", !!calque(e1.doc));
  await attends(400);
  verifie("puis il se retire normalement", !calque(e1.doc));

  // Un passage interrompu par un rappel ne doit jamais effacer le suivant :
  // le tour d'attente du premier ne touche plus a rien une fois remplace.
  // stop("call") retire tout de suite, et le second passage demarre AVANT que
  // le tour d'attente du premier ne se reveille (il dort jusqu'a 250 ms).
  const e2 = charge();
  e2.P.play({ variant: "cross", ms: 400, who: "cat", coat: 0, phrase: 0 });
  await attends(40);
  e2.P.stop("call");
  verifie("le premier passage est bien retire par l'appel", !calque(e2.doc));
  await attends(20);
  e2.P.play({ variant: "sit", ms: 400, who: "cat", coat: 1, phrase: 1 });
  await attends(40);
  verifie("le second passage est monte", !!calque(e2.doc));
  await attends(260);
  verifie("le tour d'attente perime du premier n'a pas efface le second", !!calque(e2.doc));
  await attends(300);
  verifie("le second se retire a sa propre fin", !calque(e2.doc));

  // Une scene qui echoue ne bloque pas les suivantes.
  const e3 = charge();
  const sauve = e3.P.SCENES.cross;
  e3.P.SCENES.cross = () => { throw new Error("scene cassee"); };
  e3.P.play({ variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 });
  await attends(40);
  verifie("une scene qui plante ne laisse rien a l'ecran", !calque(e3.doc));
  e3.P.SCENES.cross = sauve;
  e3.P.play({ variant: "cross", ms: 200, who: "cat", coat: 0, phrase: 0 });
  await attends(40);
  verifie("et le passage suivant joue quand meme", !!calque(e3.doc));
  await attends(320);

  // Coucou de visio : injecte tardivement dans une page ouverte depuis
  // longtemps (rappel de rendez-vous, bouton du popup), il ne joue pas, sinon
  // "avant que ca commence" tombait en plein appel.
  const CFG = { passages: true, mutedPatterns: ["kmeet.infomaniak.com"], pausedUntil: 0, animMode: "always" };
  const e4 = charge(1400, undefined, { url: "https://kmeet.infomaniak.com/salle-1", storageGet: async () => CFG,
    avant: (w) => { w.performance.now = () => 20000; } });
  e4.P.G.meetingDelay = 5;
  await attends(80);
  verifie("injecte apres quinze secondes de page, le coucou de visio ne joue pas", !calque(e4.doc));
  const e5 = charge(1400, undefined, { url: "https://kmeet.infomaniak.com/salle-1", storageGet: async () => CFG,
    avant: (w) => { w.performance.now = () => 1200; } });
  e5.P.G.meetingDelay = 5;
  await attends(80);
  verifie("au chargement de la page, le coucou de visio joue", !!calque(e5.doc));

  // Le clignement ferme l'oeil entier quand il est un groupe.
  const e6 = charge();
  e6.P.play({ variant: "cross", ms: 300, who: "cat", coat: 1, phrase: 0 });
  await attends(40);
  const yeux = calque(e6.doc) ? calque(e6.doc).querySelectorAll(".kz-eyes") : [];
  verifie("les yeux groupes (sclere, pupille, reflet) clignent en bloc",
    yeux.length >= 2 && Array.prototype.every.call(yeux, (n) => n.nodeName.toLowerCase() === "g"),
    Array.prototype.map.call(yeux, (n) => n.nodeName).join(","));
  await attends(340);
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

/* ============ 11. Les dessins redessines du 2026-09-18 ============ */
// Gabarit commun aux sept pelages et au renard. Ce que walkify et blinkify
// exigent est verifie sur la chaine ET sur le DOM monte.
async function testDessins() {
  const env = charge();
  const tous = env.P.COATS.concat([env.P.FOX_SVG]);
  tous.forEach((markup, i) => {
    const nom = i < 7 ? "pelage " + i : "renard";
    verifie(nom + ", quatre pattes et rien d'autre en rect", (markup.match(/<rect/g) || []).length === 4);
    verifie(nom + ", la queue est le premier path et vit dans g.kz-tail",
      markup.indexOf('<g class="kz-tail"><path') > -1 && markup.indexOf("<path") === markup.indexOf('<g class="kz-tail"><path') + '<g class="kz-tail">'.length);
    verifie(nom + ", deux yeux en groupe, sclere d'une couleur que blinkify connait",
      (markup.match(/<g><ellipse[^>]*fill="#(F6E9B4|F0DE9C|C9DFA0|BFD79A|5C4436)"/g) || []).length === 2);
    verifie(nom + ", un reflet blanc dans chaque oeil", (markup.match(/fill="#FFFFFF"/g) || []).length >= 2);
    verifie(nom + ", deux oreilles kz-ear", (markup.match(/class="kz-ear"/g) || []).length === 2);
    verifie(nom + ", des moustaches cote museau", /stroke-linecap="round" opacity="0.9"/.test(markup));
    verifie(nom + ", une tete ronde", /<circle cx="87" cy="(29|30)" r="17"/.test(markup));
    verifie(nom + ", un nez", i < 7 ? /L87 38.4 Z" fill=/.test(markup) : /fill="#2B2B33"/.test(markup));
  });
  verifie("le renard a une queue touffue a pointe creme",
    /kz-tail"><path[^>]*stroke="#C96C24" stroke-width="11"[^>]*><\/path><path[^>]*stroke="#F7EFE6"/.test(env.P.FOX_SVG));
  verifie("sept pelages tous differents", new Set(env.P.COATS).size === 7);
  verifie("un tigre roux, un tigre gris, un smoking, un collier",
    env.P.COATS.filter((c) => /opacity="0.7"><\/path><path class="kz-ear"/.test(c) || /stroke-width="3.2" fill="none" stroke-linecap="round" opacity="0.7"/.test(c)).length === 2
    && env.P.COATS.some((c) => /#F2C94C/.test(c)));

  for (let i = 0; i < 7; i++) {
    const e = charge();
    e.P.play({ variant: "cross", ms: 160, coat: i, phrase: 0 });
    await attends(10);
    const svg = calque(e.doc).querySelector("svg");
    const queue = svg.querySelector("g.kz-tail");
    verifie("pelage " + i + ", c'est le groupe de la queue qui bat", !!queue && /kzCatTail/.test(queue.getAttribute("style") || ""));
    verifie("pelage " + i + ", la pointe ne bat pas a part de la queue",
      !!queue && ![...queue.querySelectorAll("path")].some((p) => /kzCatTail/.test(p.getAttribute("style") || "")));
    verifie("pelage " + i + ", la queue pivote a sa base", !!queue && /transform-origin:\s*26px 54px/.test(queue.getAttribute("style") || ""));
    const oreilles = svg.querySelectorAll(".kz-ear");
    verifie("pelage " + i + ", les deux oreilles tressaillent, decalees l'une de l'autre",
      oreilles.length === 2 && [...oreilles].every((o) => /kzEarTwitch 7000ms/.test(o.getAttribute("style") || ""))
      && oreilles[0].getAttribute("style") !== oreilles[1].getAttribute("style"));
    const yeux = svg.querySelectorAll(".kz-eyes");
    verifie("pelage " + i + ", deux yeux clignent par leur groupe entier",
      yeux.length === 2 && [...yeux].every((y) => y.nodeName.toLowerCase() === "g" && y.querySelectorAll("circle").length === 2));
    const pattes = svg.querySelectorAll("rect");
    verifie("pelage " + i + ", chaque patte pivote a son propre haut",
      [...pattes].every((r) => new RegExp("transform-origin:\\s*[0-9.]+px " + r.getAttribute("y") + "px").test(r.getAttribute("style") || "")));
    await attends(320);
  }

  const ef = charge();
  ef.P.play({ variant: "meetFox", ms: 160, coat: 0, phrase: 0 });
  await attends(10);
  const svgs = calque(ef.doc).querySelectorAll("svg");
  const fox = svgs[1];
  verifie("renard, le groupe de la queue bat, pivot a sa base",
    !!fox && /kzCatTail/.test(fox.querySelector("g.kz-tail").getAttribute("style")) && /26px 52px/.test(fox.querySelector("g.kz-tail").getAttribute("style")));
  verifie("renard, deux yeux bruns clignent", !!fox && fox.querySelectorAll(".kz-eyes").length === 2);
  verifie("renard, les oreilles tressaillent", !!fox && fox.querySelectorAll(".kz-ear").length === 2 && /kzEarTwitch/.test(fox.querySelectorAll(".kz-ear")[1].getAttribute("style")));
  verifie("renard, quatre pattes animees", !!fox && [...fox.querySelectorAll("rect")].every((r) => /kzCatLeg/.test(r.getAttribute("style"))));
  await attends(320);

  // 2026-09-21 : un conteneur laisse par une version precedente du script
  // garde une feuille perimee, elle doit etre remplacee au premier passage.
  const STYLES_P = (SRC.match(/const STYLES = `([\s\S]*?)`;/) || [])[1];
  const ev = charge(undefined, undefined, { avant: (w) => {
    const vieux = w.document.createElement("div");
    vieux.id = "kz-passage-host";
    const sh = vieux.attachShadow({ mode: "open" });
    const st = w.document.createElement("style");
    st.textContent = "/* version precedente */";
    sh.appendChild(st);
    w.document.body.appendChild(vieux);
  } });
  ev.P.play({ variant: "cross", ms: 160, coat: 0, phrase: 0 });
  await attends(10);
  const hoteV = ev.doc.getElementById("kz-passage-host");
  verifie("un conteneur de passages d'une version precedente est remplace, avec notre feuille",
    !!STYLES_P && ev.doc.querySelectorAll("#kz-passage-host").length === 1 && !!calque(ev.doc)
    && hoteV.shadowRoot.querySelectorAll("style").length === 1
    && hoteV.shadowRoot.querySelector("style").textContent.indexOf("version precedente") < 0
    && hoteV.shadowRoot.querySelector("style").textContent.indexOf("kzEarTwitch") >= 0);
  await attends(320);

  verifie("kzEarTwitch est declaree dans les styles", /@keyframes kzEarTwitch \{ 0%, 86%, 100% \{ transform: rotate\(0deg\); \}/.test(SRC));
  verifie(".kz-ear pivote a sa base", /\.kz-ear \{ transform-box: fill-box; transform-origin: 50% 100%; \}/.test(SRC));
  verifie("le tressaillement passe par une rotation, jamais une opacite", !/kzEarTwitch[\s\S]{0,200}opacity/.test(SRC));
}

/* ============ 12. Les rondes du soir cote page ============ */
async function testSoir() {
  const e = charge();
  e.P.play({ variant: "sit", ms: 160, coat: 1, phrase: 1, pool: "evening", slot: 2, hour: 19 });
  await attends(10);
  let b = calque(e.doc).querySelector(".kz-pass-bubble");
  verifie("le lot du soir de 19 h, deuxieme phrase, est lu", !!b && b.textContent.indexOf("Soir 19 h, phrase deux") === 0, b && b.textContent);
  verifie("la scene du soir est une scene ordinaire, memes classes", !!calque(e.doc).querySelector(".kz-pass-svg") && !!calque(e.doc).querySelector(".kz-pass-tip"));
  await attends(320);
  verifie("la ronde se retire a la fin comme les autres", !calque(e.doc));

  const e4 = charge();
  e4.P.play({ variant: "cross", ms: 160, coat: 0, phrase: 3, pool: "evening", slot: 4, hour: 21 });
  await attends(10);
  b = calque(e4.doc).querySelector(".kz-pass-bubble");
  verifie("le lot de 21 h, quatrieme phrase", !!b && b.textContent === "Soir 21 h, phrase quatre", b && b.textContent);
  await attends(320);

  const e2 = charge();
  e2.P.play({ variant: "cross", ms: 160, coat: 1, phrase: 0, pool: "evening", slot: 9 });
  await attends(10);
  verifie("un creneau inconnu ne monte rien et rend la main", !calque(e2.doc));
  e2.P.play({ variant: "cross", ms: 160, coat: 1, phrase: 0 });
  await attends(10);
  verifie("et un passage suivant repart", !!calque(e2.doc));
  await attends(320);

  const e3 = charge(undefined, undefined, { sansSoir: true });
  e3.P.play({ variant: "cross", ms: 160, coat: 1, phrase: 0, pool: "evening", slot: 0 });
  await attends(10);
  verifie("sans KZ_EVENING, rien ne casse et rien ne monte", !calque(e3.doc));

  const e5 = charge();
  e5.P.play({ variant: "cross", ms: 160, coat: 1, phrase: 1 });
  await attends(10);
  verifie("sans lot, les phrases habituelles", calque(e5.doc).querySelector(".kz-pass-bubble").textContent === "Petit passage, pour rien");
  await attends(320);

  // 2026-09-26 : le lot du week-end, meme tirage, autre texte.
  const e6 = charge();
  e6.P.play({ variant: "cross", ms: 160, coat: 1, phrase: 1, pool: "weekend" });
  await attends(10);
  verifie("le lot du week-end est lu quand le fond le demande", calque(e6.doc).querySelector(".kz-pass-bubble").textContent === "Week-end, phrase deux");
  await attends(320);

  // Les phrases livrees dans quotes.js.
  const q = fs.readFileSync(path.join(RACINE, "quotes.js"), "utf8");
  for (const L of ["FR", "EN", "DE"]) {
    const m = q.match(new RegExp("const KZ_EVENING_" + L + " = (\\[[\\s\\S]*?\\n\\]);"));
    const lots = m ? eval(m[1]) : null;
    verifie("KZ_EVENING_" + L + " a cinq lots de quatre phrases", !!lots && lots.length === 5 && lots.every((l) => l.length === 4),
      lots ? lots.map((l) => l.length).join(",") : "absent");
    verifie("KZ_EVENING_" + L + ", aucune phrase vide, aucune trop longue pour la bulle",
      !!lots && lots.every((l) => l.every((p) => typeof p === "string" && p.length > 10 && p.length <= 110)));
    verifie("KZ_EVENING_" + L + ", vingt phrases toutes differentes", !!lots && new Set(lots.flat()).size === 20);
    verifie("KZ_EVENING_" + L + ", chaque lot nomme son heure",
      !!lots && lots.every((l, i) => l.every((p) => p.indexOf(String(L === "EN" ? (i + 5) : (i + 17))) > -1)));
  }
  verifie("KZ_EVENING suit la langue de la page", /const KZ_EVENING = KZ_IS_FR \? KZ_EVENING_FR : \(KZ_IS_DE \? KZ_EVENING_DE : KZ_EVENING_EN\);/.test(q));
  verifie("pas de ß dans les phrases allemandes", !/ß/.test((q.match(/const KZ_EVENING_DE[\s\S]*?\n\];/) || [""])[0]));
}


/* ================= Au-dessus de tout, 2026-10-01 ================= */
async function testAuDessus() {
  const ouverts = [];
  const e = charge(undefined, undefined, { avant: (w) => {
    w.HTMLElement.prototype.showPopover = function () { ouverts.push(this.id); this.__ouvert = true; };
    const orig = w.Element.prototype.matches;
    w.Element.prototype.matches = function (sel) { return sel === ":popover-open" ? !!this.__ouvert : orig.call(this, sel); };
  } });
  e.P.play({ variant: "cross", ms: 160, coat: 0, phrase: 0 });
  await attends(10);
  const h = e.doc.getElementById("kz-passage-host");
  verifie("les animaux aussi passent dans la couche superieure, en popover manuel", !!h && h.getAttribute("popover") === "manual" && ouverts.indexOf("kz-passage-host") >= 0, JSON.stringify(ouverts));
  verifie("leur conteneur ne prend aucune place : 0 x 0 px, sans fond, z-index maximal en secours",
    /all:initial/.test(h.getAttribute("style")) && /width:0/.test(h.getAttribute("style")) && /z-index:2147483647/.test(h.getAttribute("style")));
  await attends(320);
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
    ["Le coucou de visioconference", testCoucouVisio],
    ["Robustesse, revue du 2026-09-16", testRobustesse],
    ["Les dessins redessines", testDessins],
    ["Les rondes du soir cote page", testSoir],
    ["Au-dessus de tout", testAuDessus]
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
