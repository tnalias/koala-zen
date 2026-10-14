<p align="center">
  <img src="icons/icon-128.png" width="88" height="88" alt="Koala Zen">
</p>

# Koala Zen

> [English](README.md) · **Français**

**Un koala bienveillant pour ta journée de travail.** Il te rappelle de faire de petites pauses et d'ancrer de bonnes habitudes, te garde à l'heure pour tes réunions, et te montre où passe ton temps. Pour **Chrome et Firefox**, gratuit et open source.

- **Un coup de pouce, jamais de culpabilité.** Toutes les 5 à 240 minutes, un koala te propose une petite chose : te lever, boire un verre d'eau, regarder au loin. Fait ou plus tard, c'est toi qui choisis. Puis il te laisse une courte pensée, parmi une soixantaine de citations. Jamais pendant une visio.
- **Ne rate plus une réunion.** Une bulle 3 minutes avant, avec le lien de la visio à un clic, et un rappel 5 minutes avant la fin. Silence pendant tes réunions.
- **En retard ? Préviens en un clic.** Un mail déjà écrit pour les participants, depuis ta propre boîte. Tu relis, tu envoies.
- **Vois où passe ton temps.** Habitudes, écran, réunions et mails, jour par jour, avec tes séries et tes records.
- **Ton koala à toi.** Remplace-le par tes propres images ou GIF animés (jusqu'à 18), et écris tes propres habitudes et citations.
- **Et parfois, les chats papotent.** Sans aucune raison. Dès 17 h, il te rappelle, un peu plus fermement chaque heure, qu'il est temps d'arrêter.

> **Un compte Infomaniak *my kSuite*, gratuit, suffit** pour les fonctions avancées : son agenda et son mail débloquent les rappels de réunion, le mail aux participants et les stats de réunions et de mails. **L'agenda et le mail fonctionnent uniquement avec Infomaniak.** Elles ne sont pas compatibles avec Google Agenda, Gmail ni Microsoft Outlook. Tout le reste, pauses, citations, statistiques et animaux de passage, fonctionne pour tout le monde.

**Tes données restent chez toi.** Pas de compte, pas de serveur Koala Zen, aucun suivi. Tout reste dans ton navigateur, et une sauvegarde est un fichier que tu exportes toi-même. Les fonctions Infomaniak, facultatives, utilisent tes propres jetons, chacun limité à un seul usage et chiffré sur ton appareil.

**Nouveau en 2.2 :** rappels de réunion et mail aux participants avec Infomaniak, temps en réunion et mails dans les stats, un mode sombre, une courte présentation au démarrage, des koalas et des chats redessinés, les rondes du soir et du week-end, et une revue de sécurité complète. Voir le [journal des versions](CHANGELOG.md), en anglais.

---

## Aperçu

Le koala t'invite à faire ton habitude, te garde à l'heure pour tes réunions, et te montre où passe ton temps. Tout se règle depuis un seul panneau.

<table>
  <tr>
    <td width="50%" align="center"><img src="store-assets/screenshot-1-nudge-fr.png" alt="Bouge un peu. Sans culpabiliser." width="410"><br><sub><b>Bouge un peu. Sans culpabiliser.</b></sub></td>
    <td width="50%" align="center"><img src="store-assets/screenshot-2-meetings-fr.png" alt="Ne rate plus jamais une réunion" width="410"><br><sub><b>Ne rate plus jamais une réunion</b></sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="store-assets/screenshot-3-warn-fr.png" alt="En retard ? Préviens en un clic." width="410"><br><sub><b>En retard ? Préviens en un clic.</b></sub></td>
    <td width="50%" align="center"><img src="store-assets/screenshot-4-stats-fr.png" alt="Vois où passe ton temps" width="410"><br><sub><b>Vois où passe ton temps</b></sub></td>
  </tr>
  <tr>
    <td width="50%" align="center"><img src="store-assets/screenshot-5-cats-fr.png" alt="Et parfois, les chats papotent" width="410"><br><sub><b>Et parfois, les chats papotent</b></sub></td>
    <td width="50%" align="center"><img src="store-assets/screenshot-6-ksuite-fr.png" alt="Un compte gratuit Infomaniak my kSuite suffit" width="410"><br><sub><b>Un compte gratuit Infomaniak my kSuite suffit</b></sub></td>
  </tr>
</table>

---

## Installation

Koala Zen fonctionne sur **Chrome et Firefox**. Choisis ton navigateur ci-dessous. Les paquets prêts à l'emploi se trouvent dans le dossier [`download/`](download). Le `.xpi` de `download/` est déjà **signé par Mozilla**, prêt à installer directement.

### Chrome, Edge, Brave (le plus simple, environ une minute)
L'extension n'est pas encore sur le Chrome Web Store, tu l'ajoutes donc à la main. Elle reste installée après les redémarrages, il suffit de laisser le mode développeur activé.
1. Télécharge le fichier [`download/koala-zen-chrome.zip`](download/koala-zen-chrome.zip) et dézippe-le.
2. Dans Chrome, tape `chrome://extensions` dans la barre d'adresse et valide.
3. Active le **Mode développeur** (l'interrupteur en haut à droite).
4. Clique sur **Charger l'extension non empaquetée**, puis choisis le dossier obtenu (celui qui contient `manifest.json`).

L'icône du koala apparaît dans la barre d'outils. Clique dessus pour ouvrir les réglages.

### Firefox
Koala Zen est **en ligne sur addons.mozilla.org**, installe-le en un clic :

👉 https://addons.mozilla.org/fr/firefox/addon/koala-zen/

**Alternative, installer le `.xpi` directement depuis ce dépôt**
[`download/koala-zen-firefox.xpi`](download/koala-zen-firefox.xpi) est le même build signé par Mozilla que la fiche ci-dessus.
1. Ouvre `about:addons`, clique sur la roue crantée puis sur **Installer un module depuis un fichier**, et choisis [`download/koala-zen-firefox.xpi`](download/koala-zen-firefox.xpi) (tu peux aussi glisser le fichier sur la fenêtre de Firefox).
2. Confirme. Comme le fichier est signé, il reste installé après les redémarrages.

**Essayer sans installer (temporaire)**
L'extension disparaît à la fermeture de Firefox.
1. Tape `about:debugging#/runtime/this-firefox` dans la barre d'adresse.
2. Clique sur **Charger un module temporaire** et choisis le `.xpi`.

**Si tu modifies le code, signe ta propre version (gratuit)**
La signature fournie ne couvre que le fichier non modifié ci-dessus, une version que tu as changée a donc besoin de la sienne. Tout se passe dans le navigateur, sans ligne de commande. Tu déposes l'extension sur AMO en **distribution privée** : Mozilla la signe pour ton usage, sans page publique.
1. Crée un compte Firefox gratuit sur https://accounts.firefox.com, puis ouvre le tableau de bord développeur : https://addons.mozilla.org/fr/developers/
2. **Personnalise l'identifiant.** Ouvre `manifest.json`, trouve `"id": "koala-zen@public.extension"` et remplace-la par un identifiant à toi, par exemple `"id": "koala-zen@ton-prenom"`. L'identifiant d'origine est réservé à la page publique. Sélectionne ensuite **tous les fichiers du dossier** (pas le dossier lui-même) et compresse-les en un fichier `.zip`.
3. Clique sur **Soumettre un nouveau module**, choisis **Sur votre propre serveur** (distribution privée, non listée), envoie ton `.zip`, et Mozilla te propose un `.xpi` **signé** à télécharger.
4. Installe ce `.xpi` signé de la même façon que ci-dessus.

Pas à l'aise avec ces étapes ? Une IA comme **Euria d'Infomaniak** peut te guider pas à pas. Colle-lui les instructions ci-dessus et décris-lui où tu bloques.

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

## Premier lancement
Une présentation en quatre étapes s'ouvre à l'installation, et se revoit par le lien sous le numéro de version : ta première habitude, **Ce que tu y gagnes** (les bénéfices), **Connecte ton agenda** (facultatif, un jeton limité au seul périmètre `workspace:calendar`, en trois étapes numérotées : crée-le dans le Manager, coche ce seul périmètre, colle-le ; puis les agendas à surveiller), et **Tes données restent chez toi** (pas de compte, pas de serveur Koala Zen, tout reste sur cet appareil, tes jetons sont chiffrés et chacun limité à un usage, et une sauvegarde est un fichier que tu exportes depuis Données). Le jeton mail n'est pas demandé ici : il s'ajoute plus tard dans la carte de l'agenda si tu allumes les fonctions mail. Chaque étape a son illustration, dont le koala du rappel qui salue à l'accueil. Retour et Passer sont en haut, le bouton principal reste en bas, et le popup garde la même hauteur d'une étape à l'autre.

## Réglages du plugin
**Tout est personnalisable dans Koala Zen.** Clique sur l'icône du koala dans la barre d'outils pour ouvrir le panneau. L'en-tête annonce la prochaine visite, et quatre onglets suivent : **Réglages** (comment et quand le koala apparaît), **Perso** (ce qu'il montre), **Stats** (ta progression) et **Données** (sauvegarde et effacement).

Onglet **Réglages**, dans l'ordre :
- **Mettre en pause** : reporte la prochaine apparition (**Plus tard**), mets en pause **1 heure**, ou arrête pour **aujourd'hui**. Un bouton **Reprendre** annule la pause à tout moment, et ta série reste intacte pendant ce temps.
- **Rythme des rappels** : choisis **Pomodoro** (25 min), **Deep work** (52 min), **Ultradien** (90 min), ou **Perso** et règle l'intervalle au curseur (5 à 240 minutes, par pas de cinq).
- **Pause focus** (désactivé par défaut) : la page se voile le temps de la pause, pour couper pour de vrai. Tu choisis la durée.
- **Les animaux de passage** (activés par défaut) : un chat traverse la page pour dire bonjour et repart. Il ne demande rien et ne compte pour rien. Parfois deux chats, ou un chat et un renard, se croisent et se saluent chacun leur tour. Au maximum un toutes les deux heures, quatre par jour, uniquement entre 8h et 20h, et jamais pendant une visio, une pause ou une pause focus. **Les rondes du soir** (nouveau en 2.2) : en plus de ces visites libres, un chat passe à 17 h, 18 h, 19 h, 20 h et 21 h pour suggérer, avec humour et un peu plus fermement à chaque heure, qu'il est temps de songer à arrêter de travailler. Une par heure, jamais répétée, et elles respectent les mêmes règles de silence ; une ronde manquée à l'heure pile (aucune page web au premier plan, clavier quitté) est retentée pendant vingt minutes, puis abandonnée. Les chats et le renard ont aussi été redessinés : têtes plus rondes, yeux expressifs, clignements, oreilles qui tressaillent et queue qui bat. Le samedi et le dimanche, le chat de passage change de répertoire : il s'étonne que tu travailles et salue ça comme quelque chose d'original, sur le même ton taquin.
- **Le coucou avant une visio** (suit le même réglage que les animaux de passage) : deux secondes après l'arrivée sur une des pages de visioconférence listées, le chat passe une fois pour glisser une phrase taquine sur la réunion qui commence.
- **Ne pas déranger** : **pendant une visio** (le koala n'apparaît jamais sur les sites listés, par défaut `kmeet.infomaniak.com`, `teams.microsoft.com`, `teams.live.com`, `zoom.us`, `meet.google.com`, et les sous-domaines sont couverts, donc `zoom.us` couvre aussi `us02web.zoom.us`), **quand tu quittes le clavier**, et **pendant un rendez-vous de ton agenda Infomaniak** (désactivé par défaut). La connexion elle-même a sa propre carte, **Agenda Infomaniak**, juste en dessous : connecte-toi avec un jeton Infomaniak limité au seul périmètre `workspace:calendar` (un jeton qui ouvre aussi le mail ou kDrive est refusé, voir Confidentialité), puis **coche les agendas à surveiller**, un ou plusieurs (pro et perso), parmi ceux que tu peux lire, les tiens d'abord, celui par défaut marqué. Leurs événements sont réunis, un événement présent dans deux agendas compte une fois. La carte affiche ensuite les agendas surveillés et le prochain rendez-vous. De retour dans Ne pas déranger, allume l'interrupteur et, dès lors, tout rendez-vous à deux personnes ou plus, toi compris et pas décliné (les journées entières et les événements marqués libres sont ignorés), fait taire les animaux de passage pendant toute sa durée, et l'en-tête affiche « En silence, rendez-vous en cours ». Un rappel d'habitude qui tomberait pendant un tel rendez-vous, ou moins de dix minutes avant, n'est pas perdu mais **décalé au premier creux d'au moins dix minutes**, une minute après son début (une suite de réunions collées est sautée d'un bloc ; sans creux dans les six heures, le rappel est sauté). La même connexion alimente aussi le **temps en réunion** de l'onglet Stats : les réunions à deux ou plus, toi compris et non déclinées, comptées par jour, avec les 90 derniers jours relus une fois au choix de l'agenda. Un second interrupteur dans la carte de l'agenda, **Me prévenir 3 min avant**, fonctionne seul, avec ou sans le silence : trois minutes avant chacun de ces rendez-vous il affiche une bulle dans la page, en bleu avec une étiquette calendrier pour qu'on ne la confonde jamais avec un rappel d'habitude, avec un compte à rebours en direct, un bouton **Rejoindre la visio** quand il a un lien et un bouton **Fermer**, ou une notification du système quand aucune page web n'est au premier plan. La bulle ne disparaît jamais toute seule : elle reste, décompte puis compte les minutes depuis le début, jusqu'à ce que tu la fermes. Aucun des deux rappels ne s'affiche quand l'ordinateur est en veille, verrouillé ou sans activité depuis dix minutes ; l'extension revérifie une minute plus tard et ne l'affiche que si le rendez-vous n'a pas encore commencé. Un troisième interrupteur, **Me prévenir 5 min avant la fin**, fait la même chose cinq minutes avant la fin, en ambre, pour finir à l'heure. Contrairement au silence et au rappel de début, il couvre **tous les événements à horaire** de l'agenda, y compris ceux où tu es seul (un bloc de concentration, un rendez-vous perso) ; seules les journées entières et les invitations déclinées sont ignorées.
- **Prévenir les participants par mail** (nouveau en 2.2, désactivé par défaut) : un quatrième interrupteur dans la carte de l'agenda. Il lui faut un **second jeton, limité au seul périmètre `workspace:mail`**, que la carte te demande quand tu l'allumes (un jeton qui ouvre aussi l'agenda ou kDrive est refusé) ; le jeton de l'agenda continue de lire les participants, le jeton mail ne sert qu'à envoyer. Tu choisis ensuite l'**adresse d'expédition** parmi tes boîtes et leurs alias. Dès lors, la bulle bleue de début montre un bouton **Prévenir**, et la carte de l'agenda aussi quand un rendez-vous commence dans l'heure ou est en cours. Il ouvre un petit volet : trois messages prêts (5 minutes de retard, 10 minutes, absent), les participants en puces retirables avec l'organisateur en tête et toi exclu, l'objet, et le texte complet à relire et modifier. Un seul bouton **Envoyer**, rien ne part avant ce clic, chaque message ne peut partir qu'une fois par rendez-vous, au plus six envois par heure, et une confirmation dit à combien de personnes il est arrivé. Les adresses des participants sont relues à l'ouverture du volet et jamais stockées. **Changer d'agenda** et **Déconnecter l'agenda** sont à un clic.
- **Temps d'écran** : choisis le fuseau horaire qui définit ta journée pour le compteur affiché dans les bulles. Europe/Zurich par défaut, ou **Automatique (navigateur)**.

En bas, **Faire venir le koala** déclenche une apparition immédiate, pratique pour tester, et ignore la pause visio. La version et la date de mise à jour sont rappelées discrètement en dessous.

Onglet **Perso**, dans l'ordre :
- **Objectifs** : tes phrases d'habitude. Ajoute-les une par une, retire avec ×, et glisse la poignée pour les réordonner. Ils reviennent un par un, dans ton ordre. Laisse la liste vide pour utiliser les objectifs fournis. En dessous, **ton objectif par jour** fixe le nombre d'habitudes que tu vises quotidiennement, il pilote les traits du rappel et la ligne pointillée des statistiques. Une fois l'objectif atteint la ligne passe au vert, et chaque habitude de plus ajoute un trait doré et se lit, par exemple, « 5 sur 3 aujourd'hui, +2 en bonus », pour que l'effort supplémentaire compte au lieu de disparaître derrière une barre pleine.
- **Citations** : bascule entre **Les tiennes** et **Fournies**. Ajoute les tiennes sous la forme « Texte | Auteur » (l'auteur est facultatif). **Parcourir les fournies** ouvre la liste complète où tu peux chercher, **masquer** une citation pour que le koala cesse de la dire, ou en **modifier** une, ce qui crée ta version et laisse l'originale intacte.
- **Personnages** : par défaut, deux koalas dessinés à la main en buste, le visage d'abord, avec de vraies oreilles de koala (un bord de fourrure doux et un intérieur clair en duvet) : l'un annonce les rappels et salue à l'arrivée, l'autre partage la citation, yeux mi-clos et brin d'herbe au coin de la bouche. Ils clignent des yeux et tressaillent des oreilles à tour de rôle. Ajoute tes propres fichiers PNG ou GIF animés (fond transparent conseillé). Ils remplacent les koalas fournis, sauf si tu coches **Garder les koalas d'origine**. Clique sur × pour en retirer un. Les images fixes sont redimensionnées pour économiser de la place, et tout reste sur ton appareil.
- **Thème** (nouveau en 2.2) : **Automatique** suit le mode clair ou sombre de ton système, ou force **Clair** ou **Sombre**. Vaut pour le panneau ; les bulles dans les pages gardent leurs couleurs.
- **Animations** : **Automatique** suit le réglage de mouvement réduit de ton système, ou force-les sur **Toujours** ou **Jamais**.

Clique sur **Enregistrer** dans l'un ou l'autre onglet après une modification.

Onglet **Stats**. Choisis une période (aujourd'hui, hier, cette semaine ou la dernière, ce mois ou le dernier, depuis le début) et lis quatre chiffres, chacun avec une ligne de contexte : les habitudes faites comparées à la période précédente, les reportées avec le moment de la journée où tu reportes le plus, et le temps d'écran avec une moyenne par jour, plus, une fois un agenda Infomaniak connecté, ton **temps en réunion** avec le nombre de réunions (et le nombre par semaine dès deux semaines). Des réunions qui se chevauchent, ou la même réunion vue dans deux agendas surveillés, ne comptent qu'une fois. Avec **Compter mes mails** allumé (carte de l'agenda, même boîte que Prévenir par mail), deux tuiles de plus montrent les **mails traités** (lus ou supprimés, avec le nombre de supprimés et de reçus) et les **mails envoyés** avec une moyenne par jour ; seuls les nombres sont lus, jamais un expéditeur, un objet ni un contenu. En dessous, un graphe par jour pour les habitudes (faites et reportées côte à côte) avec ton objectif quotidien en pointillé, un graphe du temps d'écran, un graphe du temps en réunion quand il y en a, un graphe des mails traités et envoyés quand ils sont comptés, et sous l'écran une ligne de cadence (une habitude pour tant d'écran). Les quatre graphes ont la même hauteur, le même en-tête et une légende dès qu'ils montrent deux séries. Sur trois semaines ou plus, une ligne sous le graphe des réunions et une sous celui des mails nomment ton **jour le plus chargé** (la plus forte moyenne, jamais un total), ou disent que la charge est répartie quand aucun jour ne se détache d'au moins 15 %. Puis ta série en cours en barre de progression vers ton record. Les formulations s'adaptent à tes données, donc rien n'affirme un lien qui n'existe pas. Au tout premier lancement, l'onglet montre ce qui va apparaître et quand, plutôt qu'un mur de zéros.

Onglet **Données** :
- **Sauvegarde et restauration** : une seule carte, une seule destination, un **fichier local**. Coche les parties voulues (réglages, objectifs et citations, statistiques, personnages importés, chacune avec son poids, et les **connexions Infomaniak** : tes jetons agenda et mail avec les agendas et l'adresse d'expédition choisis, décochées par défaut) et choisis **fusionner** ou **remplacer** pour la restauration. **Exporter** crée un fichier `.json`, **Importer** le remet en place. Rien n'est envoyé nulle part, et il n'y a pas de sauvegarde automatique : c'est toi qui exportes. Les connexions sont chiffrées avec une phrase secrète d'**au moins 12 caractères** que tu tapes à l'export et à la restauration, et qui n'est jamais enregistrée ; un compteur en direct te dit combien de caractères il manque encore. Les jetons sont protégés par PBKDF2-SHA256 avec 600 000 itérations, puis AES-GCM 256. Un fichier créé avant le 2026-09-29 rend ses réglages de connexion mais jamais ses jetons (ils avaient trop de droits) : colle ensuite de nouveaux jetons à périmètre unique. *(Jusqu'au 2026-09-29, cette carte proposait aussi une sauvegarde kDrive et une sauvegarde automatique quotidienne sur kDrive ; les deux ont disparu.)*
- **Ce que Koala Zen occupe** : une jauge qui répartit ton stockage entre personnages, historique et contenus.
- **Tout reste chez toi** : aucun serveur Koala Zen, tes données restent sur cet appareil, et la sauvegarde est un fichier que tu gardes.
- **Effacer** : l'historique seul, ou tout, réglages, contenus et connexions inclus (tout effacer supprime aussi la clé de chiffrement des jetons). Les deux demandent un second clic de confirmation, pense à exporter avant.

Le koala apparaît sur la page web active, pas sur les pages internes du navigateur (`chrome://`, `about:`…), qui n'autorisent pas les extensions.

---

## Construire les paquets depuis les sources (optionnel)
Les paquets déjà construits sont dans [`download/`](download). Reconstruis-les seulement si tu modifies le code. Un script régénère les deux, dans `dist/` :
```bash
bash build.sh
```
- `dist/koala-zen-chrome.zip` pour Chrome, Edge, Brave ou le Chrome Web Store.
- `dist/koala-zen-firefox.xpi` pour Firefox et addons.mozilla.org, sans aucune erreur, avertissement ou avis au validateur.

Le `manifest.json` du dépôt cible les deux moteurs. Pour Firefox, le script retire la clé `service_worker` propre à Chrome et fixe la version minimale qui comprend `data_collection_permissions`, ce qui garde le rapport AMO tout vert. Le dossier `dist/` est ignoré par Git.

---

## Personnalisation dans le code
- **Citations et messages par défaut** dans `quotes.js` (`KZ_QUOTES` = `{ t, a }`, `KZ_SPORT` = les invitations d'habitude par défaut). La plupart des gens peuvent simplement utiliser les réglages ci-dessus.
- **Personnages par défaut** : les deux koalas sont dessinés en SVG dans `KOALA_SVGS` en tête de `content.js`, un pour le rappel (il salue), un pour la citation (brin d'herbe, yeux mi-clos). Oreilles, yeux et patte qui salue portent des classes que le CSS anime. Modifie le dessin là, aucun fichier image n'intervient.
- **Sites de visioconférence par défaut** : `DEFAULTS.mutedPatterns` dans `background.js` et `popup.js`.

Recharge l'extension après une modification des fichiers.

## Structure du projet
```
manifest.json     manifeste de l'extension (Manifest V3, Chrome + Firefox)
background.js     service worker : planifie les rappels, applique la pause visio,
                  suit le temps d'écran actif et les statistiques quotidiennes,
                  dialogue avec l'API Agenda Infomaniak pour le silence optionnel en
                  rendez-vous et avec l'API Mail Infomaniak pour les fonctions mail optionnelles
content.js        dessine le koala, les bulles et la chorégraphie du rappel
passages.js       les scènes des animaux de passage (chats, et parfois une rencontre avec un renard)
quotes.js         les citations, objectifs et phrases des animaux de passage par défaut
popup.html/js     le panneau à quatre onglets : Réglages, Perso, Stats, Données
build.sh          construit les paquets Chrome (.zip) et Firefox (.xpi)
download/         paquets prêts à installer (Chrome .zip, Firefox .xpi)
images/           le koala d'accueil de l'onboarding (SVG, animé et fixe)
icons/            icônes de la barre d'outils
store-assets/     captures en 3 langues et l'aperçu GitHub
```

## Confidentialité
Par défaut, rien ne quitte le navigateur. Tes réglages (fréquence, activation, liste visio, fuseau horaire choisi, ton compteur de temps d'écran du jour, et les images, citations ou messages que tu ajoutes) sont stockés localement via l'API de stockage du navigateur. La sauvegarde est un fichier que tu exportes et importes toi-même depuis l'onglet Données. Aucun compte, aucun serveur Koala Zen, aucune analyse, aucun suivi. Rien n'est jamais envoyé dans un cloud.

Seules deux fonctions **optionnelles** touchent le réseau, toutes deux vers ton propre compte Infomaniak, avec tes propres jetons, et seulement une fois que tu les allumes :
- La **connexion à l'agenda Infomaniak** (onglet Réglages, carte Agenda Infomaniak), avec un jeton limité au seul périmètre `workspace:calendar`. Tant qu'elle est active, Koala Zen lit les événements des agendas que tu as cochés, de 12 heures en arrière à 36 heures en avant, toutes les cinq minutes, uniquement via `api.infomaniak.com`. Il ne garde localement que le début, la fin, le titre, le nombre de participants et le lien de visio des événements qui comptent comme rendez-vous, plus les minutes en réunion par jour pour l'onglet Stats, pour pouvoir se taire et te prévenir, et il n'en envoie jamais rien ailleurs. Éteindre l'interrupteur ou déconnecter l'agenda vide ce cache. La permission `notifications` ne sert qu'à une chose, le rappel trois minutes avant quand aucune page web n'est au premier plan pour afficher la bulle.
- Les **fonctions mail**, **Prévenir les participants** et **Compter mes mails**, avec un second jeton limité au seul périmètre `workspace:mail`, via `mail.infomaniak.com` (et `api.infomaniak.com` pour la signature de ton adresse). Prévenir crée un brouillon dans ta propre boîte et l'envoie seulement quand tu cliques Envoyer, seulement aux participants que tu as gardés, et n'en garde rien ensuite. Compter mes mails ne lit que le nombre de messages par jour, jamais un expéditeur, un objet ni un contenu.

**Tes jetons.** Crée un jeton par usage dans le Manager Infomaniak, chacun avec un seul périmètre (`workspace:calendar` ou `workspace:mail`) et une date d'expiration. Koala Zen refuse un jeton qui ouvre plus que nécessaire, garde les jetons chiffrés sur ton appareil, ne s'en sert que pour ce dont ses fonctions ont besoin, et ne les montre jamais aux pages web. Ils ne quittent ton appareil que dans un fichier de sauvegarde que tu exportes, si tu choisis de les y mettre, chiffrés avec ta phrase secrète. Pour couper l'accès d'un coup, révoque le jeton dans le Manager, ou utilise **Tout effacer** dans l'onglet Données. Comme toute extension de navigateur, Koala Zen ne peut pas protéger tes jetons d'un logiciel malveillant déjà installé sur ton ordinateur.

**Sécurité.** Les bulles affichées sur les pages web sont tenues à l'écart du site, rien ne part sans un vrai clic de ta part, et un mail ne peut aller qu'aux participants de la réunion. Tu as trouvé un problème de sécurité ? Signale-le en privé, voir [SECURITY.md](SECURITY.md), pas dans une issue publique.

## Licence
MIT. Voir [LICENSE](LICENSE).
