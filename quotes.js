// Trilingual quote data (French, German, English). Language follows the browser UI locale.
var KZ_LANG = "en";
try {
  if (typeof chrome !== "undefined" && chrome.i18n && chrome.i18n.getUILanguage) { KZ_LANG = chrome.i18n.getUILanguage(); }
  else if (typeof navigator !== "undefined" && navigator.language) { KZ_LANG = navigator.language; }
} catch (e) {}
var KZ_IS_FR = /^fr/i.test(KZ_LANG);
var KZ_IS_DE = /^de/i.test(KZ_LANG);

const KZ_QUOTES_FR = [
  { t: "Trois choses ne se cachent pas longtemps : le soleil, la lune et la vérité.", a: "Bouddha" },
  { t: "La haine ne s'éteint jamais par la haine, mais par l'amour seul.", a: "Bouddha" },
  { t: "Qui se maîtrise lui-même est plus fort que celui qui vainc mille hommes.", a: "Bouddha" },
  { t: "Ne crois rien simplement parce qu'on te le dit ; éprouve-le par toi-même.", a: "Bouddha" },
  { t: "Regarde en toi : tu es à toi-même ton propre refuge.", a: "Bouddha" },
  { t: "La paix vient du dedans ; ne la cherche pas au-dehors.", a: "Bouddha" },
  { t: "Que sert à l'homme de gagner le monde entier, s'il perd son âme ?", a: "Jésus" },
  { t: "Qui veut sauver sa vie la perdra ; qui la donne la trouve.", a: "Jésus" },
  { t: "Ce n'est pas ce qui entre en l'homme qui le souille, mais ce qui en sort.", a: "Jésus" },
  { t: "Le plus grand parmi vous sera celui qui sert.", a: "Jésus" },
  { t: "Pardonne, non pas sept fois, mais sans jamais compter.", a: "Jésus" },
  { t: "La vérité te rendra libre.", a: "Jésus" },
  { t: "Aimez vos ennemis.", a: "Jésus" },
  { t: "Ne rends pas le mal pour le mal.", a: "Jésus" },
  { t: "Ce que tu cherches te cherche aussi.", a: "Rûmî" },
  { t: "Hier, je voulais changer le monde ; aujourd'hui, je me change moi-même.", a: "Rûmî" },
  { t: "La blessure est l'endroit par où la lumière entre en toi.", a: "Rûmî" },
  { t: "Tu n'es pas une goutte dans l'océan : tu es l'océan tout entier dans une goutte.", a: "Rûmî" },
  { t: "Ne te contente pas des récits des autres ; vis ta propre histoire.", a: "Rûmî" },
  { t: "Élève tes mots, pas ta voix : c'est la pluie qui fait pousser les fleurs, pas l'orage.", a: "Rûmî" },
  { t: "Les fils d'Adam sont les membres d'un même corps : blesse l'un, tous souffrent.", a: "Saadi" },
  { t: "Celui qui apprend et n'agit pas laboure sans jamais semer.", a: "Saadi" },
  { t: "La patience change la feuille de mûrier en soie.", a: "Saadi" },
  { t: "Le travail, c'est l'amour rendu visible.", a: "Khalil Gibran" },
  { t: "Tu donnes peu quand tu donnes de tes biens ; c'est en te donnant toi-même que tu donnes vraiment.", a: "Khalil Gibran" },
  { t: "Tenez-vous ensemble, mais pas trop près : le chêne et le cyprès ne poussent pas à l'ombre l'un de l'autre.", a: "Khalil Gibran" },
  { t: "La joie et la tristesse viennent ensemble ; l'une remplit ce que l'autre a creusé.", a: "Khalil Gibran" },
  { t: "Ce qui fait obstacle à l'action fait avancer l'action ; ce qui barre la route devient la route.", a: "Marc Aurèle" },
  { t: "Cesse de discuter de ce que doit être un homme de bien : sois-en un.", a: "Marc Aurèle" },
  { t: "Tu as pouvoir sur ton esprit, pas sur les événements ; comprends-le, et tu trouveras la force.", a: "Marc Aurèle" },
  { t: "La meilleure vengeance, c'est de ne pas ressembler à celui qui t'a blessé.", a: "Marc Aurèle" },
  { t: "Vis chaque instant comme s'il était le dernier : sans théâtre, sans paresse, sans faux-semblant.", a: "Marc Aurèle" },
  { t: "Creuse au-dedans : la source du bien est là, et elle jaillit sans cesse pour qui la dégage.", a: "Marc Aurèle" },
  { t: "Nous souffrons plus souvent en imagination qu'en réalité.", a: "Sénèque" },
  { t: "Ce n'est pas que nous ayons peu de temps : c'est que nous en perdons beaucoup.", a: "Sénèque" },
  { t: "Tant que tu remets la vie à plus tard, elle passe.", a: "Sénèque" },
  { t: "On n'a jamais fini d'apprendre à vivre.", a: "Sénèque" },
  { t: "Ce ne sont pas les choses qui nous troublent, mais l'idée que nous nous en faisons.", a: "Épictète" },
  { t: "Ne demande pas que les choses arrivent comme tu veux ; veuille qu'elles arrivent comme elles arrivent.", a: "Épictète" },
  { t: "Nul n'est libre s'il n'est pas maître de lui-même.", a: "Épictète" },
  { t: "Connaître les autres, c'est savoir ; se connaître soi-même, c'est être éclairé.", a: "Lao Tseu" },
  { t: "Rien au monde n'est plus souple que l'eau, et rien ne vient mieux à bout du dur.", a: "Lao Tseu" },
  { t: "Qui sait qu'il a assez est riche.", a: "Lao Tseu" },
  { t: "Le caractère d'un homme est son destin.", a: "Héraclite" },
  { t: "Peu importe la lenteur, tant que tu ne t'arrêtes pas.", a: "Confucius" },
  { t: "Celui qui a un pourquoi pour vivre peut supporter presque n'importe quel comment.", a: "Nietzsche" },
  { t: "Il faut porter en soi un chaos pour enfanter une étoile qui danse.", a: "Nietzsche" },
  { t: "Deviens ce que tu es.", a: "Nietzsche" },
  { t: "La plus grande chose du monde, c'est de savoir être à soi.", a: "Montaigne" },
  { t: "Je veux que la mort me trouve en train de planter mes choux.", a: "Montaigne" },
  { t: "Tout le malheur des hommes vient d'une seule chose : ne pas savoir rester en repos dans une chambre.", a: "Pascal" },
  { t: "Chaque homme dans sa nuit s'en va vers sa lumière.", a: "Victor Hugo" },
  { t: "Aie de la patience envers tout ce qui reste sans réponse en ton cœur ; apprends à aimer les questions elles-mêmes.", a: "Rilke" },
  { t: "Marcheur, il n'y a pas de chemin : le chemin se fait en marchant.", a: "Antonio Machado" },
  { t: "Un homme est riche à proportion du nombre de choses dont il peut se passer.", a: "Thoreau" },
  { t: "Ce que tu es parle si fort que je n'entends pas ce que tu dis.", a: "Emerson" },
  { t: "Ton temps est compté : ne le gâche pas à vivre la vie d'un autre.", a: "Steve Jobs" },
  { t: "On ne relie les points qu'en regardant en arrière, jamais en avant.", a: "Steve Jobs" },
  { t: "La mort est sans doute la meilleure invention de la vie : elle fait place au neuf.", a: "Steve Jobs" }
];

const KZ_QUOTES_EN = [
  { t: "Three things cannot long stay hidden: the sun, the moon, and the truth.", a: "Buddha" },
  { t: "Hatred is never ended by hatred, but by love alone.", a: "Buddha" },
  { t: "Whoever masters himself is stronger than the one who conquers a thousand men.", a: "Buddha" },
  { t: "Believe nothing merely because you are told it; test it for yourself.", a: "Buddha" },
  { t: "Look within: you are your own refuge.", a: "Buddha" },
  { t: "Peace comes from within; do not seek it without.", a: "Buddha" },
  { t: "What does it profit a man to gain the whole world, yet lose his soul?", a: "Jesus" },
  { t: "Whoever would save his life will lose it; whoever gives it will find it.", a: "Jesus" },
  { t: "It is not what enters a man that defiles him, but what comes out of him.", a: "Jesus" },
  { t: "The greatest among you will be the one who serves.", a: "Jesus" },
  { t: "Forgive, not seven times, but without ever counting.", a: "Jesus" },
  { t: "The truth will set you free.", a: "Jesus" },
  { t: "Love your enemies.", a: "Jesus" },
  { t: "Do not return evil for evil.", a: "Jesus" },
  { t: "What you are seeking is also seeking you.", a: "Rumi" },
  { t: "Yesterday I wanted to change the world; today I change myself.", a: "Rumi" },
  { t: "The wound is the place where the light enters you.", a: "Rumi" },
  { t: "You are not a drop in the ocean: you are the whole ocean in a drop.", a: "Rumi" },
  { t: "Don't settle for others' stories; live your own.", a: "Rumi" },
  { t: "Raise your words, not your voice: it is rain that grows flowers, not thunder.", a: "Rumi" },
  { t: "The children of Adam are limbs of one body: wound one, and all suffer.", a: "Saadi" },
  { t: "Whoever learns and does not act plows without ever sowing.", a: "Saadi" },
  { t: "Patience turns the mulberry leaf into silk.", a: "Saadi" },
  { t: "Work is love made visible.", a: "Kahlil Gibran" },
  { t: "You give little when you give of your possessions; it is when you give of yourself that you truly give.", a: "Kahlil Gibran" },
  { t: "Stand together, but not too close: the oak and the cypress do not grow in each other's shadow.", a: "Kahlil Gibran" },
  { t: "Joy and sorrow come together; one fills what the other has hollowed out.", a: "Kahlil Gibran" },
  { t: "What stands in the way of action advances action; what blocks the road becomes the road.", a: "Marcus Aurelius" },
  { t: "Stop debating what a good man should be: be one.", a: "Marcus Aurelius" },
  { t: "You have power over your mind, not over events; realize this, and you will find strength.", a: "Marcus Aurelius" },
  { t: "The best revenge is not to be like the one who wronged you.", a: "Marcus Aurelius" },
  { t: "Live each moment as if it were your last: without drama, without idleness, without pretense.", a: "Marcus Aurelius" },
  { t: "Dig within: the source of good is there, and it never stops flowing for the one who clears it.", a: "Marcus Aurelius" },
  { t: "We suffer more often in imagination than in reality.", a: "Seneca" },
  { t: "It is not that we have too little time: it is that we waste much of it.", a: "Seneca" },
  { t: "While you put life off, it passes.", a: "Seneca" },
  { t: "We are never done learning how to live.", a: "Seneca" },
  { t: "It is not things that trouble us, but the ideas we form about them.", a: "Epictetus" },
  { t: "Do not ask that things happen as you wish; wish them to happen as they do.", a: "Epictetus" },
  { t: "No one is free who is not master of himself.", a: "Epictetus" },
  { t: "To know others is wisdom; to know yourself is enlightenment.", a: "Lao Tzu" },
  { t: "Nothing in the world is softer than water, yet nothing is better at overcoming the hard.", a: "Lao Tzu" },
  { t: "Whoever knows he has enough is rich.", a: "Lao Tzu" },
  { t: "A man's character is his fate.", a: "Heraclitus" },
  { t: "It does not matter how slowly you go, as long as you do not stop.", a: "Confucius" },
  { t: "He who has a why to live can bear almost any how.", a: "Nietzsche" },
  { t: "One must carry a chaos within to give birth to a dancing star.", a: "Nietzsche" },
  { t: "Become what you are.", a: "Nietzsche" },
  { t: "The greatest thing in the world is to know how to belong to oneself.", a: "Montaigne" },
  { t: "I want death to find me planting my cabbages.", a: "Montaigne" },
  { t: "All of humanity's troubles come from one thing: not knowing how to sit quietly in a room.", a: "Pascal" },
  { t: "Each man in his night goes toward his light.", a: "Victor Hugo" },
  { t: "Be patient toward all that is unresolved in your heart; learn to love the questions themselves.", a: "Rilke" },
  { t: "Wanderer, there is no path: the path is made by walking.", a: "Antonio Machado" },
  { t: "A man is rich in proportion to the number of things he can do without.", a: "Thoreau" },
  { t: "What you are speaks so loudly that I cannot hear what you say.", a: "Emerson" },
  { t: "Your time is limited: don't waste it living someone else's life.", a: "Steve Jobs" },
  { t: "You can only connect the dots looking backward, never forward.", a: "Steve Jobs" },
  { t: "Death is very likely the single best invention of life: it clears out the old.", a: "Steve Jobs" }
];

const KZ_SPORT_FR = [
  "Debout ! 10 squats, ton canapé a besoin d'une pause loin de toi. 🛋️",
  "Étire-toi comme un koala qui sort de 20 h de sieste. 🥱",
  "30 secondes de gainage. Ton futur toi te dira merci (ou pas). 💪",
  "Petite danse de la victoire ! Personne ne regarde… normalement. 🕺",
  "Lève les bras et attrape un eucalyptus imaginaire. 🌿",
  "15 talons-fesses. On se motive, champion·ne ! 🏃",
  "Roule des épaules, tu n'es pas une statue de musée. 🗿",
  "Marche jusqu'à la fenêtre et respire un grand coup. 🌬️",
  "Sautille sur place, mode pop-corn activé. 🍿",
  "Étirement du cou : dis « non » 5 fois, puis « oui » 5 fois. 🙅",
  "Monte un étage… ou fais semblant, mais bouge ! 🪜",
  "Grimpe à ton arbre intérieur : 10 fentes avant. 🌳",
  "Debout, mains vers le ciel : tu es un koala majestueux. 🐨",
  "Micro-pause : 20 secondes sur la pointe des pieds. 🦶",
  "Secoue-toi comme après une bonne sieste au soleil. ☀️",
  "Câlin à toi-même : croise les bras et étire le haut du dos. 🤗",
  "5 grandes respirations, épaules qui descendent, mâchoire relâchée. 😮‍💨",
  "Fais 3 tours de la pièce en marchant fièrement. Tête haute ! 🚶"
];

const KZ_SPORT_EN = [
  "Up! 10 squats, your couch needs a break from you. 🛋️",
  "Stretch like a koala waking from a 20-hour nap. 🥱",
  "30 seconds of plank. Your future self will thank you (or not). 💪",
  "Little victory dance! Nobody's watching… probably. 🕺",
  "Raise your arms and grab an imaginary eucalyptus. 🌿",
  "15 butt kicks. Let's go, champ! 🏃",
  "Roll your shoulders, you're not a museum statue. 🗿",
  "Walk to the window and take a deep breath. 🌬️",
  "Hop in place, popcorn mode on. 🍿",
  "Neck stretch: say “no” 5 times, then “yes” 5 times. 🙅",
  "Climb a floor… or pretend to, but move! 🪜",
  "Climb your inner tree: 10 forward lunges. 🌳",
  "Stand up, hands to the sky: you are a majestic koala. 🐨",
  "Micro-break: 20 seconds on tiptoes. 🦶",
  "Shake it off like after a good nap in the sun. ☀️",
  "Hug yourself: cross your arms and stretch your upper back. 🤗",
  "5 deep breaths, shoulders down, jaw relaxed. 😮‍💨",
  "Take 3 proud laps around the room. Head high! 🚶"
];

const KZ_QUOTES_DE = [
  { t: "Drei Dinge können nicht lange verborgen bleiben: die Sonne, der Mond und die Wahrheit.", a: "Buddha" },
  { t: "Hass wird niemals durch Hass beendet, sondern allein durch Liebe.", a: "Buddha" },
  { t: "Wer sich selbst meistert, ist stärker als jemand, der tausend Männer besiegt.", a: "Buddha" },
  { t: "Glaube nichts nur, weil man es dir sagt; prüfe es selbst.", a: "Buddha" },
  { t: "Schau nach innen: Du bist deine eigene Zuflucht.", a: "Buddha" },
  { t: "Der Friede kommt von innen; suche ihn nicht im Aussen.", a: "Buddha" },
  { t: "Was nützt es dem Menschen, die ganze Welt zu gewinnen und dabei seine Seele zu verlieren?", a: "Jesus" },
  { t: "Wer sein Leben retten will, wird es verlieren; wer es hingibt, wird es finden.", a: "Jesus" },
  { t: "Nicht was in den Menschen hineingeht, macht ihn unrein, sondern was aus ihm herauskommt.", a: "Jesus" },
  { t: "Der Grösste unter euch wird der sein, der dient.", a: "Jesus" },
  { t: "Vergib, nicht sieben Mal, sondern ohne je zu zählen.", a: "Jesus" },
  { t: "Die Wahrheit wird euch frei machen.", a: "Jesus" },
  { t: "Liebt eure Feinde.", a: "Jesus" },
  { t: "Vergilt nicht Böses mit Bösem.", a: "Jesus" },
  { t: "Was du suchst, sucht auch dich.", a: "Rumi" },
  { t: "Gestern wollte ich die Welt verändern; heute verändere ich mich selbst.", a: "Rumi" },
  { t: "Die Wunde ist der Ort, durch den das Licht in dich eintritt.", a: "Rumi" },
  { t: "Du bist kein Tropfen im Ozean: Du bist der ganze Ozean in einem Tropfen.", a: "Rumi" },
  { t: "Gib dich nicht mit den Geschichten anderer zufrieden; lebe deine eigene.", a: "Rumi" },
  { t: "Erhebe deine Worte, nicht deine Stimme: Blumen lässt der Regen wachsen, nicht der Donner.", a: "Rumi" },
  { t: "Die Kinder Adams sind Glieder eines Leibes: Verletze eines, und alle leiden.", a: "Saadi" },
  { t: "Wer lernt und nicht handelt, pflügt, ohne je zu säen.", a: "Saadi" },
  { t: "Geduld verwandelt das Maulbeerblatt in Seide.", a: "Saadi" },
  { t: "Arbeit ist sichtbar gewordene Liebe.", a: "Khalil Gibran" },
  { t: "Du gibst wenig, wenn du von deinem Besitz gibst; erst wenn du von dir selbst gibst, gibst du wahrhaft.", a: "Khalil Gibran" },
  { t: "Steht zusammen, doch nicht zu nah: Die Eiche und die Zypresse wachsen nicht im Schatten der anderen.", a: "Khalil Gibran" },
  { t: "Freude und Leid kommen zusammen; das eine füllt, was das andere ausgehöhlt hat.", a: "Khalil Gibran" },
  { t: "Was dem Handeln im Weg steht, treibt das Handeln voran; was den Weg versperrt, wird zum Weg.", a: "Mark Aurel" },
  { t: "Höre auf zu erörtern, was ein guter Mensch sein soll: Sei einer.", a: "Mark Aurel" },
  { t: "Du hast Macht über deinen Geist, nicht über die Ereignisse; erkenne das, und du wirst Kraft finden.", a: "Mark Aurel" },
  { t: "Die beste Rache ist, nicht so zu sein wie der, der dir Unrecht getan hat.", a: "Mark Aurel" },
  { t: "Lebe jeden Augenblick, als wäre er dein letzter: ohne Theater, ohne Trägheit, ohne Verstellung.", a: "Mark Aurel" },
  { t: "Grabe in dir: Dort ist die Quelle des Guten, und sie hört nie auf zu fliessen für den, der sie freilegt.", a: "Mark Aurel" },
  { t: "Wir leiden häufiger in der Einbildung als in der Wirklichkeit.", a: "Seneca" },
  { t: "Es ist nicht so, dass wir zu wenig Zeit haben: Wir vergeuden vielmehr einen grossen Teil davon.", a: "Seneca" },
  { t: "Während du das Leben aufschiebst, geht es vorüber.", a: "Seneca" },
  { t: "Das Leben zu lernen hört nie auf.", a: "Seneca" },
  { t: "Nicht die Dinge beunruhigen uns, sondern die Vorstellungen, die wir uns von ihnen machen.", a: "Epiktet" },
  { t: "Verlange nicht, dass die Dinge geschehen, wie du willst; wolle, dass sie geschehen, wie sie geschehen.", a: "Epiktet" },
  { t: "Niemand ist frei, der nicht Herr seiner selbst ist.", a: "Epiktet" },
  { t: "Andere zu kennen ist Weisheit; sich selbst zu kennen ist Erleuchtung.", a: "Laotse" },
  { t: "Nichts auf der Welt ist weicher als Wasser, und doch überwindet nichts das Harte besser.", a: "Laotse" },
  { t: "Wer weiss, dass er genug hat, ist reich.", a: "Laotse" },
  { t: "Der Charakter eines Menschen ist sein Schicksal.", a: "Heraklit" },
  { t: "Es ist gleich, wie langsam du gehst, solange du nicht stehen bleibst.", a: "Konfuzius" },
  { t: "Wer ein Warum zum Leben hat, erträgt fast jedes Wie.", a: "Nietzsche" },
  { t: "Man muss ein Chaos in sich tragen, um einen tanzenden Stern gebären zu können.", a: "Nietzsche" },
  { t: "Werde, der du bist.", a: "Nietzsche" },
  { t: "Das Grösste auf der Welt ist es, sich selbst zu gehören.", a: "Montaigne" },
  { t: "Ich will, dass der Tod mich beim Pflanzen meines Kohls findet.", a: "Montaigne" },
  { t: "Das ganze Unglück der Menschen kommt von einer einzigen Sache: nicht ruhig in einem Zimmer bleiben zu können.", a: "Pascal" },
  { t: "Jeder Mensch geht in seiner Nacht auf sein Licht zu.", a: "Victor Hugo" },
  { t: "Sei geduldig gegen alles Ungelöste in deinem Herzen; lerne, die Fragen selbst lieb zu haben.", a: "Rilke" },
  { t: "Wanderer, es gibt keinen Weg: Der Weg entsteht beim Gehen.", a: "Antonio Machado" },
  { t: "Ein Mensch ist reich im Verhältnis zur Zahl der Dinge, die er entbehren kann.", a: "Thoreau" },
  { t: "Was du bist, spricht so laut, dass ich nicht hören kann, was du sagst.", a: "Emerson" },
  { t: "Deine Zeit ist begrenzt: Vergeude sie nicht damit, das Leben eines anderen zu leben.", a: "Steve Jobs" },
  { t: "Die Punkte lassen sich nur rückblickend verbinden, nie im Voraus.", a: "Steve Jobs" },
  { t: "Der Tod ist sehr wahrscheinlich die beste Erfindung des Lebens: Er räumt das Alte weg.", a: "Steve Jobs" }
];

const KZ_SPORT_DE = [
  "Auf! 10 Kniebeugen, dein Sofa braucht eine Pause von dir. 🛋️",
  "Streck dich wie ein Koala nach 20 Stunden Nickerchen. 🥱",
  "30 Sekunden Planke. Dein zukünftiges Ich dankt dir (oder auch nicht). 💪",
  "Kleiner Siegestanz! Niemand schaut zu… wahrscheinlich. 🕺",
  "Streck die Arme hoch und greif nach einem imaginären Eukalyptus. 🌿",
  "15 Fersenläufe. Los geht's, Champion! 🏃",
  "Kreise die Schultern, du bist keine Museumsstatue. 🗿",
  "Geh zum Fenster und atme einmal tief durch. 🌬️",
  "Hüpf auf der Stelle, Popcorn-Modus an. 🍿",
  "Nackendehnung: 5 Mal Nein sagen, dann 5 Mal Ja. 🙅",
  "Steig ein Stockwerk hoch… oder tu so, aber beweg dich! 🪜",
  "Erklimm deinen inneren Baum: 10 Ausfallschritte nach vorne. 🌳",
  "Steh auf, Hände zum Himmel: Du bist ein majestätischer Koala. 🐨",
  "Mini-Pause: 20 Sekunden auf den Zehenspitzen. 🦶",
  "Schüttel dich aus wie nach einem guten Nickerchen in der Sonne. ☀️",
  "Umarme dich selbst: Kreuze die Arme und dehne den oberen Rücken. 🤗",
  "5 tiefe Atemzüge, Schultern locker, Kiefer entspannt. 😮‍💨",
  "Dreh 3 stolze Runden durch den Raum. Kopf hoch! 🚶"
];

// Les huit phrases des animaux de passage. Communes aux deux builds.
// Aucune ne demande quoi que ce soit, aucune ne parle d'habitude ni de
// temps d'ecran. Aucun texte n'est propre a un animal.
const KZ_HELLO_FR = [
  "Coucou, j'espère que tu passes une belle journée",
  "Je passais juste par là, rien à signaler",
  "Tu as l'air occupé, je ne dis rien de plus",
  "Il fait beau quelque part, forcément",
  "Petit passage, pour rien",
  "Bonne fin de journée, sincèrement",
  "Je vais faire un somme, tu devrais essayer",
  "Rien à te demander, juste te dire bonjour"
];
const KZ_HELLO_EN = [
  "Hello there, hope your day is going well",
  "Just passing through, nothing to report",
  "You look busy, I will say no more",
  "The sun is out somewhere, it has to be",
  "A little visit, for no reason at all",
  "Have a lovely rest of your day, truly",
  "I am off for a nap, you should try one",
  "Nothing to ask of you, just saying hello"
];
const KZ_HELLO_DE = [
  "Hallo, ich hoffe, du hast einen schönen Tag",
  "Ich gehe nur vorbei, nichts zu melden",
  "Du siehst beschäftigt aus, ich sage nichts weiter",
  "Irgendwo scheint die Sonne, ganz sicher",
  "Ein kleiner Besuch, ganz ohne Grund",
  "Einen schoenen Tag noch, ganz ehrlich",
  "Ich gehe ein Schläfchen machen, versuch es auch",
  "Ich will nichts von dir, nur hallo sagen"
];

// Les passages de fin de journee, 2026-09-18. Cinq lots, un par heure de
// 17 h a 21 h, quatre phrases chacun. Le ton monte d'heure en heure : a 17 h
// on suggere a peine, a 21 h on insiste franchement, toujours avec humour,
// jamais un reproche. Le chat parle, le texte n'est propre a aucun pelage.
const KZ_EVENING_FR = [
  [
    "17 h. Je dis ça, je dis rien, mais le soleil commence à ranger ses affaires.",
    "Il est 17 h. Le moment idéal pour songer à l'idée de peut-être songer à arrêter.",
    "Petit sondage de 17 h : ton canapé demande si tu passes ce soir.",
    "17 h. Tu as officiellement le droit de faire semblant de ranger ton bureau."
  ],
  [
    "18 h. Là, c'est vraiment le moment. Même ton clavier a les yeux qui piquent.",
    "Il est 18 h. Tu sais ce qui est bien après 18 h ? Tout ce qui n'est pas ce mail.",
    "18 h. Les gens normaux mangent, moi je fais la sieste. Et toi, tu fais quoi ?",
    "18 h. Ton souper ne va pas se cuisiner tout seul. Sauf si tu commandes, mais quand même."
  ],
  [
    "19 h. Rien de ce que tu écris maintenant ne sera aussi bon que demain à 9 h.",
    "Il est 19 h. Ton ordinateur ne te dira jamais bonne soirée. Moi, si. Bonne soirée.",
    "19 h. La journée est finie depuis un moment. Elle t'a laissé un mot : « rentre ».",
    "19 h. Même tes mails ont fini leur journée. Ils dorment dans ta boîte, laisse-les."
  ],
  [
    "20 h. Sérieusement. Je suis un chat et même moi je trouve que ça fait beaucoup.",
    "Il est 20 h. Ton écran a passé plus de temps avec toi que tes proches aujourd'hui.",
    "20 h. Ferme l'ordinateur. Il ne t'en voudra pas. Personne ne t'en voudra.",
    "20 h. Ce que tu fais là peut attendre demain. Ta soirée, non."
  ],
  [
    "21 h. Bon. Je ne bouge pas d'ici tant que tu n'as pas fermé cet onglet.",
    "Il est 21 h. Ce n'est plus du travail, c'est de l'acharnement. Éteins, je te couvre.",
    "21 h. Dernière ronde. Debout, étire-toi, éteins. Demain existe, promis.",
    "21 h. Même les chats de gouttière sont rentrés. À toi maintenant."
  ]
];
const KZ_EVENING_EN = [
  [
    "5 pm. Just saying, but the sun has started packing up its things.",
    "It is 5 pm. The perfect moment to consider the idea of maybe considering stopping.",
    "Quick 5 pm survey: your sofa wants to know if you are coming by tonight.",
    "5 pm. You are officially allowed to pretend you are tidying your desk."
  ],
  [
    "6 pm. Now it really is time. Even your keyboard has tired eyes.",
    "It is 6 pm. You know what is great after 6 pm? Everything that is not this email.",
    "6 pm. Normal people are having dinner, I am having a nap. And you?",
    "6 pm. Dinner will not cook itself. Unless you order in, but still."
  ],
  [
    "7 pm. Nothing you write now will be as good as what you write tomorrow at 9.",
    "It is 7 pm. Your computer will never wish you a good evening. I will. Good evening.",
    "7 pm. The workday ended a while ago. It left you a note: go home.",
    "7 pm. Even your emails have clocked off. They are asleep in your inbox, let them be."
  ],
  [
    "8 pm. Seriously. I am a cat and even I think this is a lot.",
    "It is 8 pm. Your screen has spent more time with you today than your people have.",
    "8 pm. Close the laptop. It will not hold it against you. Nobody will.",
    "8 pm. Whatever this is can wait until tomorrow. Your evening cannot."
  ],
  [
    "9 pm. Right. I am not moving from here until you close this tab.",
    "It is 9 pm. This is not work any more, it is stubbornness. Shut down, I have got your back.",
    "9 pm. Last round. Stand up, stretch, switch off. Tomorrow exists, promise.",
    "9 pm. Even the alley cats have gone home. Your turn."
  ]
];
const KZ_EVENING_DE = [
  [
    "17 Uhr. Ich sag ja nur, aber die Sonne packt langsam ihre Sachen zusammen.",
    "Es ist 17 Uhr. Der ideale Moment, um über die Idee nachzudenken, vielleicht ans Aufhören zu denken.",
    "Kleine Umfrage um 17 Uhr: Dein Sofa fragt, ob du heute Abend vorbeikommst.",
    "17 Uhr. Du darfst jetzt offiziell so tun, als würdest du deinen Schreibtisch aufräumen."
  ],
  [
    "18 Uhr. Jetzt ist es wirklich Zeit. Sogar deine Tastatur hat müde Augen.",
    "Es ist 18 Uhr. Weisst du, was nach 18 Uhr gut ist? Alles, was nicht diese Mail ist.",
    "18 Uhr. Normale Leute essen, ich mache ein Schläfchen. Und du?",
    "18 Uhr. Das Abendessen kocht sich nicht von selbst. Ausser du bestellst, aber trotzdem."
  ],
  [
    "19 Uhr. Nichts, was du jetzt schreibst, wird so gut wie das von morgen um 9.",
    "Es ist 19 Uhr. Dein Computer wünscht dir nie einen schönen Abend. Ich schon. Schönen Abend.",
    "19 Uhr. Der Arbeitstag ist längst vorbei. Er hat dir einen Zettel hinterlassen: geh heim.",
    "19 Uhr. Sogar deine Mails haben Feierabend. Sie schlafen im Postfach, lass sie."
  ],
  [
    "20 Uhr. Im Ernst. Ich bin eine Katze, und selbst ich finde, das ist viel.",
    "Es ist 20 Uhr. Dein Bildschirm hatte heute mehr Zeit mit dir als deine Leute.",
    "20 Uhr. Klapp den Laptop zu. Er nimmt es dir nicht übel. Niemand tut das.",
    "20 Uhr. Was du da machst, kann bis morgen warten. Dein Abend nicht."
  ],
  [
    "21 Uhr. Also gut. Ich rühre mich nicht von hier, bis du diesen Tab schliesst.",
    "Es ist 21 Uhr. Das ist keine Arbeit mehr, das ist Sturheit. Ausschalten, ich halte dir den Rücken frei.",
    "21 Uhr. Letzte Runde. Aufstehen, strecken, ausschalten. Morgen gibt es auch noch, versprochen.",
    "21 Uhr. Sogar die Strassenkatzen sind heim. Jetzt du."
  ]
];

// Le week-end, 2026-09-26. Le samedi et le dimanche, le chat de passage
// s'etonne qu'on travaille, et salue ca comme quelque chose d'original et
// de different. Meme ton drole que les autres phrases, jamais un reproche.
const KZ_WEEKEND_FR = [
  "Un samedi devant l'écran ? Original. Moi je fais la sieste, mais je respecte.",
  "Travailler le week-end, c'est audacieux. Personne ne t'a dit que c'était fermé ?",
  "Tu bosses un dimanche. Soit tu adores ton métier, soit tu as perdu le calendrier. Les deux me vont.",
  "Week-end au bureau, quelle idée. Différente, je te l'accorde. N'oublie pas de sortir.",
  "Je passais voir s'il y avait quelqu'un. Il y a toi. Un week-end. Je note, c'est rare.",
  "Le week-end, les autres dorment. Toi, tu avances. Ça mérite au moins une pause café.",
  "Du travail un jour de repos ? Tu es le chat de gouttière du bureau, j'aime bien.",
  "Bravo pour l'originalité : week-end et clavier. Pense quand même à regarder par la fenêtre."
];
const KZ_WEEKEND_EN = [
  "A Saturday in front of the screen? Original. I nap, but I respect it.",
  "Working on the weekend is bold. Did nobody tell you it was closed?",
  "Working on a Sunday. Either you love your job or you lost the calendar. Both are fine by me.",
  "Weekend at the office, what an idea. A different one, I will give you that. Do go outside.",
  "I came to see if anyone was around. There is you. On a weekend. Noted, that is rare.",
  "On weekends everyone else sleeps. You get ahead. That deserves at least a coffee break.",
  "Work on a day off? You are the alley cat of the office, I like it.",
  "Points for originality: weekend and keyboard. Still, look out of the window now and then."
];
const KZ_WEEKEND_DE = [
  "Ein Samstag vor dem Bildschirm? Originell. Ich mache ein Schläfchen, aber ich respektiere es.",
  "Am Wochenende arbeiten ist mutig. Hat dir niemand gesagt, dass geschlossen ist?",
  "Du arbeitest an einem Sonntag. Entweder liebst du deinen Job, oder du hast den Kalender verloren. Beides passt.",
  "Wochenende im Büro, was für eine Idee. Eine andere, das gebe ich zu. Geh trotzdem mal raus.",
  "Ich wollte sehen, ob jemand da ist. Du bist da. An einem Wochenende. Notiert, das ist selten.",
  "Am Wochenende schlafen die anderen. Du kommst voran. Das verdient mindestens eine Kaffeepause.",
  "Arbeit an einem freien Tag? Du bist die Strassenkatze des Büros, gefällt mir.",
  "Ein Punkt für Originalität: Wochenende und Tastatur. Schau trotzdem mal aus dem Fenster."
];

// Vingt phrases pour le coucou du chat au tout debut d'une visioconference. Ton
// complice comme les piques de relance, jamais culpabilisant, jamais un ordre.
const KZ_MEETING_FR = [
  "Bonne réu, j'espère qu'elle servira à quelque chose.",
  "Si ta réu est trop longue, je n'oublierai pas de te rappeler tes bonnes habitudes.",
  "Je passais avant que ça commence. Garde la caméra sur ton visage, pas sur le plafond.",
  "Une réunion de plus. Ton café aussi mérite une pause, pense à lui.",
  "Je repasserai si ça dépasse l'horaire prévu. Ça dépasse toujours l'horaire prévu.",
  "Bon courage pour la réu. Résiste à l'envie de couper la caméra pour souffler un peu.",
  "Encore une réunion qui aurait pu être un message. Mais bon courage quand même.",
  "Je croise les pattes pour que celle-ci tienne son horaire. Sans grand espoir.",
  "Une réunion de plus sur ton agenda, une habitude de moins sur le mien. On verra qui gagne.",
  "Si tu t'ennuies pendant la réu, pense à moi plutôt qu'à ton téléphone.",
  "Un carton, une réunion, c'est pareil pour moi : je m'installe dedans et je n'en ressors plus.",
  "Je ne toucherai pas à ton clavier pendant la réu, à condition que tu restes sage, toi aussi.",
  "Un chat n'aurait jamais organisé cette réunion. Un miaulement bien placé aurait suffi.",
  "Si on te dit que tu es en sourdine, prends ça comme un signe. Même ton micro voulait faire une sieste.",
  "J'ai neuf vies et aucune n'est assez longue pour cette réunion. Courage, toi qui n'en as qu'une.",
  "Je regarde l'écran avec le même air blasé que toi pendant les tours de table.",
  "Ma réunion à moi dure vingt heures et s'appelle une sieste. La tienne a l'air moins reposante.",
  "Je poursuis un point rouge toute la journée, toi un ordre du jour sans fin. On fait la paire.",
  "Si un objet tombe de ton bureau pendant l'appel, dis-leur que c'est la réunion qui craque.",
  "J'espère que cette réunion aura plus ton attention que moi d'habitude."
];
const KZ_MEETING_EN = [
  "Good luck with the meeting, hope it actually goes somewhere.",
  "If your meeting runs long, I will not forget to remind you about your habits.",
  "Just passing by before it starts. Keep the camera on your face, not the ceiling.",
  "Another meeting. Your coffee deserves a break too, think of it.",
  "I will drop by again if it runs over. It always runs over.",
  "Good luck in there. Resist the urge to turn off your camera for a breather.",
  "Another meeting that could have been a message. Good luck anyway.",
  "Fingers, or paws, crossed this one keeps to schedule. Not holding my breath.",
  "One more meeting on your calendar, one less habit on mine. We will see who wins.",
  "If you get bored in there, think of me instead of your phone.",
  "A cardboard box or a meeting, same thing to me. I climb in and I am not coming out.",
  "I will not touch your keyboard during the call, as long as you behave too.",
  "A cat would never have organised this meeting. One well placed meow would have done the job.",
  "If they tell you that you are on mute, take it as a sign. Even your microphone wanted a nap.",
  "I have nine lives and none of them is long enough for this meeting. Good luck, you only have one.",
  "I stare at the screen with the same unimpressed look you have during the status round.",
  "My version of a meeting lasts twenty hours and is called a nap. Yours looks far less restful.",
  "I chase a red dot all day, you chase an endless agenda. We make quite the pair.",
  "If something falls off your desk mid call, tell them it is the meeting creaking under its own weight.",
  "I hope this meeting gets more of your attention than I usually do."
];
const KZ_MEETING_DE = [
  "Viel Erfolg bei der Sitzung, hoffentlich bringt sie etwas.",
  "Wenn deine Sitzung zu lang wird, vergesse ich deine guten Gewohnheiten nicht.",
  "Ich schaue nur kurz vorbei, bevor es losgeht. Kamera aufs Gesicht, nicht auf die Decke.",
  "Noch eine Sitzung. Dein Kaffee verdient auch eine Pause, denk an ihn.",
  "Ich schaue nochmal vorbei, falls es länger dauert. Es dauert immer länger.",
  "Viel Erfolg da drin. Widerstehe der Versuchung, die Kamera für eine Verschnaufpause auszuschalten.",
  "Noch eine Sitzung, die auch eine Nachricht hätte sein können. Trotzdem viel Erfolg.",
  "Ich drücke die Pfoten, dass diese im Zeitplan bleibt. Ohne grosse Hoffnung.",
  "Eine Sitzung mehr in deinem Kalender, eine Gewohnheit weniger in meinem. Mal sehen, wer gewinnt.",
  "Wenn dir langweilig wird, denk an mich statt an dein Handy.",
  "Ein Karton oder eine Sitzung, für mich dasselbe. Ich steige rein und komme nicht mehr raus.",
  "Ich fasse deine Tastatur während der Sitzung nicht an, solange du dich auch benimmst.",
  "Eine Katze hätte diese Sitzung nie einberufen. Ein passendes Miau hätte gereicht.",
  "Wenn man dir sagt, du bist stumm geschaltet, nimm es als Zeichen. Sogar dein Mikrofon wollte ein Nickerchen.",
  "Ich habe neun Leben, und keins ist lang genug für diese Sitzung. Viel Glück, du hast nur eins.",
  "Ich schaue den Bildschirm mit demselben gelangweilten Blick an wie du bei der Rundfrage.",
  "Meine Version einer Sitzung dauert zwanzig Stunden und heisst Nickerchen. Deine wirkt weniger erholsam.",
  "Ich jage den ganzen Tag einen roten Punkt, du eine endlose Traktandenliste. Wir passen zusammen.",
  "Wenn etwas von deinem Tisch fällt, sag ihnen, das sei die Sitzung, die unter ihrem eigenen Gewicht ächzt.",
  "Ich hoffe, diese Sitzung bekommt mehr von deiner Aufmerksamkeit als ich normalerweise."
];

const KZ_QUOTES = KZ_IS_FR ? KZ_QUOTES_FR : (KZ_IS_DE ? KZ_QUOTES_DE : KZ_QUOTES_EN);
const KZ_SPORT = KZ_IS_FR ? KZ_SPORT_FR : (KZ_IS_DE ? KZ_SPORT_DE : KZ_SPORT_EN);
const KZ_MEETING = KZ_IS_FR ? KZ_MEETING_FR : (KZ_IS_DE ? KZ_MEETING_DE : KZ_MEETING_EN);
const KZ_HELLO = KZ_IS_FR ? KZ_HELLO_FR : (KZ_IS_DE ? KZ_HELLO_DE : KZ_HELLO_EN);
const KZ_EVENING = KZ_IS_FR ? KZ_EVENING_FR : (KZ_IS_DE ? KZ_EVENING_DE : KZ_EVENING_EN);
const KZ_WEEKEND = KZ_IS_FR ? KZ_WEEKEND_FR : (KZ_IS_DE ? KZ_WEEKEND_DE : KZ_WEEKEND_EN);
