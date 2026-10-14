"use strict";
const fs = require("fs");
const path = require("path");
// Un IndexedDB minimal pour les tests du fond : open (avec version et mise a
// niveau), createObjectStore, transaction, get / put / delete / clear. Les
// valeurs sont copiees comme le ferait le clonage structure d'un vrai
// navigateur, sauf ce qui ne se copie pas (une CryptoKey reste une CryptoKey).
// Chaque fabrique a sa propre memoire : un test = un profil.
function copie(v) {
  if (v === null || typeof v !== "object") return v;
  try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
}
function estCle(v) { return !!(v && typeof v === "object" && v.constructor && v.constructor.name === "CryptoKey"); }
function fakeIndexedDB() {
  const bases = {};
  const plus_tard = (f) => setTimeout(f, 0);
  function requete() { return { result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null }; }
  function assure(nom) { if (!bases[nom]) bases[nom] = { version: 0, stores: {} }; return bases[nom]; }
  function base(nom) {
    const b = bases[nom];
    return {
      objectStoreNames: { contains: (n) => Object.prototype.hasOwnProperty.call(b.stores, n) },
      createObjectStore: (n) => { if (!b.stores[n]) b.stores[n] = new Map(); return {}; },
      close: () => {},
      transaction: (n) => {
        const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
        const map = b.stores[n];
        if (!map) throw new Error("NotFoundError: " + n);
        let attente = 0;
        const fin = () => plus_tard(() => { if (attente === 0 && tx.oncomplete) tx.oncomplete(); });
        tx.objectStore = () => {
          const op = (f) => { const r = requete(); attente++; plus_tard(() => { r.result = f(); attente--; if (r.onsuccess) r.onsuccess(); fin(); }); return r; };
          return {
            get: (k) => op(() => { const v = map.get(k); return estCle(v) ? v : copie(v); }),
            put: (v, k) => op(() => { map.set(k, estCle(v) ? v : copie(v)); return k; }),
            delete: (k) => op(() => { map.delete(k); return undefined; }),
            clear: () => op(() => { map.clear(); return undefined; })
          };
        };
        // Une transaction sans requete se termine quand meme.
        fin();
        return tx;
      }
    };
  }
  return {
    // Pour les tests : le contenu d'un magasin, cree au besoin.
    _contenu: (nom, store) => (bases[nom] && bases[nom].stores[store]) || null,
    _magasin: (nom, store) => { const b = assure(nom); if (!b.stores[store]) b.stores[store] = new Map(); return b.stores[store]; },
    open: (nom, version) => {
      const r = requete();
      plus_tard(() => {
        const b = assure(nom);
        const v = Number(version) || 1;
        r.result = base(nom);
        if (v > b.version) { b.version = v; if (r.onupgradeneeded) r.onupgradeneeded(); }
        if (r.onsuccess) r.onsuccess();
      });
      return r;
    }
  };
}

// Le stockage vu par un test, 2026-10-06. Le fond range certaines cles dans
// un coffre IndexedDB (VAULT_KEYS de background.js) et les autres dans
// storage.local. Les tests continuent d'ecrire et de lire env.store.X : ce
// mandataire aiguille chaque cle vers le bon endroit, et `brut` reste
// exactement ce que voit storage.local, donc ce qu'un script de page verrait.
function cleCoffre(racine) {
  const src = fs.readFileSync(path.join(racine, "background.js"), "utf8");
  const m = src.match(/const VAULT_KEYS = (\[[^\]]*\]);/);
  return m ? JSON.parse(m[1]) : [];
}
function coffreTest(brut, idb, racine) {
  const cles = cleCoffre(racine);
  const map = idb._magasin("kz-secrets", "vault");
  const dans = (k) => typeof k === "string" && cles.indexOf(k) >= 0;
  return new Proxy(brut, {
    get: (t, k) => (dans(k) ? map.get(k) : t[k]),
    set: (t, k, v) => { if (dans(k)) map.set(k, v); else t[k] = v; return true; },
    deleteProperty: (t, k) => { if (dans(k)) map.delete(k); else delete t[k]; return true; },
    has: (t, k) => (dans(k) ? map.has(k) : k in t),
    ownKeys: (t) => Array.from(new Set(Reflect.ownKeys(t).concat(Array.from(map.keys())))),
    getOwnPropertyDescriptor: (t, k) => {
      if (dans(k)) return map.has(k) ? { value: map.get(k), enumerable: true, configurable: true, writable: true } : undefined;
      return Reflect.getOwnPropertyDescriptor(t, k);
    }
  });
}
module.exports = { fakeIndexedDB, coffreTest, cleCoffre };
