<p align="center">
  <img src="icons/icon-128.png" width="88" height="88" alt="Koala Zen">
</p>

# Koala Zen

> [English](README.md) · **Français**

Une petite extension de navigateur pour **Chrome et Firefox**. Toutes les 30 minutes, un koala adorable apparaît sur la page. Il t'invite d'abord à bouger un peu. Puis il repasse te souffler une courte pensée, avant de disparaître d'une façon différente à chaque fois. Le koala change à chaque passage : trois photos, ou les tiennes.

- **Fixe tes objectifs de mouvement** (« Fais 3 pompes »), indique si c'est fait, et note ton énergie de 1 à 10.
- **Suis ta progression** : aujourd'hui, hier, la semaine, le mois, ou depuis le début, avec un graphe sur l'année.
- **Choisis ton rythme** : Pomodoro, Deep work, Ultradien, ou ton propre intervalle (1 à 240 minutes).
- **Reporte ou mets en pause** (plus tard, 1 h, la journée) et rattrape les pauses manquées.
- **Pause automatique** en visioconférence (kMeet, Teams, Zoom, Meet) et quand tu quittes le clavier.
- **Mode focus** en option : une pause plein écran qui bloque jusqu'à la fin du minuteur. Désactivé par défaut.
- **Vois ton temps d'écran** : la bulle de sagesse, et le petit rappel affiché si tu sautes une pause, t'indiquent depuis combien de temps tu es actif sur l'ordinateur aujourd'hui. Remise à zéro à minuit dans le fuseau que tu choisis (Europe/Zurich par défaut, ou celui de ton navigateur).
- Une soixantaine de citations modifiables, de Bouddha et Rûmî à Marc Aurèle et Steve Jobs. Ajoute aussi tes propres images de koala.
- **Interface en français, allemand et anglais**, selon la langue de ton navigateur.
- Il saute, roule ou s'envole. Une sortie différente à chaque fois. Tout reste sur ton ordinateur, aucun compte, aucun suivi.

---

## Aperçu

Le koala t'invite à bouger, puis te souffle une pensée. Ensuite, tout se règle depuis le panneau et tu suis ta progression. *(interface en anglais sur les captures, elle s'affiche dans la langue de ton navigateur.)*

![Le koala invite à bouger](store-assets/screenshot-1-move.png)
![Une citation à méditer](store-assets/screenshot-2-wisdom.png)
![Les réglages du plugin](store-assets/screenshot-3-settings.png)
![Les statistiques](store-assets/screenshot-4-stats.png)

---

## Installation

Koala Zen fonctionne sur **Chrome et Firefox**. Choisis ton navigateur ci-dessous. Les paquets prêts à l'emploi se trouvent dans le dossier [`download/`](download), et celui pour Firefox est **signé par Mozilla**, il s'installe donc directement.

### Chrome, Edge, Brave (le plus simple, environ une minute)
L'extension n'est pas encore sur le Chrome Web Store, tu l'ajoutes donc à la main. Elle reste installée après les redémarrages, il suffit de laisser le mode développeur activé.
1. Télécharge le fichier [`download/koala-zen-chrome.zip`](download/koala-zen-chrome.zip) et dézippe-le.
2. Dans Chrome, tape `chrome://extensions` dans la barre d'adresse et valide.
3. Active le **Mode développeur** (l'interrupteur en haut à droite).
4. Clique sur **Charger l'extension non empaquetée**, puis choisis le dossier obtenu (celui qui contient `manifest.json`).

L'icône du koala apparaît dans la barre d'outils. Clique dessus pour ouvrir les réglages.

### Firefox
Le paquet Firefox du dossier [`download/`](download) est **signé par Mozilla**, il s'installe donc durablement dans un Firefox normal, sans compte et sans ligne de commande.

**L'installer (recommandé)**
1. Télécharge [`download/koala-zen-firefox.xpi`](download/koala-zen-firefox.xpi).
2. Ouvre `about:addons`, clique sur la roue crantée puis sur **Installer un module depuis un fichier**, et choisis le `.xpi` (tu peux aussi glisser le fichier sur la fenêtre de Firefox).
3. Confirme. Comme le fichier est signé, il reste installé après les redémarrages.

**Essayer sans installer (temporaire)**
L'extension disparaît à la fermeture de Firefox.
1. Tape `about:debugging#/runtime/this-firefox` dans la barre d'adresse.
2. Clique sur **Charger un module temporaire** et choisis le `.xpi`.

**Si tu modifies le code, signe ta propre version (gratuit)**
Une version que tu as modifiée n'est plus couverte par la signature fournie, tu la signes donc pour toi. Tout se passe dans le navigateur, sans ligne de commande. Tu déposes l'extension sur AMO en **distribution privée** : Mozilla la signe pour ton usage, sans page publique.
1. Crée un compte Firefox gratuit sur https://accounts.firefox.com, puis ouvre le tableau de bord développeur : https://addons.mozilla.org/fr/developers/
2. **Personnalise l'identifiant.** Ouvre `manifest.json`, trouve `"id": "koala-zen@public.extension"` et remplace-la par un identifiant à toi, par exemple `"id": "koala-zen@ton-prenom"`. L'identifiant d'origine est réservé à la page publique. Sélectionne ensuite **tous les fichiers du dossier** (pas le dossier lui-même) et compresse-les en un fichier `.zip`.
3. Clique sur **Soumettre un nouveau module**, choisis **Sur votre propre serveur** (distribution privée, non listée), envoie ton `.zip`, et Mozilla te propose un `.xpi` **signé** à télécharger.
4. Installe ce `.xpi` signé de la même façon que ci-dessus.

Pas à l'aise avec ces étapes ? Une IA comme **Euria d'Infomaniak** peut te guider pas à pas. Colle-lui les instructions ci-dessus et décris-lui où tu bloques.

**Quand la page publique sera en ligne**
Une fois l'extension validée et publiée par Mozilla, tout le monde pourra l'installer en un clic depuis :

👉 https://addons.mozilla.org/fr/firefox/addon/koala-zen/

---

## Signer avec l'API en ligne de commande (alternative)
*Pour les personnes à l'aise avec le terminal qui préfèrent automatiser la signature. Le résultat est le même que la méthode recommandée plus haut : un `.xpi` signé pour un usage privé. C'est plus technique, chaque étape est détaillée.*

Tes identifiants d'API **ne vont jamais dans l'extension**. Ils servent uniquement à la commande `web-ext sign`, sur ta machine.

1. **Personnalise l'identifiant**, comme à l'étape 2 de la méthode recommandée : dans `manifest.json`, remplace `"id": "koala-zen@public.extension"` par le tien.
2. Crée une clé API sur https://addons.mozilla.org/developers/addon/api/key/. Mozilla te donne **deux** valeurs :
   - un **JWT issuer**, la « clé API » (du type `user:12345:678`).
   - un **JWT secret**, une longue chaîne aléatoire affichée **une seule fois**, à la création. Copie-la tout de suite. Si tu la perds, régénère une clé.
3. Installe l'outil : `npm install -g web-ext`
4. Depuis le dossier du projet (celui qui contient `manifest.json`), lance **l'une** de ces commandes :
   ```bash
   web-ext sign --channel=unlisted --api-key=VOTRE_ISSUER --api-secret=VOTRE_SECRET
   ```
   ou, pour ne pas taper les valeurs dans la commande :
   ```bash
   export WEB_EXT_API_KEY="VOTRE_ISSUER"
   export WEB_EXT_API_SECRET="VOTRE_SECRET"
   web-ext sign --channel=unlisted
   ```
   `--channel=unlisted` veut dire distribution privée, non publiée dans la galerie publique.
5. Le `.xpi` signé arrive dans `web-ext-artifacts/`. Installe-le comme à l'étape 6 de la méthode recommandée (glisse-le dans une fenêtre Firefox, ou `about:addons` puis **Installer un module depuis un fichier**). Il reste installé après les redémarrages.

> **Garde ces deux valeurs privées.** Ne les mets jamais dans Git ni dans un fichier du projet. Le `.gitignore` fourni exclut déjà `web-ext-artifacts/`.

Besoin d'aide sur une étape ? Là aussi, une IA comme **Euria d'Infomaniak** peut te dépanner.

*Alternative sans compte Mozilla (Firefox Developer Edition ou ESR uniquement) :* passe `xpinstall.signatures.required` à `false` dans `about:config`, puis ouvre le `.xpi`. Cette option est ignorée sur Firefox standard.

---

## Réglages du plugin
**Tout dans Koala Zen se personnalise, depuis un seul endroit.** Clique sur l'icône du koala dans la barre d'outils pour ouvrir le panneau du plugin. Il a deux onglets, **Réglages** et **Stats**. Rien n'est figé : tu ajustes le rythme, les images, les textes et les pauses comme tu veux.

Onglet **Réglages** :
- **Faire une pause** : reporte le prochain passage (**Plus tard**), mets en pause **1 h**, ou arrête pour **la journée**. Un bouton **Reprendre** annule la pause à tout moment.
- **Rappels** : active ou coupe les passages automatiques du koala. Choisis ton **rythme** parmi **Pomodoro**, **Deep work**, **Ultradien**, ou **Personnalisé** pour fixer toi-même l'intervalle (1 à 240 minutes).
- **Ne pas déranger** : **pause en visioconférence** (le koala n'apparaît pas sur les sites listés, par défaut `kmeet.infomaniak.com`, `teams.microsoft.com`, `teams.live.com`, `zoom.us`, `meet.google.com`, un domaine par ligne, sous-domaines compris, donc `zoom.us` couvre aussi `us02web.zoom.us`) et **pause quand tu t'absentes** du clavier.
- **Mode focus** (désactivé par défaut) : une pause plein écran qui bloque la page jusqu'à la fin du minuteur, dont tu choisis la durée.
- **Temps d'écran** : choisis le fuseau horaire qui définit ta journée pour le compteur affiché dans les bulles. **Automatique (navigateur)** suit ton navigateur, ou sélectionne un fuseau dans la liste. Europe/Zurich par défaut. Le compteur se remet à zéro à minuit dans ce fuseau. Il ne compte que pendant que le navigateur tourne et que tu es actif sur l'ordinateur, et tout reste sur ton appareil.
- **Images de koala** : ajoute tes propres PNG ou GIF animés (fond transparent conseillé). Elles remplacent les trois koalas fournis, sauf si tu coches **Garder aussi les 3 koalas d'origine**. Un clic sur × retire une image. Les GIF gardent leur animation, les images fixes sont redimensionnées pour économiser de l'espace.
- **Citations** : une par ligne, au format « Texte | Auteur » (auteur facultatif). Laisse vide pour garder celles fournies. **Charger les citations fournies** les recopie pour que tu puisses les modifier.
- **Objectifs de mouvement** : les phrases courtes qui invitent à bouger, une par ligne. Laisse vide pour garder celles fournies.

Le bouton **Faire venir le koala maintenant** déclenche un passage immédiat, pratique pour tester tes réglages, et il ignore la pause visio. Clique sur **Enregistrer** après un changement, sauf pour les images dont l'ajout ou le retrait est immédiat.

Onglet **Stats** : suis tes exercices faits et ton énergie moyenne sur la période de ton choix (aujourd'hui, hier, la semaine, le mois, ou depuis le début), avec ta série de jours d'affilée et deux graphes sur l'année.

Le koala s'affiche sur la page web active, pas sur les pages internes du navigateur (`chrome://`, `about:`…), qui n'autorisent pas les extensions.

---

## Construire les paquets depuis les sources (optionnel)
Les paquets déjà construits sont dans [`download/`](download). Reconstruis-les seulement si tu modifies le code. Un script régénère les deux, dans `dist/` :
```bash
bash build.sh
```
- `dist/koala-zen-chrome.zip` pour Chrome, Edge, Brave ou le Chrome Web Store.
- `dist/koala-zen-firefox.xpi` pour Firefox et addons.mozilla.org, sans aucun avertissement au validateur.

Le `manifest.json` du dépôt cible les deux moteurs. Pour Firefox, le script retire la clé `service_worker` propre à Chrome et fixe la version minimale qui comprend `data_collection_permissions`, ce qui garde le rapport AMO tout vert. Le dossier `dist/` est ignoré par Git.

---

## Personnalisation dans le code
- **Citations et messages par défaut** dans `quotes.js` (`KZ_QUOTES` = `{ t, a }`, `KZ_SPORT` = les messages sport). La plupart des gens peuvent simplement utiliser les réglages ci-dessus.
- **Images par défaut** : remplace les fichiers de `images/` (`koala-1.png` … `koala-3.png`) et complète `DEFAULT_KOALAS` en haut de `content.js`.
- **Sites de visioconférence par défaut** : `DEFAULTS.mutedPatterns` dans `background.js` et `popup.js`.

Recharge l'extension après une modification des fichiers.

## Structure du projet
```
manifest.json     manifeste de l'extension (Manifest V3, Chrome + Firefox)
background.js     service worker : planifie les rappels, applique la pause visio, suit le temps d'écran actif du jour
content.js        dessine le koala, la bulle et les animations
quotes.js         les citations et messages sport par défaut
popup.html/js     le panneau de réglages
build.sh          construit les paquets Chrome (.zip) et Firefox (.xpi)
download/         paquets prêts à installer (Chrome .zip, Firefox .xpi)
images/           les 3 koalas par défaut (PNG)
icons/            icônes de la barre d'outils
store-assets/     textes et captures d'écran pour les boutiques
```

## Confidentialité
Rien ne quitte le navigateur. Tes réglages (fréquence, activation, liste visio, fuseau horaire choisi, ton compteur de temps d'écran du jour, et les images, citations ou messages que tu ajoutes) sont stockés localement via l'API de stockage du navigateur. Aucun serveur, aucune analyse, aucun suivi.

## Licence
MIT. Voir [LICENSE](LICENSE).
