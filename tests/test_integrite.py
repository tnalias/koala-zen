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
# notifications, ajoutee le 2026-09-16 pour le rappel de rendez-vous de l'agenda
# quand aucune page http(s) n'est au premier plan, jamais pour autre chose.
verifie("aucune permission superflue",
        set(man.get("permissions", [])) <= attendues | {"scripting", "activeTab", "tabs", "declarativeNetRequest", "notifications"},
        man.get("permissions"))
# declarativeNetRequest, ajoute pour la sauvegarde kDrive. Depuis le
# 2026-09-21 la regle Origin est une regle de SESSION posee par le fond et
# limitee aux requetes sans onglet (tabIds -1) : une regle statique s'appliquait
# aux pages Infomaniak elles-memes et cassait l'outil Newsletter. Plus jamais
# de jeu de regles statiques ni de rules.json.
if "declarativeNetRequest" in man.get("permissions", []):
    verifie("aucun jeu de regles statiques declarativeNetRequest dans le manifeste",
            "declarative_net_request" not in man, man.get("declarative_net_request"))
    verifie("aucun fichier rules.json", not os.path.exists(os.path.join(racine, "rules.json")))
    bg_dnr = lit("background.js")
    # 2026-10-06 (revue ECC) : la regle ne vise plus que les ecritures vers l'API mail.
    verifie("le fond pose une regle de session limitee a l'API mail hors onglet",
            "updateSessionRules" in bg_dnr and "tabIds: [-1]" in bg_dnr and '"||mail.infomaniak.com/api/"' in bg_dnr
            and 'urlFilter: "||api.infomaniak.com"' not in bg_dnr)
    verifie("les appels a l'API partent sans cookies", 'credentials: "omit"' in bg_dnr)
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
# 2026-09-25 : les personnages par defaut sont dessines en SVG dans content.js,
# plus aucune image livree n'est necessaire. Ce qui reste dans images/ doit
# etre cite, et ce qui est cite doit exister.
verifie("les koalas par defaut sont dessines, plus aucune photo citee", not any("koala-" in i for i in images))
# 2026-09-28 : le popup cite aussi ses images (le koala d'accueil de
# l'onboarding, meme dessin que celui du rappel).
images |= set(re.findall(r'"(images/[^"]+)"', lit("popup.html") + lit("popup.js")))
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
# 2026-09-25 : plus aucune image de personnage livree, donc plus rien a
# exposer aux pages. Une entree qui reviendrait serait un oubli.
verifie("aucune ressource images/ n'est plus exposee aux pages",
        not any(m.startswith("images/") for m in motifs), motifs)

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
for f in ("popup.js", "content.js", "background.js"):
    # bgMsg : les textes composes par le fond (notification systeme, mails Prevenir).
    utilisees |= set(re.findall(r'(?:kzMsg|msg|bgMsg)\("([^"]+)"', lit(f)))
utilisees |= set(re.findall(r'data-i18n(?:-ph|-aria)?="([^"]+)"', lit("popup.html")))
utilisees |= {"eraseConfirm", "eraseBtn", "eraseAllBtn", "extDesc", "firstVisitIn", "nextVisitIn"}
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
nb_koalas = len(re.findall(r'"svg:(?:reminder|quote)"', m_koalas.group(1))) if m_koalas else 0
verifie("DEFAULT_KOALAS nomme les deux koalas dessines", nb_koalas == 2, nb_koalas)

# 2026-09-16 : la relance a disparu (un report est un report), et avec elle
# RELANCE_MODE et SNARK_KOALAS. Les images par defaut, elles, doivent toujours
# exister dans CE build, c'est le bug exact de la 1.0.13.
verifie("aucune trace du casting de relance", not re.search(r"RELANCE_MODE|SNARK_KOALAS|RELANCE_POOL", contenu))
koalas = re.findall(r'"([^"]+\.(?:png|gif))"', m_koalas.group(1)) if m_koalas else []
manquantes = [i for i in koalas if not os.path.exists(os.path.join(racine, i))]
verifie("toutes les images par defaut existent dans ce build", not manquantes, manquantes)

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
verifie("passageState est declare avec ses douze champs, dont les trois des rondes du soir",
        all(c in bgtxt for c in ("passageState", "lastVariant", "lastPhrase", "lastCoat", "lastFox", "lastMeet", "lastReminder", "eveningDay", "eveningHour", "eveningPhrase")))

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
