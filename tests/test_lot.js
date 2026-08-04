// Module F, ajout de citations en lot. popup.js est charge TEL QUEL sous jsdom
// avec le vrai popup.html, donc l'analyseur teste est celui du produit.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RACINE = process.argv[2] || "build/koala-zen";
let ok = 0, ko = 0;
const echecs = [];
function verifie(nom, cond, detail) {
  if (cond) ok++;
  else { ko++; echecs.push(nom + (detail !== undefined ? "  ->  " + JSON.stringify(detail) : "")); }
}

function charge() {
  const html = fs.readFileSync(path.join(RACINE, "popup.html"), "utf8");
  const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  const store = {};
  w.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
  w.chrome = {
    i18n: { getMessage: () => "" },
    runtime: { getManifest: () => ({ version: "2.0.0" }), sendMessage() {}, lastError: null,
      onMessage: { addListener() {} } },
    storage: { local: {
      get: (k, cb) => { const o = {}; (Array.isArray(k) ? k : Object.keys(k || store)).forEach((x) => { if (x in store) o[x] = store[x]; }); cb ? cb(o) : null; return Promise.resolve(o); },
      set: (o, cb) => { Object.assign(store, o); cb ? cb() : null; return Promise.resolve(); }
    } },
    alarms: { get: (n, cb) => { cb ? cb(null) : null; return Promise.resolve(null); } },
    tabs: { query: (q, cb) => { cb ? cb([]) : null; return Promise.resolve([]); } }
  };
  w.eval(fs.readFileSync(path.join(RACINE, "quotes.js"), "utf8"));
  w.eval(fs.readFileSync(path.join(RACINE, "popup.js"), "utf8"));
  return { w, doc: w.document, store };
}

const env = charge();
const P = (t, deja) => env.w.parseLot(t, deja);
const C = (l) => env.w.coupeLigne(l);

/* ============ 1. Le separateur ============ */
function testSeparateur() {
  verifie("le tiret entoure d'espaces separe",
    JSON.stringify(C("Le repos fait partie du travail - Seneque")) ===
    JSON.stringify({ t: "Le repos fait partie du travail", a: "Seneque" }), C("Le repos fait partie du travail - Seneque"));

  // Un tiret colle aux mots n'est PAS un separateur, sinon un mot compose casse.
  verifie("un tiret colle aux mots ne separe pas",
    C("Le savoir-faire s'apprend").a === "", C("Le savoir-faire s'apprend"));
  verifie("un mot compose reste entier",
    C("Le savoir-faire s'apprend").t === "Le savoir-faire s'apprend");

  // Le DERNIER tiret entoure d'espaces, pas le premier.
  verifie("c'est le dernier tiret entoure d'espaces qui separe",
    JSON.stringify(C("Marche - respire - Le koala")) ===
    JSON.stringify({ t: "Marche - respire", a: "Le koala" }), C("Marche - respire - Le koala"));

  verifie("les espaces en trop sont retires des deux cotes",
    JSON.stringify(C("   Rien ne presse    -    Anonyme   ")) ===
    JSON.stringify({ t: "Rien ne presse", a: "Anonyme" }), C("   Rien ne presse    -    Anonyme   "));

  verifie("la tabulation est acceptee, pour coller depuis un tableur",
    JSON.stringify(C("Bouge un peu\tLe koala")) ===
    JSON.stringify({ t: "Bouge un peu", a: "Le koala" }), C("Bouge un peu\tLe koala"));
  verifie("la tabulation prime sur le tiret",
    C("Un texte - avec tiret\tAuteur").a === "Auteur", C("Un texte - avec tiret\tAuteur"));
  verifie("sans separateur, toute la ligne est la citation",
    C("Une respiration suffit").t === "Une respiration suffit");
  verifie("sans separateur, l'auteur est vide avant defaut",
    C("Une respiration suffit").a === "");
  verifie("les virgules du texte ne changent rien",
    C("Rien ne presse, la journee est longue - Anonyme").t === "Rien ne presse, la journee est longue");
  verifie("un tiret en fin de ligne ne coupe pas",
    C("Un texte qui finit par -").a === "", C("Un texte qui finit par -"));
}

/* ============ 2. Auteur manquant et lignes vides ============ */
function testAuteurEtVides() {
  const r = P("Une respiration suffit\n\n   \nLe repos fait partie du travail - Seneque\n");
  verifie("auteur manquant remplace par un defaut", !!r.pretes[0].a, r.pretes[0]);
  verifie("l'auteur fourni est conserve", r.pretes[1].a === "Seneque", r.pretes[1]);
  verifie("les lignes vides sont ignorees", r.pretes.length === 2, r.pretes.length);
  verifie("les lignes vides sont comptees", r.vides === 3, r.vides);
  verifie("une ligne d'espaces seuls est ignoree", P("   \n  \n").pretes.length === 0);
}

/* ============ 3. Doublons, compares sur le TEXTE seul ============ */
function testDoublons() {
  const r = P("Rien ne presse - Anonyme\nRien ne presse - Un autre auteur\nBouge un peu - Toi");
  verifie("un doublon est retire sans demander", r.pretes.length === 2, r.pretes.length);
  verifie("le doublon est compte", r.doublons.length === 1, r.doublons);
  verifie("le doublon porte son numero de ligne", r.doublons[0].no === 2, r.doublons[0]);
  verifie("la comparaison porte sur le texte seul, l'auteur ne compte pas",
    r.doublons[0].t === "Rien ne presse", r.doublons[0]);
  verifie("la comparaison ignore la casse",
    P("Rien ne presse\nRIEN NE PRESSE").pretes.length === 1);

  // Doublon contre les citations deja enregistrees, pas seulement dans le collage.
  const r2 = P("Rien ne presse - Anonyme\nUne nouveaute - Toi", [{ t: "Rien ne presse", a: "X" }]);
  verifie("un doublon d'une citation deja enregistree est retire", r2.pretes.length === 1, r2.pretes);
  verifie("ce doublon est compte lui aussi", r2.doublons.length === 1, r2.doublons);
  verifie("la nouveaute passe", r2.pretes[0].t === "Une nouveaute");
}

/* ============ 4. Les deux plafonds ============ */
function testPlafonds() {
  const longue = "x".repeat(181);
  const r = P(longue + " - Auteur\nCourte - Auteur");
  verifie("une citation de plus de 180 signes est ignoree", r.pretes.length === 1, r.pretes.length);
  verifie("elle est comptee a part", r.longues.length === 1, r.longues);
  verifie("elle porte son numero de ligne", r.longues[0].no === 1);
  verifie("exactement 180 signes passe", P("y".repeat(180)).pretes.length === 1);

  const bcp = Array.from({ length: 520 }, (_, i) => "Citation numero " + i).join("\n");
  const r2 = P(bcp);
  verifie("au dela de 500 lignes le reste est ignore", r2.pretes.length === 500, r2.pretes.length);
  verifie("le depassement est signale", r2.tropDeLignes === true);
  verifie("500 lignes pile ne declenche pas le signal",
    P(Array.from({ length: 500 }, (_, i) => "Citation " + i).join("\n")).tropDeLignes === false);
}

/* ============ 5. Robustesse de l'analyseur ============ */
function testRobustesse() {
  verifie("texte vide, rien de prêt", P("").pretes.length === 0);
  verifie("texte nul, aucune erreur", P(null).pretes.length === 0);
  verifie("indefini, aucune erreur", P(undefined).pretes.length === 0);
  verifie("fins de ligne Windows acceptees",
    P("Une ligne\r\nUne autre").pretes.length === 2);
  verifie("une seule ligne sans retour", P("Seule").pretes.length === 1);
  verifie("l'analyseur ne touche pas au tableau existant", (() => {
    const deja = [{ t: "A", a: "x" }];
    P("B", deja);
    return deja.length === 1;
  })());
}

/* ============ 6. Les deux sous ecrans ============ */
// On mesure par le DOM et jamais par les variables internes, ce qui verifie ce
// que l'utilisateur voit reellement.
function nbMiennes(d) {
  const seg = d.getElementById("qsegMine");
  if (seg) seg.click();
  return d.getElementById("quoteList").querySelectorAll(".q").length;
}

function testEcrans() {
  const e = charge();
  const d = e.doc;
  verifie("l'acces En ajouter plusieurs d'un coup existe", !!d.getElementById("bulkOpen"));
  verifie("l'ecran de collage existe", !!d.getElementById("panelBulk"));
  verifie("l'ecran de verification existe", !!d.getElementById("panelBulkOk"));
  verifie("les deux ecrans sont masques au depart",
    d.getElementById("panelBulk").hidden && d.getElementById("panelBulkOk").hidden);
  verifie("la zone de texte fait 186 px, planche 02",
    /\.bulk-ta \{[^}]*height: 186px/.test(d.documentElement.outerHTML));
  verifie("l'apercu est plafonne a 250 px, planche 02",
    /\.bulk-prev \{[^}]*max-height: 250px/.test(d.documentElement.outerHTML));
  verifie("le bandeau d'information existe", !!d.getElementById("bulkInfo"));
  verifie("aucune boite de dialogue, ce sont des panneaux plein cadre",
    !d.querySelector("dialog") && !!d.getElementById("bulkBack"));

  const avant = nbMiennes(d);
  d.getElementById("bulkOpen").click();
  verifie("l'acces ouvre l'ecran de collage", !d.getElementById("panelBulk").hidden);
  verifie("l'en-tete principal est masque pendant le sous ecran",
    d.getElementById("mainHead").hidden === true);
  verifie("l'onglet Perso est masque pendant le sous ecran",
    d.getElementById("panelPerso").hidden === true);

  d.getElementById("bulkText").value = "Une premiere - Moi\nUne seconde\nUne premiere - Moi";
  d.getElementById("bulkCheck").click();
  verifie("l'ecran de verification s'ouvre", !d.getElementById("panelBulkOk").hidden);
  verifie("l'ecran de collage se ferme", d.getElementById("panelBulk").hidden === true);
  verifie("l'apercu montre les deux lignes valides",
    d.getElementById("bulkList").querySelectorAll(".q").length === 2,
    d.getElementById("bulkList").querySelectorAll(".q").length);
  verifie("le doublon est signale dans le bandeau",
    /1/.test(d.getElementById("bulkInfo").textContent), d.getElementById("bulkInfo").textContent);
  verifie("le bouton d'ajout porte le compte",
    /2/.test(d.getElementById("bulkApply").textContent), d.getElementById("bulkApply").textContent);

  d.getElementById("bulkApply").click();
  verifie("les deux ecrans se referment apres l'ajout",
    d.getElementById("panelBulk").hidden && d.getElementById("panelBulkOk").hidden);
  verifie("les deux citations sont versees dans les tiennes",
    nbMiennes(d) === avant + 2, nbMiennes(d) + " au lieu de " + (avant + 2));

  // Revenir au texte ne perd pas le collage.
  const e2 = charge();
  e2.doc.getElementById("bulkOpen").click();
  e2.doc.getElementById("bulkText").value = "Une citation - Moi";
  e2.doc.getElementById("bulkCheck").click();
  verifie("une seule ligne s'accorde au singulier, jamais 1 lignes",
    e2.doc.getElementById("bulkPreviewN").textContent === "1 ligne",
    e2.doc.getElementById("bulkPreviewN").textContent);
  verifie("une seule citation prete s'accorde au singulier dans le bandeau",
    e2.doc.getElementById("bulkInfo").textContent.indexOf("1 citation prête.") > -1 &&
    e2.doc.getElementById("bulkInfo").textContent.indexOf("1 citations") === -1,
    e2.doc.getElementById("bulkInfo").textContent);
  verifie("le bouton d'ajout au singulier n'affiche aucun nombre",
    e2.doc.getElementById("bulkApply").textContent === "Ajouter la citation",
    e2.doc.getElementById("bulkApply").textContent);
  e2.doc.getElementById("bulkBackText").click();
  verifie("Revenir au texte ramene a l'ecran de collage",
    !e2.doc.getElementById("panelBulk").hidden && e2.doc.getElementById("panelBulkOk").hidden);

  // Rien n'entre sans passer par la verification.
  const e3 = charge();
  const av3 = nbMiennes(e3.doc);
  e3.doc.getElementById("bulkOpen").click();
  e3.doc.getElementById("bulkText").value = "Une citation qui ne doit pas entrer";
  e3.doc.getElementById("bulkCancel").click();
  verifie("Annuler n'ajoute rien", nbMiennes(e3.doc) === av3, nbMiennes(e3.doc));
  verifie("Annuler referme le sous ecran", e3.doc.getElementById("panelBulk").hidden === true);

  // Un collage vide ne propose pas d'ajouter.
  const e4 = charge();
  e4.doc.getElementById("bulkOpen").click();
  e4.doc.getElementById("bulkText").value = "   \n  \n";
  e4.doc.getElementById("bulkCheck").click();
  verifie("un collage vide desactive le bouton d'ajout",
    e4.doc.getElementById("bulkApply").disabled === true);
}

/* ============ 7. Le champ unique suit la meme grammaire, module D ============ */
function testChampUnique() {
  const e = charge();
  const d = e.doc;
  verifie("la barre verticale n'est plus le separateur",
    e.w.eval('coupeLigne("A|B")').t === "A|B");
  verifie("le champ unique lit le tiret comme le collage",
    e.w.eval('coupeLigne("Bouge un peu - Le koala")').a === "Le koala");

  const avant = nbMiennes(d);
  d.getElementById("quoteInput").value = "Bouge un peu - Le koala";
  d.getElementById("quoteAdd").click();
  verifie("le champ unique ajoute bien une citation", nbMiennes(d) === avant + 1,
    nbMiennes(d) + " au lieu de " + (avant + 1));
  const rows = d.getElementById("quoteList").querySelectorAll(".q");
  const derniere = rows[rows.length - 1];
  verifie("le texte est celui d'avant le tiret",
    /Bouge un peu/.test(derniere.textContent) && !/- Le koala/.test(derniere.textContent),
    derniere.textContent);
  verifie("l'auteur est celui d'apres le tiret",
    /Le koala/.test(derniere.textContent), derniere.textContent);
  verifie("le champ est vide apres l'ajout", d.getElementById("quoteInput").value === "");
}

(async () => {
  const suites = [
    ["Le separateur", testSeparateur],
    ["Auteur manquant et lignes vides", testAuteurEtVides],
    ["Doublons", testDoublons],
    ["Les deux plafonds", testPlafonds],
    ["Robustesse de l'analyseur", testRobustesse],
    ["Les deux sous ecrans", testEcrans],
    ["Le champ unique", testChampUnique]
  ];
  for (const [nom, f] of suites) {
    const avant = ok + ko, avantKo = ko;
    try { await f(); }
    catch (e) { ko++; echecs.push(nom + " a leve une erreur: " + e.message); }
    console.log("  %s %s (%d controles)", ko === avantKo ? "ok " : "KO ", nom, ok + ko - avant);
  }
  console.log("\n=== ajout en lot : %d reussis, %d echecs ===", ok, ko);
  if (echecs.length) { console.log("\nECHECS:"); echecs.forEach((e) => console.log("  - " + e)); }
  process.exit(ko ? 1 : 0);
})();
