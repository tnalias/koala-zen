# Tests

Campagne de tests fonctionnels de l'extension. Elle ne fait pas partie du paquet
livre aux boutiques, `build.sh` ne l'embarque pas.

## Lancer

```bash
npm install jsdom
bash tests/run_all.sh
```

Lance depuis la racine du depot, le script teste ce depot. On peut aussi lui
passer un ou plusieurs chemins de build. Pour une suite seule :

```bash
node tests/test_background.js .
node tests/test_content.js .
node tests/test_popup.js .
node tests/test_backup.js .
python3 tests/test_integrite.py .
```

## Ce qui est couvert

| Fichier | Cible | Controles |
|---|---|---|
| `test_background.js` | Planification, issues, statistiques, pause, effacements, sourdine, temps d'ecran, charge utile | 74 |
| `test_content.js` | Le rappel dans la page, ses cinq ecrans, la rotation des objectifs, les deux issues de la pique, le mode focus | 67 |
| `test_popup.js` | Les quatre onglets, le sous ecran des citations, les statistiques sur les sept periodes, les effacements | 196 |
| `test_backup.js` | La sauvegarde et la restauration, combinaisons de parties, aller retour, fusion, remplacement, fichiers abimes | 94 |
| `test_integrite.py` | Manifeste, images citees, parite des trois langues, couverture i18n, identifiants du HTML | 27 |

Total, **467 controles par build**.

## Comment ca marche

Le code du produit est charge **tel quel**, sans modification, dans un contexte
`vm` pour `background.js` et sous `jsdom` pour `popup.js` et `content.js`. Les API
du navigateur sont simulees par des bouchons qui journalisent les messages
envoyes et les ecritures en stockage, ce qui permet de verifier non seulement
l'affichage mais aussi ce qui part vraiment vers l'arriere plan.

Seule exception, `test_content.js` raccourcit les DUREES de la choregraphie pour
que la campagne tienne en quelques secondes. La table des raccourcis est en haut
du fichier, et le test echoue si un motif de duree n'est plus trouve, ce qui
signale qu'il faut la mettre a jour.
