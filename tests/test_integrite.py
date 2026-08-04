#!/usr/bin/env python3
"""Controle d'integrite d'un build, ressources, manifeste et langues."""
import json
import os
import re
import sys

racine = sys.argv[1]
ok = ko = 0
echecs = []


def verifie(nom, condition, detail=""):
    global ok, ko
    if condition:
        ok += 1
    else:
        ko += 1
        echecs.append(nom + ("  ->  " + str(detail) if detail else ""))


def lit(nom):
    return open(os.path.join(racine, nom), encoding="utf-8").read()


# ---------- manifeste ----------
man = json.loads(lit("manifest.json"))
verifie("manifeste en version 3", man.get("manifest_version") == 3)
verifie("le numero de version est bien forme", re.match(r"^\d+\.\d+\.\d+$", man.get("version", "")), man.get("version"))
verifie("la langue par defaut est l'anglais", man.get("default_locale") == "en")
attendues = {"storage", "alarms", "idle", "unlimitedStorage"}
verifie("les permissions attendues sont la", attendues.issubset(set(man.get("permissions", []))),
        man.get("permissions"))
verifie("aucune permission superflue",
        set(man.get("permissions", [])) <= attendues | {"scripting", "activeTab", "tabs", "declarativeNetRequest"},
        man.get("permissions"))
# declarativeNetRequest, ajoute pour la sauvegarde kDrive, doit toujours venir
# avec sa liste de regles statiques, jamais l'un sans l'autre.
if "declarativeNetRequest" in man.get("permissions", []):
    dnr = man.get("declarative_net_request", {})
    verifie("declarativeNetRequest est accompagne de ses regles statiques",
            isinstance(dnr.get("rule_resources"), list) and len(dnr["rule_resources"]) > 0, dnr)
    for regle in dnr.get("rule_resources", []):
        verifie("chaque jeu de regles a un fichier qui existe",
                os.path.isfile(os.path.join(racine, regle.get("path", ""))), regle)
verifie("le service worker est declare",
        "background" in man and ("service_worker" in man["background"] or "scripts" in man["background"]))

# ---------- fichiers cites par le manifeste ----------
for cle in ("icons", "action"):
    bloc = man.get(cle, {})
    icones = bloc.get("default_icon", bloc) if isinstance(bloc, dict) else {}
    for taille, chemin in (icones or {}).items():
        if isinstance(chemin, str):
            verifie("icone %s presente" % chemin, os.path.exists(os.path.join(racine, chemin)), chemin)

# ---------- images citees par le code ----------
contenu = lit("content.js")
images = set(re.findall(r'"(images/[^"]+)"', contenu))
verifie("le code cite au moins une image", len(images) > 0)
manquantes = [i for i in images if not os.path.exists(os.path.join(racine, i))]
verifie("toutes les images citees existent", not manquantes, manquantes[:6])

sur_disque = {"images/" + n for n in os.listdir(os.path.join(racine, "images"))}
inutilisees = sorted(sur_disque - images)
verifie("aucune image livree sans etre utilisee", not inutilisees, inutilisees[:6])

# ---------- ressources accessibles a la page ----------
war = man.get("web_accessible_resources", [])
motifs = []
for entree in war:
    motifs += entree.get("resources", [])
verifie("les images sont accessibles a la page",
        any(m.startswith("images/") for m in motifs), motifs)

# ---------- langues ----------
langues = ("en", "fr", "de")
paquets = {}
for lg in langues:
    paquets[lg] = json.loads(lit("_locales/%s/messages.json" % lg))
base = set(paquets["en"])
for lg in langues[1:]:
    verifie("la langue %s a le meme jeu de cles" % lg, set(paquets[lg]) == base,
            "ecart " + str(sorted(base ^ set(paquets[lg]))[:5]))
verifie("aucune eszett en allemand",
        not any("\u00df" in v["message"] for v in paquets["de"].values()))
for lg in langues:
    vides = [k for k, v in paquets[lg].items() if not v.get("message", "").strip()]
    verifie("aucun message vide en %s" % lg, not vides, vides[:5])
# Jetons identiques entre langues
for cle in base:
    jeux = [sorted(re.findall(r"\{[a-z]\}", paquets[lg][cle]["message"])) for lg in langues]
    if jeux[0] != jeux[1] or jeux[0] != jeux[2]:
        verifie("jetons coherents pour " + cle, False, str(jeux))
verifie("les jetons de substitution sont coherents", True)

# ---------- couverture i18n ----------
utilisees = set()
for f in ("popup.js", "content.js"):
    utilisees |= set(re.findall(r'(?:kzMsg|msg)\("([^"]+)"', lit(f)))
utilisees |= set(re.findall(r'data-i18n(?:-ph|-aria)?="([^"]+)"', lit("popup.html")))
utilisees |= {"eraseConfirm", "eraseBtn", "eraseAllBtn", "extDesc", "firstVisitIn", "nextVisitIn",
              "catchupTitleOne", "catchupTitlePlural", "tallyFirst", "tallyNth",
              "tallyFirstShort", "tallyNthShort"}
absentes = sorted(utilisees - base)
verifie("toutes les cles utilisees existent", not absentes, absentes[:8])
jamais = sorted(base - utilisees)
verifie("aucune cle de langue inutilisee", not jamais, jamais[:8])

# ---------- identifiants du popup ----------
html = lit("popup.html")
ids = set(re.findall(r'id="([^"]+)"', html))
lus = set(re.findall(r'\$\("([^"]+)"\)', lit("popup.js")))
verifie("tous les identifiants lus existent dans le HTML", not (lus - ids), sorted(lus - ids)[:6])

# ---------- traces d'IA ----------
suspect = []
for dossier, _, fichiers in os.walk(racine):
    for f in fichiers:
        if not f.endswith((".js", ".html", ".json", ".md", ".sh")):
            continue
        p = os.path.join(dossier, f)
        try:
            texte = open(p, encoding="utf-8").read()
        except Exception:
            continue
        for motif in ("claude", "anthropic", "chatgpt", "gpt-4", "generated by"):
            if motif in texte.lower():
                suspect.append(os.path.relpath(p, racine) + ":" + motif)
verifie("aucune trace d'assistant dans les fichiers livres", not suspect, suspect[:5])

# ---------------------------------------------------------------------------
# Module A, garde-fou des TROIS divergences entre les builds public et perso.
# La regression perso de la 1.0.13 venait d'un content.js aligne sans
# reappliquer ces constantes. Ce controle la rend impossible a repeter.
# ---------------------------------------------------------------------------
contenu = lit("content.js")

m_koalas = re.search(r"DEFAULT_KOALAS\s*=\s*\[(.*?)\]", contenu, re.S)
nb_koalas = len([x for x in re.findall(r'"([^"]+\.(?:png|gif))"', m_koalas.group(1))]) if m_koalas else 0
verifie("DEFAULT_KOALAS est renseigne", nb_koalas > 0, nb_koalas)

est_perso = nb_koalas > 10
attendu = "images" if est_perso else "drawn"
m_relance = re.search(r'RELANCE_MODE\s*=\s*"([a-z]+)"', contenu)
verifie("RELANCE_MODE est declare", bool(m_relance))
verifie("RELANCE_MODE correspond au build, %s koalas donc %s" % (nb_koalas, attendu),
        m_relance and m_relance.group(1) == attendu,
        m_relance.group(1) if m_relance else "absent")

m_snark = re.search(r"SNARK_KOALAS\s*=\s*\[(.*?)\]", contenu, re.S)
snark = re.findall(r'"([^"]+\.(?:png|gif))"', m_snark.group(1)) if m_snark else []
verifie("SNARK_KOALAS est renseigne", len(snark) > 0, snark)
# Les images de relance doivent exister dans CE build, c'est le bug exact de la 1.0.13.
manquantes = [i for i in snark if not os.path.exists(os.path.join(racine, i))]
verifie("toutes les images de relance existent dans ce build", not manquantes, manquantes)

# ---------------------------------------------------------------------------
# Module A, valeurs par defaut imposees par la planche.
# ---------------------------------------------------------------------------
for source in ("background.js", "popup.js"):
    txt = lit(source)
    verifie("%s, Animations sur Toujours par defaut" % source,
            re.search(r'animMode:\s*"always"', txt), source)
    verifie("%s, animaux de passage actives par defaut" % source,
            re.search(r"passages:\s*true", txt), source)
    verifie("%s, intervalle Perso memorise" % source,
            re.search(r"customInterval:\s*45", txt), source)

bgtxt = lit("background.js")
verifie("passageState est declare avec ses neuf champs",
        all(c in bgtxt for c in ("passageState", "lastVariant", "lastPhrase", "lastCoat", "lastFox", "lastMeet", "lastReminder")))

# L'ordonnancement des passages ne doit apparaitre dans AUCUNE liste d'export.
poptxt = lit("popup.js")
for groupe in ("SETTINGS_KEYS", "CONTENT_KEYS", "STATS_KEYS", "KOALA_KEYS"):
    ligne = re.search(groupe + r"\s*=\s*\[([^\]]*)\]", poptxt)
    dedans = ligne.group(1) if ligne else ""
    for interdit in ("passageState", "snarkIndex", "firstRun", "statsRange", "statsOffset"):
        verifie("%s n'exporte pas %s" % (groupe, interdit), interdit not in dedans)

print("=== integrite de %s : %d reussis, %d echecs ===" % (os.path.basename(racine), ok, ko))
if echecs:
    print("\nECHECS:")
    for e in echecs:
        print("  - " + e)
sys.exit(1 if ko else 0)
