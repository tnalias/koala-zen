#!/usr/bin/env python3
# Conformite du produit au vocabulaire ferme de la planche de design.
#
# L'environnement de developpement ne rend aucune page dans un vrai moteur, donc
# la fidelite au pixel ne peut pas se juger a l'oeil. Elle se juge ici. Toute
# valeur de couleur, de corps, d'interligne, de graisse, de rayon, d'ombre ou de
# courbe employee par le produit doit appartenir au vocabulaire releve dans la
# planche, ou figurer dans la liste d'exceptions ci dessous avec sa raison.
#
# Les valeurs viennent de ref_maquette.json, genere depuis la planche par
# gen_ref_maquette.py. La planche fait foi pour les VALEURS, son README pour les
# COMPORTEMENTS. Les deux divergent, exemple le rouge doux annonce #F0C9C7 par le
# README et pose a #F2C9C7 dans la planche.
import io, json, os, re, sys, collections

racine = sys.argv[1] if len(sys.argv) > 1 else "."
ici = os.path.dirname(os.path.abspath(__file__))
ref = json.load(io.open(os.path.join(ici, "ref_maquette.json"), encoding="utf-8"))

ok = 0
ko = 0
echecs = []


def verifie(nom, condition, detail=""):
    global ok, ko
    if condition:
        ok += 1
    else:
        ko += 1
        echecs.append(nom + ("  ->  " + str(detail) if detail else ""))


# Exceptions assumees. Chacune porte sa raison. La liste doit rester courte,
# sinon elle ne veut plus rien dire.
EXCEPTIONS = {
    # La planche ne dessine aucun etat de focus ni de survol, module O les impose.
    "0 0 0 3px rgba(47,174,74,0.25)": "anneau de focus, absent de la planche",
    "0 0 0 3px rgba(47,174,74,0.20)": "anneau de focus d'un champ, absent de la planche",
    "0 0 0 2px rgba(47,174,74,.35)": "anneau de survol, absent de la planche",
    "inset 0 2px 0 var(--gr)": "soulignement de l'onglet actif, pose par variable",
    # L'aplat plein de la bande d'energie choisie, exige par les jetons de design.
    "0 0 0 3px rgba(143,39,35,.30)": "anneau de la bande d'energie 0 a 3",
    "0 0 0 3px rgba(138,81,8,.30)": "anneau de la bande d'energie 4 a 5",
    "0 0 0 3px rgba(122,94,6,.30)": "anneau de la bande d'energie 6 a 7",
    "0 0 0 3px rgba(51,105,63,.30)": "anneau de la bande d'energie 8",
    "0 0 0 3px rgba(31,92,46,.30)": "anneau de la bande d'energie 9 a 10",
    # Les larmes sont dessinees par nous et restent identiques partout, planche 09.
    "50% 50% 50% 50% / 60% 60% 40% 40%": "forme de goutte des larmes du renoncement",
}

PALETTE = set(ref["_palette"])
VOCAB = {
    "font-size": set(ref["font-size"]),
    "line-height": set(ref["line-height"]),
    "font-weight": set(ref["font-weight"]),
    "border-radius": set(ref["border-radius"]),
    "gap": set(ref["gap"]),
}
OMBRES = set(ref["box-shadow"])
COURBES = set(c.replace(" ", "") for c in ref["_courbes"])
IGNORE = ("inherit", "normal", "0", "unset", "none", "auto")


def css_du_produit():
    blocs = []
    p = os.path.join(racine, "popup.html")
    if os.path.exists(p):
        for m in re.finditer(r"<style>(.*?)</style>", io.open(p, encoding="utf-8").read(), re.S):
            blocs.append(("popup.html", m.group(1)))
    for f in ("content.js", "passages.js"):
        p = os.path.join(racine, f)
        if not os.path.exists(p):
            continue
        txt = io.open(p, encoding="utf-8").read()
        for m in re.finditer(r"const STYLES = `(.*?)`;", txt, re.S):
            blocs.append((f, m.group(1)))
    return blocs


blocs = css_du_produit()
verifie("le CSS du produit est lisible", len(blocs) >= 2, "%d blocs" % len(blocs))

hors = collections.defaultdict(set)
for nom, css in blocs:
    for m in re.finditer(r"#[0-9A-Fa-f]{6}\b", css):
        c = m.group(0).upper()
        if c not in PALETTE:
            hors["couleur"].add(nom + " " + c)
    for prop, vocab in VOCAB.items():
        for m in re.finditer(prop + r"\s*:\s*([^;{}]+)", css):
            v = re.sub(r"\s+", " ", m.group(1).strip())
            if v.startswith("var(") or v in IGNORE or v in EXCEPTIONS:
                continue
            if prop == "line-height" and re.match(r"^[0-9.]+$", v):
                continue
            if v not in vocab:
                hors[prop].add(nom + " " + v)
    for m in re.finditer(r"box-shadow\s*:\s*([^;{}]+)", css):
        v = re.sub(r"\s+", " ", m.group(1).strip())
        if v in IGNORE or v.startswith("var(") or v in EXCEPTIONS:
            continue
        if v not in OMBRES:
            hors["ombre"].add(nom + " " + v)
    for m in re.finditer(r"cubic-bezier\([^)]*\)", css):
        if m.group(0).replace(" ", "") not in COURBES:
            hors["courbe"].add(nom + " " + m.group(0))

for quoi in ("couleur", "font-size", "line-height", "font-weight", "border-radius", "gap", "ombre", "courbe"):
    verifie("aucun ecart de %s avec la planche" % quoi, not hors[quoi], sorted(hors[quoi])[:6])

# La liste d'exceptions doit rester courte et entierement utilisee, sinon elle
# devient un tapis sous lequel on pousse les ecarts.
verifie("la liste d'exceptions reste courte", len(EXCEPTIONS) <= 14, "%d entrees" % len(EXCEPTIONS))
tout = "\n".join(css for _, css in blocs)
mortes = [e for e in EXCEPTIONS if e not in tout]
verifie("aucune exception morte", not mortes, mortes)
verifie("chaque exception porte une raison", all(EXCEPTIONS.values()))

# Les invariants de la planche, verifies directement.
verifie("la planche ne connait que deux graisses", set(ref["font-weight"]) == {"500", "600"},
        sorted(ref["font-weight"]))
verifie("la courbe unique d'interface est bien celle de la planche",
        any(c.replace(" ", "") == "cubic-bezier(0.2,0,0,1)" for c in ref["_courbes"]))
verifie("le depassement du personnage est bien celui de la planche",
        any(c.replace(" ", "") == "cubic-bezier(0.34,1.06,0.4,1)" for c in ref["_courbes"]))
verifie("la palette de la planche est complete", len(PALETTE) > 90, len(PALETTE))
verifie("les 67 keyframes de la planche sont recensees", len(ref["_keyframes"]) >= 67,
        len(ref["_keyframes"]))

print("=== conformite a la planche : %d reussis, %d echecs ===" % (ok, ko))
if echecs:
    print("\nECHECS:")
    for e in echecs:
        print("  - " + e)
sys.exit(1 if ko else 0)
