// Koala Zen, le fond (2026-11-05 : decoupe par domaine dans fond/).
// Chrome et Brave chargent ce fichier comme service worker : il charge les
// fichiers du fond, dans cet ordre, par importScripts. Firefox les charge
// lui-meme par la liste "scripts" du manifeste, ce fichier en dernier, sans
// importScripts. Les fichiers partagent la meme portee : l'ordre compte pour
// ce qui s'execute au chargement (constantes, ecouteurs).
const KZ_FOND = ["fond/base.js", "fond/animaux.js", "fond/bulle.js", "fond/securite.js", "fond/agenda.js", "fond/reunions.js", "fond/mail.js", "fond/stats-mail.js", "fond/bilan.js"];
if (typeof importScripts === "function") importScripts(...KZ_FOND);
