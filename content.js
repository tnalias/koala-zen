// "=== true" : un element de la page nomme
// __kzLoaded ne peut pas desactiver le script.
if (globalThis.__kzLoaded !== true) {
  globalThis.__kzLoaded = true;

  (function () {
    const api = globalThis.browser || globalThis.chrome;
    const HOST_ID = "kz-koala-host";

    // Choregraphie unique de la maquette. Le koala glisse du coin et repart par le meme chemin.
    const T = {
      arrive: 240,      // arrivee du koala
      bubble: 180,      // ouverture de la bulle
      line: 60,         // decalage entre lignes
      check: 300,       // coche de validation
      hold: 1200,       // temps de lecture avant la sortie
      leave: 200,       // sortie
      quote: 260,       // montee de la citation
      swap: 200,        // fondu croise entre reponses
      reduced: 120      // tout se resume a ce fondu si le mouvement est reduit
    };

    // Les deux koalas par defaut, redessines le 2026-09-26 : en buste, le
    // visage d'abord. Oreilles de vrai koala, un bord de fourrure fin et
    // irregulier et un interieur clair a meches, jamais des lobes de fleur.
    // Ombrages doux en degrades. Le koala du rappel salue de la patte a
    // l'arrivee ; celui de la citation a les yeux mi-clos et un brin d'herbe
    // au coin de la bouche. Seuls les yeux (g.kz-eyes) et les oreilles
    // (g.kz-ear) vivent en continu, choix de Thomas. Les images de
    // l'utilisateur restent possibles et prennent leur place.
    const KOALA_SVGS = {
      reminder: `<svg class="kz-svg" viewBox="-8 -6 216 186" aria-hidden="true"><defs><radialGradient id="kzHeadreminder" cx="45%" cy="35%" r="70%"><stop offset="0%" stop-color="#D5DBE0"/><stop offset="70%" stop-color="#B7C0C8"/><stop offset="100%" stop-color="#8E99A3"/></radialGradient><radialGradient id="kzEarFur" cx="50%" cy="45%" r="60%"><stop offset="0%" stop-color="#B7C0C8"/><stop offset="100%" stop-color="#8E99A3"/></radialGradient><radialGradient id="kzEarIn" cx="50%" cy="60%" r="65%"><stop offset="0%" stop-color="#C7B4AD"/><stop offset="60%" stop-color="#DCCDC7"/><stop offset="100%" stop-color="#F1EAE7"/></radialGradient><linearGradient id="kzNosereminder" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#555B61"/><stop offset="55%" stop-color="#3A3F44"/><stop offset="100%" stop-color="#23272A"/></linearGradient><radialGradient id="kzBodyreminder" cx="50%" cy="20%" r="80%"><stop offset="0%" stop-color="#B7C0C8"/><stop offset="100%" stop-color="#8E99A3"/></radialGradient></defs><path d="M28 180 C 30 148, 58 132, 100 132 C 142 132, 170 148, 172 180 Z" fill="url(#kzBodyreminder)"/><path d="M72 180 C 74 158, 86 148, 100 148 C 114 148, 126 158, 128 180 Z" fill="#E6EAED"/><g class="kz-ear kz-ear--l"><path d="M79.6 58.0 Q82.1 60.1 81.3 62.2 Q83.1 64.5 79.2 66.0 Q81.8 68.8 79.6 70.4 Q79.3 72.5 77.5 74.1 Q77.2 76.3 75.0 77.5 Q76.1 80.7 73.7 81.7 Q72.8 83.8 69.0 83.5 Q69.8 87.2 66.6 87.0 Q65.8 89.5 62.0 88.1 Q62.0 92.0 59.2 91.6 Q57.7 93.4 54.5 91.8 Q53.6 95.5 51.0 94.9 Q49.1 96.5 46.4 94.5 Q44.7 97.8 42.1 94.7 Q40.0 97.0 37.7 97.7 Q35.3 97.9 33.2 96.2 Q30.8 96.6 29.5 93.1 Q26.4 95.3 25.4 92.0 Q21.7 94.7 21.7 90.0 Q17.6 92.5 16.9 89.6 Q13.7 90.0 13.6 86.8 Q10.4 86.9 9.5 84.8 Q7.1 83.9 6.5 81.6 Q3.9 80.7 6.5 76.7 Q2.4 76.5 3.0 73.9 Q0.8 72.5 1.7 70.0 Q-1.4 68.7 -0.0 66.2 Q-2.1 64.4 -0.0 62.0 Q-2.5 60.1 -1.1 58.0 Q-3.4 55.8 0.8 54.0 Q-2.0 51.6 -1.5 49.5 Q-1.4 47.4 1.8 46.1 Q0.5 43.4 1.9 41.7 Q1.8 39.2 3.5 37.6 Q4.5 35.7 7.3 35.0 Q7.5 32.4 9.7 31.4 Q10.3 28.9 12.8 28.3 Q14.1 26.4 16.6 26.1 Q17.7 23.7 21.2 25.1 Q21.8 21.5 25.2 23.5 Q26.4 20.6 29.5 22.8 Q30.9 19.6 33.5 21.2 Q35.3 17.8 37.7 18.2 Q40.0 19.0 42.2 19.8 Q44.6 19.1 46.6 20.9 Q49.3 18.9 50.5 23.0 Q53.6 20.6 55.1 22.9 Q58.3 21.4 59.8 23.5 Q61.7 24.6 64.2 25.0 Q66.0 26.3 65.9 29.8 Q69.3 29.3 70.8 30.9 Q72.9 32.1 71.2 36.0 Q74.9 36.0 75.3 38.3 Q77.4 39.6 77.3 42.0 Q79.4 43.4 77.6 46.3 Q81.7 47.3 79.7 49.9 Q82.7 51.5 79.2 54.0 Q82.1 55.9 79.6 58.0 Z" fill="#DCE1E5"/><path d="M74.7 58.0 Q77.3 60.2 74.5 62.0 Q76.8 64.4 76.1 66.5 Q75.3 68.5 74.0 70.3 Q73.6 72.5 71.6 73.9 Q72.3 76.8 68.9 77.3 Q68.8 79.8 66.2 80.5 Q65.4 82.8 62.5 82.9 Q62.2 86.0 59.4 86.0 Q58.0 88.0 55.6 88.4 Q53.6 89.5 50.9 88.8 Q49.4 91.6 46.6 89.6 Q44.8 92.8 42.3 91.6 Q40.0 92.5 37.7 91.0 Q35.2 92.6 33.4 89.7 Q30.6 91.6 29.0 89.1 Q25.9 90.6 24.9 87.4 Q22.1 87.8 20.7 85.9 Q17.9 85.9 17.4 83.0 Q14.1 83.3 12.8 81.4 Q10.6 80.3 11.4 77.0 Q7.7 76.8 7.6 74.3 Q5.5 72.9 7.3 69.9 Q4.1 68.7 6.1 66.0 Q2.4 64.6 5.2 62.0 Q1.8 60.2 4.6 58.0 Q2.4 55.8 4.2 53.8 Q2.6 51.5 4.4 49.6 Q4.9 47.5 7.6 46.2 Q5.9 43.3 7.5 41.6 Q8.4 39.6 10.8 38.5 Q10.8 35.8 13.5 35.2 Q14.2 32.8 16.7 32.2 Q17.7 29.8 20.0 29.2 Q21.5 27.2 24.5 27.9 Q26.1 25.9 28.5 25.6 Q30.5 24.2 33.1 24.8 Q35.3 23.9 37.8 26.2 Q40.0 23.3 42.2 25.9 Q44.8 23.5 46.7 25.9 Q49.4 24.5 51.1 26.8 Q53.7 26.2 54.8 29.2 Q57.9 28.1 58.7 31.0 Q61.7 30.6 63.4 32.1 Q65.3 33.3 66.0 35.6 Q69.5 35.6 69.0 38.7 Q72.2 39.3 71.5 42.1 Q74.2 43.2 74.6 45.4 Q75.1 47.5 75.4 49.7 Q77.1 51.5 76.2 53.8 Q77.7 55.8 74.7 58.0 Z" fill="url(#kzEarFur)"/><path d="M57.3 64.0 Q58.9 65.9 58.4 67.8 Q58.0 69.6 55.8 70.9 Q56.9 73.3 55.6 74.8 Q54.5 76.5 53.0 77.8 Q52.0 79.5 50.1 80.4 Q49.0 82.3 46.2 81.8 Q45.2 83.9 43.2 84.6 Q41.1 84.9 38.8 83.9 Q37.1 85.9 35.0 85.3 Q32.9 85.7 30.9 85.1 Q28.8 85.2 27.1 83.9 Q24.7 84.1 23.7 81.8 Q21.2 82.0 19.6 80.8 Q17.9 79.6 17.8 77.2 Q15.3 76.6 14.6 74.7 Q13.1 73.3 13.1 71.3 Q11.8 69.7 12.7 67.6 Q11.3 65.9 11.9 64.0 Q10.7 62.1 11.4 60.2 Q11.7 58.3 12.6 56.6 Q13.1 54.7 15.2 53.5 Q15.3 51.4 16.7 50.0 Q17.9 48.4 20.7 48.4 Q21.0 45.7 23.3 45.5 Q24.7 43.8 27.3 44.6 Q28.9 43.2 31.2 44.3 Q32.9 41.9 35.0 42.2 Q37.1 42.5 38.9 43.9 Q41.3 42.7 42.9 44.2 Q45.2 44.0 46.5 45.8 Q49.0 45.7 49.2 48.6 Q52.1 48.3 53.2 50.1 Q55.0 51.2 55.3 53.3 Q57.0 54.6 56.0 57.0 Q58.0 58.4 56.7 60.5 Q59.1 62.1 57.3 64.0 Z" fill="url(#kzEarIn)"/><path d="M39.5 73.0 Q35.0 64.6 40.5 52.2 M34.5 75.0 Q28.6 63.6 32.7 48.2 M29.5 75.0 Q22.6 66.2 25.8 53.5 M24.5 73.0 Q19.5 69.0 24.4 61.0 " stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.6"/></g><g class="kz-ear kz-ear--r"><path d="M202.0 58.0 Q203.3 60.2 200.3 62.1 Q201.9 64.4 200.4 66.2 Q201.6 68.7 198.0 69.9 Q199.2 72.5 196.9 73.8 Q197.2 76.3 194.0 77.0 Q195.8 80.5 193.4 81.5 Q192.9 83.9 190.8 85.1 Q189.7 87.1 186.3 86.7 Q185.9 89.6 184.1 90.9 Q182.5 92.6 178.7 90.7 Q178.1 94.3 174.7 92.1 Q173.7 95.7 170.7 93.8 Q169.3 97.2 166.7 95.7 Q164.7 97.8 162.2 94.9 Q160.0 98.3 157.8 94.8 Q155.3 97.9 153.1 97.3 Q150.9 96.3 149.2 93.9 Q146.3 95.7 145.4 92.1 Q142.2 93.7 141.1 91.0 Q138.1 91.7 137.9 88.2 Q134.3 89.3 134.0 86.4 Q130.8 86.6 130.6 83.8 Q126.9 84.0 126.0 82.0 Q123.9 80.7 123.4 78.4 Q121.7 76.8 121.3 74.6 Q120.5 72.6 119.4 70.7 Q119.0 68.6 120.7 66.0 Q117.1 64.5 120.5 62.0 Q117.8 60.1 119.2 58.0 Q116.5 55.8 120.3 54.0 Q118.3 51.7 121.0 50.1 Q119.3 47.5 121.1 45.8 Q120.2 43.3 124.1 42.6 Q121.7 39.2 126.0 39.1 Q124.8 35.9 128.7 35.9 Q126.7 31.8 129.2 31.0 Q130.6 29.2 133.6 29.2 Q134.4 26.8 136.3 25.6 Q138.2 24.4 140.2 23.5 Q141.8 21.5 144.3 21.4 Q146.3 20.3 149.0 21.2 Q150.8 19.3 153.3 20.0 Q155.4 18.9 157.7 18.9 Q160.0 17.5 162.2 21.2 Q164.6 18.8 166.3 22.4 Q169.3 18.9 170.8 21.8 Q173.5 21.0 175.2 22.7 Q178.0 21.9 179.3 24.3 Q181.9 24.3 182.4 27.4 Q186.0 26.3 185.3 30.4 Q188.9 29.7 189.8 31.8 Q193.2 31.9 192.4 35.2 Q195.1 35.9 195.8 38.0 Q197.8 39.4 198.7 41.4 Q199.5 43.4 200.7 45.3 Q200.6 47.6 199.9 49.9 Q202.0 51.6 201.1 53.9 Q203.2 55.8 202.0 58.0 Z" fill="#DCE1E5"/><path d="M194.8 58.0 Q197.5 60.2 195.3 62.1 Q196.6 64.4 194.7 66.2 Q195.2 68.5 194.1 70.4 Q194.3 72.8 192.7 74.5 Q191.9 76.6 188.7 77.1 Q189.3 80.2 186.5 80.9 Q186.1 83.5 183.0 83.5 Q181.7 85.4 179.3 85.9 Q178.0 88.0 175.7 88.6 Q173.8 90.0 170.8 88.5 Q169.2 90.9 166.7 90.4 Q164.7 92.0 162.3 91.1 Q160.0 92.9 157.8 90.7 Q155.3 91.8 153.2 90.6 Q150.6 91.5 149.2 88.4 Q146.4 89.5 145.1 87.0 Q142.2 87.7 140.7 85.9 Q138.1 85.7 136.7 83.8 Q134.1 83.3 133.1 81.2 Q130.7 80.2 130.9 77.3 Q128.7 76.2 129.2 73.5 Q125.8 72.7 127.6 69.8 Q124.0 68.7 126.1 66.0 Q123.1 64.4 124.0 62.2 Q122.3 60.2 124.6 58.0 Q122.8 55.9 125.2 54.0 Q123.6 51.6 124.1 49.6 Q124.9 47.5 127.1 46.1 Q125.5 43.1 127.4 41.6 Q127.7 39.2 129.9 38.0 Q131.1 36.1 133.8 35.5 Q133.8 32.5 137.6 33.2 Q138.2 30.5 141.1 30.6 Q142.0 27.9 144.2 27.2 Q146.1 25.9 148.6 25.8 Q150.7 24.7 153.5 26.8 Q155.4 24.3 157.8 25.5 Q160.0 24.1 162.3 24.0 Q164.8 23.3 167.0 24.5 Q169.5 24.0 171.1 26.6 Q173.8 26.0 175.2 28.4 Q178.1 27.8 178.9 30.8 Q182.2 30.0 182.6 33.0 Q185.5 33.1 186.9 34.8 Q189.4 35.7 188.2 39.2 Q191.2 39.9 191.3 42.2 Q194.1 43.3 193.5 45.8 Q195.7 47.4 194.9 49.8 Q197.1 51.5 196.9 53.7 Q197.6 55.8 194.8 58.0 Z" fill="url(#kzEarFur)"/><path d="M187.8 64.0 Q188.8 65.9 187.5 67.6 Q188.6 69.8 186.1 71.0 Q186.9 73.3 184.7 74.4 Q184.9 76.7 182.6 77.5 Q181.9 79.4 180.4 80.7 Q179.0 82.2 176.9 82.9 Q175.3 84.2 172.7 83.4 Q171.3 85.4 169.0 84.6 Q167.1 86.0 165.0 85.6 Q162.9 85.6 161.1 84.0 Q158.8 85.2 157.3 83.4 Q155.0 83.6 153.4 82.4 Q151.4 81.7 150.5 79.8 Q147.9 79.7 148.1 77.0 Q145.4 76.5 144.3 74.9 Q143.0 73.4 144.0 71.0 Q142.0 69.6 142.2 67.7 Q141.3 65.9 141.3 64.0 Q140.9 62.1 143.4 60.5 Q141.5 58.2 143.4 56.8 Q143.6 54.9 145.6 53.8 Q145.7 51.6 147.3 50.4 Q148.3 48.7 150.3 48.0 Q151.4 46.2 154.0 46.5 Q154.8 44.0 157.0 43.9 Q158.7 42.6 160.9 42.7 Q162.9 42.3 165.0 42.2 Q167.1 41.7 169.1 43.0 Q171.2 43.0 172.9 44.1 Q175.3 43.8 176.1 46.4 Q179.0 45.7 179.5 48.2 Q181.8 48.6 182.4 50.7 Q184.5 51.5 184.5 53.7 Q186.4 54.9 186.9 56.7 Q187.8 58.4 187.5 60.4 Q189.2 62.1 187.8 64.0 Z" fill="url(#kzEarIn)"/><path d="M160.5 73.0 Q165.0 64.6 159.5 52.2 M165.5 75.0 Q171.4 63.6 167.3 48.2 M170.5 75.0 Q177.4 66.2 174.2 53.5 M175.5 73.0 Q180.5 69.0 175.6 61.0 " stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.6"/></g><ellipse cx="100" cy="86" rx="66" ry="58" fill="url(#kzHeadreminder)"/><ellipse cx="100" cy="112" rx="34" ry="24" fill="#E6EAED" opacity="0.7"/><ellipse cx="54" cy="108" rx="13" ry="8" fill="#F2AE9A" opacity="0.7"/><ellipse cx="146" cy="108" rx="13" ry="8" fill="#F2AE9A" opacity="0.7"/><g class="kz-eyes"><ellipse cx="68" cy="84" rx="10" ry="11.5" fill="#2F3438"/><circle cx="64.5" cy="79.5" r="3.8" fill="#FFFFFF"/><circle cx="72" cy="87.5" r="1.8" fill="#FFFFFF" opacity="0.85"/></g><g class="kz-eyes"><ellipse cx="132" cy="84" rx="10" ry="11.5" fill="#2F3438"/><circle cx="128.5" cy="79.5" r="3.8" fill="#FFFFFF"/><circle cx="136" cy="87.5" r="1.8" fill="#FFFFFF" opacity="0.85"/></g><path d="M100 80 C 118 80, 124 96, 122 110 C 120 124, 110 130, 100 130 C 90 130, 80 124, 78 110 C 76 96, 82 80, 100 80 Z" fill="url(#kzNosereminder)"/><ellipse cx="92" cy="92" rx="6" ry="4" fill="#FFFFFF" opacity="0.28"/><path d="M91 124 q3 3 6 0 M103 124 q3 3 6 0" stroke="#1B1E21" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/><path d="M88 137 q12 11 24 0" stroke="#2F3438" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M96 140 q4 6 8 0" fill="#D98282"/><g class="kz-paw"><path d="M150 180 C 150 160, 160 138, 172 124 C 178 118, 188 122, 186 130 C 184 146, 176 164, 176 180 Z" fill="#8E99A3"/><ellipse cx="180" cy="124" rx="14" ry="13" fill="#B7C0C8"/><path d="M172 114 l-2 -7 M180 112 l0 -8 M188 115 l3 -7" stroke="#6F7A84" stroke-width="3.2" stroke-linecap="round"/></g></svg>`,
      quote: `<svg class="kz-svg" viewBox="-8 -6 216 186" aria-hidden="true"><defs><radialGradient id="kzHeadquote" cx="45%" cy="35%" r="70%"><stop offset="0%" stop-color="#D5DBE0"/><stop offset="70%" stop-color="#B7C0C8"/><stop offset="100%" stop-color="#8E99A3"/></radialGradient><radialGradient id="kzEarFur" cx="50%" cy="45%" r="60%"><stop offset="0%" stop-color="#B7C0C8"/><stop offset="100%" stop-color="#8E99A3"/></radialGradient><radialGradient id="kzEarIn" cx="50%" cy="60%" r="65%"><stop offset="0%" stop-color="#C7B4AD"/><stop offset="60%" stop-color="#DCCDC7"/><stop offset="100%" stop-color="#F1EAE7"/></radialGradient><linearGradient id="kzNosequote" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#555B61"/><stop offset="55%" stop-color="#3A3F44"/><stop offset="100%" stop-color="#23272A"/></linearGradient><radialGradient id="kzBodyquote" cx="50%" cy="20%" r="80%"><stop offset="0%" stop-color="#B7C0C8"/><stop offset="100%" stop-color="#8E99A3"/></radialGradient></defs><path d="M28 180 C 30 148, 58 132, 100 132 C 142 132, 170 148, 172 180 Z" fill="url(#kzBodyquote)"/><path d="M72 180 C 74 158, 86 148, 100 148 C 114 148, 126 158, 128 180 Z" fill="#E6EAED"/><g class="kz-ear kz-ear--l"><path d="M79.6 58.0 Q82.1 60.1 81.3 62.2 Q83.1 64.5 79.2 66.0 Q81.8 68.8 79.6 70.4 Q79.3 72.5 77.5 74.1 Q77.2 76.3 75.0 77.5 Q76.1 80.7 73.7 81.7 Q72.8 83.8 69.0 83.5 Q69.8 87.2 66.6 87.0 Q65.8 89.5 62.0 88.1 Q62.0 92.0 59.2 91.6 Q57.7 93.4 54.5 91.8 Q53.6 95.5 51.0 94.9 Q49.1 96.5 46.4 94.5 Q44.7 97.8 42.1 94.7 Q40.0 97.0 37.7 97.7 Q35.3 97.9 33.2 96.2 Q30.8 96.6 29.5 93.1 Q26.4 95.3 25.4 92.0 Q21.7 94.7 21.7 90.0 Q17.6 92.5 16.9 89.6 Q13.7 90.0 13.6 86.8 Q10.4 86.9 9.5 84.8 Q7.1 83.9 6.5 81.6 Q3.9 80.7 6.5 76.7 Q2.4 76.5 3.0 73.9 Q0.8 72.5 1.7 70.0 Q-1.4 68.7 -0.0 66.2 Q-2.1 64.4 -0.0 62.0 Q-2.5 60.1 -1.1 58.0 Q-3.4 55.8 0.8 54.0 Q-2.0 51.6 -1.5 49.5 Q-1.4 47.4 1.8 46.1 Q0.5 43.4 1.9 41.7 Q1.8 39.2 3.5 37.6 Q4.5 35.7 7.3 35.0 Q7.5 32.4 9.7 31.4 Q10.3 28.9 12.8 28.3 Q14.1 26.4 16.6 26.1 Q17.7 23.7 21.2 25.1 Q21.8 21.5 25.2 23.5 Q26.4 20.6 29.5 22.8 Q30.9 19.6 33.5 21.2 Q35.3 17.8 37.7 18.2 Q40.0 19.0 42.2 19.8 Q44.6 19.1 46.6 20.9 Q49.3 18.9 50.5 23.0 Q53.6 20.6 55.1 22.9 Q58.3 21.4 59.8 23.5 Q61.7 24.6 64.2 25.0 Q66.0 26.3 65.9 29.8 Q69.3 29.3 70.8 30.9 Q72.9 32.1 71.2 36.0 Q74.9 36.0 75.3 38.3 Q77.4 39.6 77.3 42.0 Q79.4 43.4 77.6 46.3 Q81.7 47.3 79.7 49.9 Q82.7 51.5 79.2 54.0 Q82.1 55.9 79.6 58.0 Z" fill="#DCE1E5"/><path d="M74.7 58.0 Q77.3 60.2 74.5 62.0 Q76.8 64.4 76.1 66.5 Q75.3 68.5 74.0 70.3 Q73.6 72.5 71.6 73.9 Q72.3 76.8 68.9 77.3 Q68.8 79.8 66.2 80.5 Q65.4 82.8 62.5 82.9 Q62.2 86.0 59.4 86.0 Q58.0 88.0 55.6 88.4 Q53.6 89.5 50.9 88.8 Q49.4 91.6 46.6 89.6 Q44.8 92.8 42.3 91.6 Q40.0 92.5 37.7 91.0 Q35.2 92.6 33.4 89.7 Q30.6 91.6 29.0 89.1 Q25.9 90.6 24.9 87.4 Q22.1 87.8 20.7 85.9 Q17.9 85.9 17.4 83.0 Q14.1 83.3 12.8 81.4 Q10.6 80.3 11.4 77.0 Q7.7 76.8 7.6 74.3 Q5.5 72.9 7.3 69.9 Q4.1 68.7 6.1 66.0 Q2.4 64.6 5.2 62.0 Q1.8 60.2 4.6 58.0 Q2.4 55.8 4.2 53.8 Q2.6 51.5 4.4 49.6 Q4.9 47.5 7.6 46.2 Q5.9 43.3 7.5 41.6 Q8.4 39.6 10.8 38.5 Q10.8 35.8 13.5 35.2 Q14.2 32.8 16.7 32.2 Q17.7 29.8 20.0 29.2 Q21.5 27.2 24.5 27.9 Q26.1 25.9 28.5 25.6 Q30.5 24.2 33.1 24.8 Q35.3 23.9 37.8 26.2 Q40.0 23.3 42.2 25.9 Q44.8 23.5 46.7 25.9 Q49.4 24.5 51.1 26.8 Q53.7 26.2 54.8 29.2 Q57.9 28.1 58.7 31.0 Q61.7 30.6 63.4 32.1 Q65.3 33.3 66.0 35.6 Q69.5 35.6 69.0 38.7 Q72.2 39.3 71.5 42.1 Q74.2 43.2 74.6 45.4 Q75.1 47.5 75.4 49.7 Q77.1 51.5 76.2 53.8 Q77.7 55.8 74.7 58.0 Z" fill="url(#kzEarFur)"/><path d="M57.3 64.0 Q58.9 65.9 58.4 67.8 Q58.0 69.6 55.8 70.9 Q56.9 73.3 55.6 74.8 Q54.5 76.5 53.0 77.8 Q52.0 79.5 50.1 80.4 Q49.0 82.3 46.2 81.8 Q45.2 83.9 43.2 84.6 Q41.1 84.9 38.8 83.9 Q37.1 85.9 35.0 85.3 Q32.9 85.7 30.9 85.1 Q28.8 85.2 27.1 83.9 Q24.7 84.1 23.7 81.8 Q21.2 82.0 19.6 80.8 Q17.9 79.6 17.8 77.2 Q15.3 76.6 14.6 74.7 Q13.1 73.3 13.1 71.3 Q11.8 69.7 12.7 67.6 Q11.3 65.9 11.9 64.0 Q10.7 62.1 11.4 60.2 Q11.7 58.3 12.6 56.6 Q13.1 54.7 15.2 53.5 Q15.3 51.4 16.7 50.0 Q17.9 48.4 20.7 48.4 Q21.0 45.7 23.3 45.5 Q24.7 43.8 27.3 44.6 Q28.9 43.2 31.2 44.3 Q32.9 41.9 35.0 42.2 Q37.1 42.5 38.9 43.9 Q41.3 42.7 42.9 44.2 Q45.2 44.0 46.5 45.8 Q49.0 45.7 49.2 48.6 Q52.1 48.3 53.2 50.1 Q55.0 51.2 55.3 53.3 Q57.0 54.6 56.0 57.0 Q58.0 58.4 56.7 60.5 Q59.1 62.1 57.3 64.0 Z" fill="url(#kzEarIn)"/><path d="M39.5 73.0 Q35.0 64.6 40.5 52.2 M34.5 75.0 Q28.6 63.6 32.7 48.2 M29.5 75.0 Q22.6 66.2 25.8 53.5 M24.5 73.0 Q19.5 69.0 24.4 61.0 " stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.6"/></g><g class="kz-ear kz-ear--r"><path d="M202.0 58.0 Q203.3 60.2 200.3 62.1 Q201.9 64.4 200.4 66.2 Q201.6 68.7 198.0 69.9 Q199.2 72.5 196.9 73.8 Q197.2 76.3 194.0 77.0 Q195.8 80.5 193.4 81.5 Q192.9 83.9 190.8 85.1 Q189.7 87.1 186.3 86.7 Q185.9 89.6 184.1 90.9 Q182.5 92.6 178.7 90.7 Q178.1 94.3 174.7 92.1 Q173.7 95.7 170.7 93.8 Q169.3 97.2 166.7 95.7 Q164.7 97.8 162.2 94.9 Q160.0 98.3 157.8 94.8 Q155.3 97.9 153.1 97.3 Q150.9 96.3 149.2 93.9 Q146.3 95.7 145.4 92.1 Q142.2 93.7 141.1 91.0 Q138.1 91.7 137.9 88.2 Q134.3 89.3 134.0 86.4 Q130.8 86.6 130.6 83.8 Q126.9 84.0 126.0 82.0 Q123.9 80.7 123.4 78.4 Q121.7 76.8 121.3 74.6 Q120.5 72.6 119.4 70.7 Q119.0 68.6 120.7 66.0 Q117.1 64.5 120.5 62.0 Q117.8 60.1 119.2 58.0 Q116.5 55.8 120.3 54.0 Q118.3 51.7 121.0 50.1 Q119.3 47.5 121.1 45.8 Q120.2 43.3 124.1 42.6 Q121.7 39.2 126.0 39.1 Q124.8 35.9 128.7 35.9 Q126.7 31.8 129.2 31.0 Q130.6 29.2 133.6 29.2 Q134.4 26.8 136.3 25.6 Q138.2 24.4 140.2 23.5 Q141.8 21.5 144.3 21.4 Q146.3 20.3 149.0 21.2 Q150.8 19.3 153.3 20.0 Q155.4 18.9 157.7 18.9 Q160.0 17.5 162.2 21.2 Q164.6 18.8 166.3 22.4 Q169.3 18.9 170.8 21.8 Q173.5 21.0 175.2 22.7 Q178.0 21.9 179.3 24.3 Q181.9 24.3 182.4 27.4 Q186.0 26.3 185.3 30.4 Q188.9 29.7 189.8 31.8 Q193.2 31.9 192.4 35.2 Q195.1 35.9 195.8 38.0 Q197.8 39.4 198.7 41.4 Q199.5 43.4 200.7 45.3 Q200.6 47.6 199.9 49.9 Q202.0 51.6 201.1 53.9 Q203.2 55.8 202.0 58.0 Z" fill="#DCE1E5"/><path d="M194.8 58.0 Q197.5 60.2 195.3 62.1 Q196.6 64.4 194.7 66.2 Q195.2 68.5 194.1 70.4 Q194.3 72.8 192.7 74.5 Q191.9 76.6 188.7 77.1 Q189.3 80.2 186.5 80.9 Q186.1 83.5 183.0 83.5 Q181.7 85.4 179.3 85.9 Q178.0 88.0 175.7 88.6 Q173.8 90.0 170.8 88.5 Q169.2 90.9 166.7 90.4 Q164.7 92.0 162.3 91.1 Q160.0 92.9 157.8 90.7 Q155.3 91.8 153.2 90.6 Q150.6 91.5 149.2 88.4 Q146.4 89.5 145.1 87.0 Q142.2 87.7 140.7 85.9 Q138.1 85.7 136.7 83.8 Q134.1 83.3 133.1 81.2 Q130.7 80.2 130.9 77.3 Q128.7 76.2 129.2 73.5 Q125.8 72.7 127.6 69.8 Q124.0 68.7 126.1 66.0 Q123.1 64.4 124.0 62.2 Q122.3 60.2 124.6 58.0 Q122.8 55.9 125.2 54.0 Q123.6 51.6 124.1 49.6 Q124.9 47.5 127.1 46.1 Q125.5 43.1 127.4 41.6 Q127.7 39.2 129.9 38.0 Q131.1 36.1 133.8 35.5 Q133.8 32.5 137.6 33.2 Q138.2 30.5 141.1 30.6 Q142.0 27.9 144.2 27.2 Q146.1 25.9 148.6 25.8 Q150.7 24.7 153.5 26.8 Q155.4 24.3 157.8 25.5 Q160.0 24.1 162.3 24.0 Q164.8 23.3 167.0 24.5 Q169.5 24.0 171.1 26.6 Q173.8 26.0 175.2 28.4 Q178.1 27.8 178.9 30.8 Q182.2 30.0 182.6 33.0 Q185.5 33.1 186.9 34.8 Q189.4 35.7 188.2 39.2 Q191.2 39.9 191.3 42.2 Q194.1 43.3 193.5 45.8 Q195.7 47.4 194.9 49.8 Q197.1 51.5 196.9 53.7 Q197.6 55.8 194.8 58.0 Z" fill="url(#kzEarFur)"/><path d="M187.8 64.0 Q188.8 65.9 187.5 67.6 Q188.6 69.8 186.1 71.0 Q186.9 73.3 184.7 74.4 Q184.9 76.7 182.6 77.5 Q181.9 79.4 180.4 80.7 Q179.0 82.2 176.9 82.9 Q175.3 84.2 172.7 83.4 Q171.3 85.4 169.0 84.6 Q167.1 86.0 165.0 85.6 Q162.9 85.6 161.1 84.0 Q158.8 85.2 157.3 83.4 Q155.0 83.6 153.4 82.4 Q151.4 81.7 150.5 79.8 Q147.9 79.7 148.1 77.0 Q145.4 76.5 144.3 74.9 Q143.0 73.4 144.0 71.0 Q142.0 69.6 142.2 67.7 Q141.3 65.9 141.3 64.0 Q140.9 62.1 143.4 60.5 Q141.5 58.2 143.4 56.8 Q143.6 54.9 145.6 53.8 Q145.7 51.6 147.3 50.4 Q148.3 48.7 150.3 48.0 Q151.4 46.2 154.0 46.5 Q154.8 44.0 157.0 43.9 Q158.7 42.6 160.9 42.7 Q162.9 42.3 165.0 42.2 Q167.1 41.7 169.1 43.0 Q171.2 43.0 172.9 44.1 Q175.3 43.8 176.1 46.4 Q179.0 45.7 179.5 48.2 Q181.8 48.6 182.4 50.7 Q184.5 51.5 184.5 53.7 Q186.4 54.9 186.9 56.7 Q187.8 58.4 187.5 60.4 Q189.2 62.1 187.8 64.0 Z" fill="url(#kzEarIn)"/><path d="M160.5 73.0 Q165.0 64.6 159.5 52.2 M165.5 75.0 Q171.4 63.6 167.3 48.2 M170.5 75.0 Q177.4 66.2 174.2 53.5 M175.5 73.0 Q180.5 69.0 175.6 61.0 " stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" fill="none" opacity="0.6"/></g><ellipse cx="100" cy="86" rx="66" ry="58" fill="url(#kzHeadquote)"/><ellipse cx="100" cy="112" rx="34" ry="24" fill="#E6EAED" opacity="0.7"/><ellipse cx="54" cy="108" rx="13" ry="8" fill="#F2AE9A" opacity="0.7"/><ellipse cx="146" cy="108" rx="13" ry="8" fill="#F2AE9A" opacity="0.7"/><g class="kz-eyes"><path d="M58 84 q10 8 20 0" stroke="#2F3438" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M57 81 l-4 -3 M79 81 l4 -3" stroke="#2F3438" stroke-width="2.4" stroke-linecap="round"/></g><g class="kz-eyes"><path d="M122 84 q10 8 20 0" stroke="#2F3438" stroke-width="4.5" fill="none" stroke-linecap="round"/><path d="M121 81 l-4 -3 M143 81 l4 -3" stroke="#2F3438" stroke-width="2.4" stroke-linecap="round"/></g><path d="M100 80 C 118 80, 124 96, 122 110 C 120 124, 110 130, 100 130 C 90 130, 80 124, 78 110 C 76 96, 82 80, 100 80 Z" fill="url(#kzNosequote)"/><ellipse cx="92" cy="92" rx="6" ry="4" fill="#FFFFFF" opacity="0.28"/><path d="M91 124 q3 3 6 0 M103 124 q3 3 6 0" stroke="#1B1E21" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/><path d="M90 138 q10 6 20 0" stroke="#2F3438" stroke-width="3" fill="none" stroke-linecap="round"/><g class="kz-grass"><path d="M110 138 C 132 141, 160 140, 188 118" stroke="#3F8F3A" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M156 139 C 166 140, 180 136, 194 128 C 182 138, 168 142, 156 139 Z" fill="#6DBB52"/><path d="M142 140 C 146 132, 152 126, 160 122 C 156 130, 150 136, 142 140 Z" fill="#6DBB52"/><ellipse cx="190" cy="114" rx="3.6" ry="7.5" transform="rotate(42 190 114)" fill="#B9C97A"/><path d="M186 110 l-4 -3 M192 108 l2 -5 M195 115 l5 -1" stroke="#9FB060" stroke-width="1.5" stroke-linecap="round"/></g></svg>`
    };

    const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }
.kz-koala {
  position: fixed; right: 16px; bottom: 16px; width: auto; height: auto;
  display: flex; align-items: flex-end; gap: 10px;
  pointer-events: auto; cursor: pointer; z-index: 2147483647; will-change: transform, opacity;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #333333;
}
.kz-inner { order: 2; flex: 0 0 auto; display: block; transform-origin: bottom center; }
.kz-koala--sport .kz-inner { animation: kzBounce .5s ease-in-out infinite; }
.kz-photo { display: block; height: auto; width: auto; max-height: 280px; max-width: 280px; pointer-events: none; -webkit-user-drag: none; user-select: none; filter: drop-shadow(0 9px 11px rgba(0,0,0,.22)); animation: kzSway 5.2s ease-in-out infinite; }
.kz-svg { width: auto; height: 150px; display: block; overflow: visible; filter: drop-shadow(0 8px 10px rgba(0,0,0,0.16)); }
/* Module M, planches 06 et 07. Le format du fichier decide du placement.
   Carre et portrait, la bulle reste a gauche. Paysage au dela de 1,3 fois plus
   large que haut, elle passe AU DESSUS, sa pointe se retourne vers le bas et
   elle se decale de 44 px vers la gauche. L'image n'est jamais deformee ni
   recadree, elle est mise a l'echelle pour tenir entierement dans son cadre. */
.kz-koala--land { flex-direction: column; align-items: flex-end; gap: 12px; }
.kz-koala--land .kz-bubble { order: 1; position: relative; transform-origin: bottom right; margin-right: 44px; }
.kz-koala--land .kz-inner { order: 2; }
.kz-koala--land .kz-bubble::after {
  content: ""; position: absolute; left: auto; right: 30px; top: auto; bottom: -7px;
  width: 13px; height: 13px; background: #FFFFFF;
  border-top: none; border-right: 1px solid #E0E0E0;
  border-bottom: 1px solid #E0E0E0; border-left: none;
  border-radius: 0 0 3px 0; transform: rotate(45deg);
}
.kz-photo { border-radius: 16px; }
/* Le koala dessine. Deux choses vivent en continu, et soigneusement :
   - les yeux clignent, vite a la fermeture, un peu plus lentement a la
     reouverture, a des rythmes differents pour les deux koalas ;
   - les oreilles tressaillent a tour de role, pivot a leur base cote tete,
     un petit coup puis un rebond amorti.
   Le koala du rappel salue trois fois a l'arrivee, puis pose la patte. */
.kz-svg .kz-eyes { transform-box: fill-box; transform-origin: 50% 55%; animation: kzBlink 5.2s cubic-bezier(0.3,0,0.2,1) infinite; }
.kz-svg.kz-svg--quote .kz-eyes { animation-duration: 7.4s; animation-delay: 1.2s; }
.kz-svg .kz-ear { transform-box: fill-box; animation: kzEarTwitch 8s cubic-bezier(0.3,0,0.2,1) infinite; }
.kz-svg .kz-ear--l { transform-origin: 82% 82%; }
.kz-svg .kz-ear--r { transform-origin: 18% 82%; animation-name: kzEarTwitchR; animation-delay: 3.1s; }
.kz-svg .kz-paw { transform-box: fill-box; transform-origin: 30% 95%; animation: kzWave 1.4s ease-in-out .5s 3 both; }

.kz-bubble {
  order: 1; flex: 0 0 auto; width: 364px; box-sizing: border-box;
  display: flex; flex-direction: column; gap: 10px;
  background: #FFFFFF; border: 1px solid #E0E0E0; border-radius: 18px; padding: 16px;
  box-shadow: 0 8px 24px rgba(16,24,40,0.14);
  opacity: 0; transform: translateY(8px) scale(.97); transform-origin: bottom right;
  transition: opacity ${T.bubble}ms cubic-bezier(0.2,0,0,1), transform ${T.bubble}ms cubic-bezier(0.2,0,0,1);
}
.kz-bubble.kz-show { opacity: 1; transform: translateY(0) scale(1); }
.kz-bubble--act { gap: 12px; }
/* La pointe de la bulle, planche 06. Placement a gauche du personnage, elle est
   sur le bord DROIT de la bulle et pointe vers l'epaule. Declaration reprise
   telle quelle de la planche, ou elle apparait 20 fois, bordures haute et droite
   et rotation de 45 degres, ce qui oriente le coin vers la droite. */
.kz-bubble { position: relative; }
.kz-bubble::after {
  content: ""; position: absolute; right: -7px; bottom: 22px;
  width: 13px; height: 13px; background: #FFFFFF;
  border-top: 1px solid #E0E0E0; border-right: 1px solid #E0E0E0;
  border-radius: 0 3px 0 0; transform: rotate(45deg);
}
.kz-head { display: flex; align-items: center; gap: 8px; }
.kz-pill { flex: 0 0 auto; margin-right: auto; display: flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: 9999px; background: #F2FBF3; color: #1F5C2E; font-size: 11px; font-weight: 500; }
.kz-pill--hail { background: #DCEFE0; }
.kz-dot { flex: 0 0 auto; width: 6px; height: 6px; border-radius: 9999px; background: #2FAE4A; }
.kz-lead { display: flex; align-items: baseline; gap: 8px; }
.kz-lead-n { flex: 0 0 auto; font-size: 22px; line-height: 26px; font-weight: 600; color: #1F5C2E; font-variant-numeric: tabular-nums; }
.kz-lead-t { flex: 1 1 auto; font-size: 17px; line-height: 23px; color: #333333; }
.kz-day { display: flex; align-items: center; gap: 7px; }
.kz-day-segs { display: flex; gap: 4px; flex: 1 1 auto; }
.kz-seg { flex: 1 1 0; height: 5px; border-radius: 9999px; background: #DCEFE0; }
.kz-seg--on { background: #2FAE4A; }
.kz-day-lab { flex: 0 0 auto; font-size: 11px; color: #666666; }
.kz-seg--bonus { flex: 0 0 14px; background: #F5C877; }
.kz-day-lab--done { color: #1F5C2E; }
.kz-day-lab--bonus { color: #7A5E06; font-weight: 500; }
.kz-close { flex: 0 0 auto; padding: 0; border: none; background: none; color: #666666; font-size: 12px; line-height: 1; cursor: pointer; }
.kz-close:hover { color: #333333; }
.kz-timer { flex: 0 0 auto; font-size: 12px; font-weight: 500; color: #333333; font-variant-numeric: tabular-nums; }
.kz-bar { height: 4px; border-radius: 9999px; background: #F1F1F1; overflow: hidden; }
.kz-bar-f { height: 4px; width: 0; border-radius: 9999px; background: #2FAE4A; transition: width 1s linear; }
.kz-quote-row { display: flex; gap: 9px; }
.kz-mark { flex: 0 0 auto; color: #2FAE4A; font-size: 26px; line-height: 20px; font-family: Georgia, "Times New Roman", serif; }
.kz-mark--grey { color: #9F9F9F; }
.kz-quote-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.kz-quote-text { font-size: 16px; line-height: 23px; color: #333333; font-style: italic; }
.kz-author { display: flex; align-items: center; gap: 7px; }
.kz-author-line { flex: 0 0 auto; width: 14px; height: 1px; background: #C7E5CE; }
.kz-author-line--grey { background: #E0E0E0; }
.kz-author-name { font-size: 12px; line-height: 16px; color: #666666; }
.kz-rule { height: 1px; background: #F1F1F1; margin: 2px -16px; }
.kz-bubble--win { align-items: center; gap: 10px; }
.kz-win-mark { position: relative; width: 52px; height: 52px; display: flex; align-items: center; justify-content: center; }
.kz-ripple { position: absolute; inset: 0; border-radius: 9999px; background: #2FAE4A; opacity: 0; }
.kz-disc { position: relative; width: 44px; height: 44px; border-radius: 9999px; background: #DCEFE0; display: flex; align-items: center; justify-content: center; }
.kz-check { stroke-dasharray: 30; stroke-dashoffset: 30; }
.kz-spark { position: absolute; border-radius: 9999px; opacity: 0; }
.kz-win-t { font-size: 14px; line-height: 19px; font-weight: 500; color: #333333; }
.kz-win-row { display: flex; align-items: center; gap: 7px; }
.kz-win-lab { font-size: 12px; color: #666666; }
.kz-win-v { display: flex; align-items: baseline; gap: 3px; }
.kz-win-n { font-size: 17px; line-height: 20px; font-weight: 600; color: #1F5C2E; font-variant-numeric: tabular-nums; }
.kz-foot { font-size: 12px; line-height: 16px; color: #666666; }

@keyframes kzBreath { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
@keyframes kzArrive { 0% { transform: translate(26px,18px) rotate(8deg); opacity: 0; } 60% { transform: translate(0,-4px) rotate(-3deg); opacity: 1; } 100% { transform: translate(0,0) rotate(0deg); opacity: 1; } }
@keyframes kzLeave { 0% { transform: translate(0,0) rotate(0deg); opacity: 1; } 100% { transform: translate(26px,18px) rotate(8deg); opacity: 0; } }
@keyframes kzFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes kzFadeOut { from { opacity: 1; } to { opacity: 0; } }
@keyframes kzDraw { to { stroke-dashoffset: 0; } }
@keyframes kzPopIn { 0% { transform: scale(.4); opacity: 0; } 55% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes kzRipple { 0% { transform: scale(.6); opacity: .45; } 100% { transform: scale(2.1); opacity: 0; } }
@keyframes kzSpark { 0% { transform: translate(0,0) scale(0); opacity: 0; } 45% { transform: translate(var(--dx),var(--dy)) scale(1); opacity: 1; } 100% { transform: translate(calc(var(--dx) * 1.5),calc(var(--dy) * 1.5)) scale(.2); opacity: 0; } }
@keyframes kzRoll { 0% { transform: translateY(0); opacity: 1; } 30% { transform: translateY(-9px); opacity: .2; } 31% { transform: translateY(9px); opacity: .2; } 100% { transform: translateY(0); opacity: 1; } }
@keyframes kzCellIn { from { transform: translateY(7px) scale(.9); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
@keyframes kzMarkIn { from { transform: scale(.6) rotate(-12deg); opacity: 0; } 60% { transform: scale(1.06) rotate(2deg); opacity: 1; } to { transform: scale(1) rotate(0deg); opacity: 1; } }
@keyframes kzQuoteIn { from { transform: translateY(9px); opacity: 0; filter: blur(3px); } to { transform: translateY(0); opacity: 1; filter: blur(0); } }
@keyframes kzSway { 0%,100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
@keyframes kzBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-11px); } }
@keyframes kzBlink { 0%, 90%, 100% { transform: scaleY(1); } 92.5% { transform: scaleY(.08); } 95.5% { transform: scaleY(1); } }
@keyframes kzEarTwitch { 0%, 84%, 100% { transform: rotate(0deg); } 86.5% { transform: rotate(-8deg); } 89% { transform: rotate(3.5deg); } 91.5% { transform: rotate(-1.5deg); } 94% { transform: rotate(0deg); } }
@keyframes kzEarTwitchR { 0%, 84%, 100% { transform: rotate(0deg); } 86.5% { transform: rotate(8deg); } 89% { transform: rotate(-3.5deg); } 91.5% { transform: rotate(1.5deg); } 94% { transform: rotate(0deg); } }

@keyframes kzWave { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(-14deg); } }



@media (prefers-reduced-motion: reduce) {
  .kz-inner, .kz-photo, .kz-svg .kz-eyes, .kz-svg .kz-ear, .kz-svg .kz-paw { animation: none !important; }
  .kz-enter-rise, .kz-enter-drop, .kz-enter-pop, .kz-enter-peekR, .kz-enter-slideL,
  .kz-exit-waddle, .kz-exit-jump, .kz-exit-rollL, .kz-exit-rollR, .kz-exit-shrink,
  .kz-exit-balloon, .kz-exit-slideDown, .kz-exit-spinAway, .kz-exit-vortex,
  .kz-exit-faint, .kz-exit-moon { animation: none !important; }
  .kz-bubble, .kz-bar-f { transition: opacity 120ms linear !important; }
  .kz-bubble.kz-show { transform: none !important; }
}

.kz-actions { display: flex; gap: 8px; }
.kz-btn { font: inherit; font-size: 14px; font-weight: 500; height: 38px; border-radius: 9999px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.kz-btn--done { flex: 1 1 0; background: #146B2C; color: #FFFFFF; }
.kz-btn--later { flex: 0 0 auto; padding: 0; background: none; color: #666666; }
.kz-btn--done:hover { filter: brightness(1.07); }
.kz-btn--later:hover { color: #333333; }
.kz-btn:focus-visible { outline: 3px solid #2FAE4A; outline-offset: 1px; }
.kz-btn--done[disabled] { background: #E0E0E0; color: #666666; cursor: default; filter: none; }
/* Le rappel de rendez-vous a sa propre identite, bleue, pour ne jamais se
   confondre avec le rappel d'habitude, vert et blanc. Couleurs de la planche. */
.kz-bubble--meet { background: #EDF4FC; border-color: #CFE0F3; }
.kz-bubble--meet::after { background: #EDF4FC; border-top-color: #CFE0F3; border-right-color: #CFE0F3; }
.kz-koala--land .kz-bubble--meet::after { background: #EDF4FC; border-right-color: #CFE0F3; border-bottom-color: #CFE0F3; }
.kz-pill--meet { background: #CFE0F3; color: #1B4A7A; }
.kz-pill--meet svg { display: block; width: 12px; height: 12px; }
.kz-btn--join { flex: 1 1 0; background: #1F63A8; color: #FFFFFF; }
.kz-btn--join:hover { filter: brightness(1.07); }
.kz-meet-title { font-size: 16px; line-height: 22px; font-weight: 600; color: #1B4A7A; overflow-wrap: anywhere; }
.kz-meet-when { font-size: 13px; line-height: 18px; color: #666666; }
.kz-meet-count { font-size: 16px; line-height: 22px; font-weight: 600; color: #1F63A8; font-variant-numeric: tabular-nums; }
.kz-btn--close { flex: 0 0 auto; padding: 0 4px; background: none; color: #666666; }
.kz-btn--close:hover { color: #333333; }
.kz-bubble--meetend { background: #FBE6CE; border-color: #F5C877; }
.kz-bubble--meetend::after { background: #FBE6CE; border-top-color: #F5C877; border-right-color: #F5C877; }
.kz-koala--land .kz-bubble--meetend::after { background: #FBE6CE; border-right-color: #F5C877; border-bottom-color: #F5C877; }
.kz-bubble--meetend .kz-meet-title { color: #8A5108; }
.kz-bubble--meetend .kz-meet-count { color: #8A5108; }
.kz-bubble--meetend .kz-btn--close { flex: 1 1 0; padding: 0; background: #8A5108; color: #FFFFFF; }
.kz-bubble--meetend .kz-btn--close:hover { color: #FFFFFF; filter: brightness(1.07); }
.kz-pill--meetend { background: #F5C877; color: #8A5108; }
.kz-btn--notify { flex: 0 0 auto; padding: 0 4px; background: none; color: #1F63A8; font-weight: 500; }
.kz-btn--notify:hover { color: #1B4A7A; }
.kz-btn--notify[disabled] { color: #666666; cursor: default; }
.kz-hide { display: none !important; }
.kz-notify { display: flex; flex-direction: column; gap: 10px; }
.kz-notify-kinds { display: flex; gap: 6px; }
.kz-kind { flex: 1 1 0; font: inherit; font-size: 12px; line-height: 16px; font-weight: 500; height: 34px; padding: 0 6px; border-radius: 9px; border: 1px solid #CFE0F3; background: #FFFFFF; color: #1B4A7A; cursor: pointer; }
.kz-kind--on { background: #1F63A8; border-color: #1F63A8; color: #FFFFFF; }
.kz-kind[disabled] { background: #F5F5F5; border-color: #E0E0E0; color: #9F9F9F; cursor: default; }
.kz-notify-to { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.kz-notify-lab { font-size: 12px; line-height: 16px; color: #666666; }
.kz-chip { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 4px 0 9px; border-radius: 9999px; background: #EDF4FC; border: 1px solid #CFE0F3; color: #1B4A7A; font-size: 12px; line-height: 16px; max-width: 100%; }
.kz-chip-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }
.kz-chip-x { font: inherit; font-size: 14px; line-height: 16px; width: 18px; height: 18px; border-radius: 9999px; border: none; background: none; color: #1F63A8; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.kz-chip-x:hover { background: #CFE0F3; }
.kz-notify-subj { font-size: 12px; line-height: 16px; color: #666666; overflow-wrap: anywhere; }
.kz-notify-subj b { font-weight: 500; color: #333333; }
.kz-notify-body { width: 100%; box-sizing: border-box; height: 118px; resize: vertical; padding: 8px 10px; border: 1px solid #E0E0E0; border-radius: 8px; background: #FFFFFF; color: #333333; font-family: inherit; font-size: 13px; line-height: 18px; }
.kz-notify-body:focus { outline: none; border-color: #1F63A8; box-shadow: 0 0 0 3px rgba(31,99,168,.25); }
.kz-notify-msg { font-size: 12px; line-height: 16px; color: #666666; }
.kz-notify-msg--err { color: #8F2723; }
.kz-notify-msg--ok { color: #1F5C2E; font-weight: 500; }
.kz-btn--send { flex: 1 1 0; background: #1F63A8; color: #FFFFFF; }
.kz-btn--send:hover { filter: brightness(1.07); }
.kz-btn--send[disabled] { background: #E0E0E0; color: #666666; cursor: default; filter: none; }
.kz-rocket { position: relative; height: 96px; overflow: hidden; display: flex; justify-content: center; align-items: flex-end; }
.kz-rocket svg { display: block; width: 40px; height: 64px; animation: kzRocket 1500ms cubic-bezier(0.4,0,1,1) both; }
.kz-rocket-flame { transform-box: fill-box; transform-origin: 50% 0; animation: kzFlame 180ms ease-in-out infinite alternate; }
.kz-rocket-trail { position: absolute; left: 50%; bottom: 0; width: 6px; height: 0; margin-left: -3px; border-radius: 9999px; background: #CFE0F3; animation: kzTrail 1500ms cubic-bezier(0.4,0,1,1) both; }
@keyframes kzRocket { 0% { transform: translateY(0) scale(1); opacity: 1; } 55% { transform: translateY(-40px) scale(0.92); opacity: 1; } 100% { transform: translateY(-140px) scale(0.6); opacity: 0; } }
@keyframes kzTrail { 0% { height: 0; opacity: 0.9; } 60% { height: 70px; opacity: 0.5; } 100% { height: 96px; opacity: 0; } }
@keyframes kzFlame { from { transform: scaleY(0.7); } to { transform: scaleY(1.15); } }
.kz-pill--meetend svg { display: block; width: 12px; height: 12px; }
.kz-focus-back { position: fixed; inset: 0; z-index: 2147483646; background: rgba(26,26,26,.55); opacity: 0; transition: opacity .35s ease; pointer-events: auto; cursor: default; }
.kz-focus-back.kz-show { opacity: 1; }
.kz-bubble--focus { border-color: transparent; box-shadow: 0 8px 24px rgba(16,24,40,0.24); }
.kz-sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
/* La case choisie passe en aplat plein de SA bande, avec son anneau. */
`;

    let running = false;

    // Le mouvement suit le reglage Animations, Automatique par defaut.
    let ANIM_MODE = "auto";
    function reduceMotion() {
      if (ANIM_MODE === "always") return false;
      if (ANIM_MODE === "never") return true;
      try { return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
    }

    function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

    // Les racines fermees, par conteneur, partagees avec passages.js. Cette
    // variable vit dans le monde isole des scripts de l'extension : la page
    // ne la voit pas, meme en ecrivant sur son propre window.
    const KZ_SHADOWS = (globalThis.__kzShadows instanceof WeakMap) ? globalThis.__kzShadows : (globalThis.__kzShadows = new WeakMap());
    function kzShadowDe(h) { return h ? (KZ_SHADOWS.get(h) || null) : null; }
    // Un vrai geste de l'utilisateur, jamais un clic simule par du code. Les
    // tests jsdom ne peuvent pas produire d'evenement de confiance : ils
    // posent __kzEssaiJsdom dans CE monde, ce qu'une page ne peut pas faire.
    function kzGesteReel(e) { return !!(e && (e.isTrusted || globalThis.__kzEssaiJsdom === true)); }
    // Un vrai clic ne prouve pas que le bouton
    // etait visible. La page peut rendre notre conteneur transparent, flou ou
    // decoupe et faire cliquer a l'aveugle. Avant Envoyer ou Rejoindre : le
    // bouton est affiche depuis au moins KZ_VU_MS, et ni le conteneur ni ses
    // ancetres (que la page controle) ne le masquent ou le deforment.
    const KZ_VU_MS = 500;
    function kzMarqueVu(bt) { bt.kzVuA = Date.now(); }
    function kzBienVisible(bt) {
      if (!bt || !bt.kzVuA || Date.now() - bt.kzVuA < KZ_VU_MS) return false;
      try {
        const host = document.getElementById(HOST_ID);
        if (!host || !host.isConnected) return false;
        // En couche superieure, rien de ce que la page met sur ses propres
        // elements (filtre d'un mode sombre, opacite, flou) ne s'applique a
        // la bulle : seul le conteneur compte. Sans couche superieure, les
        // ancetres comptent aussi, mais un filtre de couleur (mode sombre)
        // n'est pas un masque.
        let enHaut = false;
        if (typeof host.showPopover === "function") { try { enHaut = host.matches(":popover-open"); } catch (e) { enHaut = false; } }
        let n = host;
        while (n && n.nodeType === 1) {
          const cs = getComputedStyle(n);
          if (cs.display === "none") return false;
          const op = cs.opacity === "" ? 1 : parseFloat(cs.opacity);
          if (op < 0.99) return false;
          const filtre = cs.filter || "";
          if (n === host) {
            if (cs.visibility === "hidden" || (filtre && filtre !== "none")) return false;
            if ((cs.clipPath && cs.clipPath !== "none") || (cs.mask && cs.mask !== "none" && cs.mask !== "") || (cs.transform && cs.transform !== "none")) return false;
          } else if (/opacity\(|blur\(|brightness\(0?\.|contrast\(0?\./.test(filtre)) return false;
          if (enHaut) break;
          n = n.parentElement;
        }
      } catch (e) { return false; }
      return true;
    }

    // 2026-09-21 : un conteneur laisse par une version PRECEDENTE du script
    // (onglet ouvert avant une mise a jour de l'extension, puis script
    // reinjecte) gardait son ancienne feuille de style. Les nouvelles classes
    // arrivaient sans leurs regles, la bulle de fin s'affichait en bleu avec
    // un calendrier geant. Le conteneur est reutilise, sa feuille est
    // remplacee des qu'elle differe de la notre.
    function rafraichitStyle(shadow) {
      const style = shadow.querySelector("style");
      if (style) { if (style.textContent !== STYLES) style.textContent = STYLES; return; }
      const neuf = document.createElement("style");
      neuf.textContent = STYLES;
      shadow.insertBefore(neuf, shadow.firstChild);
    }
    // 2026-09-29, audit de securite : le shadow DOM est FERME. Le code de la
    // page ne peut plus l'atteindre (host.shadowRoot vaut null pour lui),
    // donc ni lire le titre d'un rendez-vous ou l'adresse d'un participant,
    // ni reecrire le message de Prevenir, ni cliquer Envoyer a ta place. La
    // reference vit dans le monde isole du script, invisible a la page. Un
    // conteneur laisse par un ancien script, dont on n'a plus la reference,
    // est remplace.
    // 2026-10-01, signale par Thomas sur rtn.ch : le conteneur, fixe et sans
    // z-index, s'empilait au niveau 0 de la page, et le lecteur radio colle en
    // bas (z-index positif) passait devant le koala. Le conteneur entre donc
    // dans la couche superieure du navigateur (popover manuel) : aucun z-index
    // d'un site ne peut passer devant. Le z-index maximal reste en secours
    // pour un navigateur sans popover. Rien d'autre ne change : 0 x 0 px, pas
    // de fond, pas de clic intercepte, pas de fermeture par Echap.
    function kzAuDessus(h) {
      if (!h || typeof h.showPopover !== "function") return;
      try { if (h.getAttribute("popover") !== "manual") h.setAttribute("popover", "manual"); } catch (e) { return; }
      let ouvert = false;
      try { ouvert = h.matches(":popover-open"); } catch (e) { ouvert = false; }
      if (!ouvert) { try { h.showPopover(); } catch (e) { /* le z-index maximal reste */ } }
    }
    function ensureShadow() {
      let host = document.getElementById(HOST_ID);
      const connu = kzShadowDe(host);
      if (connu) { rafraichitStyle(connu); kzAuDessus(host); return connu; }
      if (host) host.remove();
      host = document.createElement("div");
      host.id = HOST_ID;
      host.setAttribute("style", "all:initial;position:fixed;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147483647;opacity:1!important;visibility:visible!important;filter:none!important;clip-path:none!important;transform:none!important;");
      const shadow = host.attachShadow({ mode: "closed" });
      KZ_SHADOWS.set(host, shadow);
      const style = document.createElement("style");
      style.textContent = STYLES;
      shadow.appendChild(style);
      (document.body || document.documentElement).appendChild(host);
      kzAuDessus(host);
      return shadow;
    }

    // "svg:reminder" et "svg:quote" designent les deux koalas dessines ci-dessus.
    const DEFAULT_KOALAS = ["svg:reminder", "svg:quote"];
    let CUSTOMS = [];
    let INCLUDE_DEFAULTS = true;

    let KOALAS = DEFAULT_KOALAS.slice();
    let lastKoala = -1;
    let QUOTES = (typeof KZ_QUOTES !== "undefined") ? KZ_QUOTES : [];
    let SPORT = (typeof KZ_SPORT !== "undefined") ? KZ_SPORT : [];

    function kzMsg(key, fallback) {
      try { const m = (api.i18n && api.i18n.getMessage) ? api.i18n.getMessage(key) : ""; return m || fallback; } catch (e) { return fallback; }
    }

    function sendOutcome(result) { try { api.runtime.sendMessage({ type: "kz-outcome", result: result }); } catch (e) { /* noop */ } }

    function fmtDuration(totalSec) {
      const s = Math.max(0, Math.round(Number(totalSec) || 0));
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (h > 0) return h + " h " + String(m).padStart(2, "0");
      return m + " min";
    }

    function addRule(bubble) {
      bubble.appendChild(document.createElement("div")).className = "kz-rule";
    }

    function addFootLine(bubble, text) {
      if (!text) return;
      addRule(bubble);
      const el = document.createElement("div");
      el.className = "kz-foot";
      el.textContent = text;
      bubble.appendChild(el);
    }

    function appendScreenTime(bubble, seconds) {
      if (seconds == null) return;
      addFootLine(bubble, kzMsg("screenTodayLine", "Aujourd'hui, {d} d'écran").replace("{d}", fmtDuration(seconds)));
    }

    // Pastille du rendez-vous : un petit calendrier dessine par nous, jamais un
    // emoji, pour que le rappel d'agenda se reconnaisse au premier coup d'oeil.
    const MEET_GLYPH = '<svg viewBox="0 0 12 12" aria-hidden="true"><rect x="1" y="2" width="10" height="9" rx="1.5" fill="none" stroke="#1B4A7A" stroke-width="1.3"/><path d="M1 5 H11" stroke="#1B4A7A" stroke-width="1.3"/><path d="M4 1 V3 M8 1 V3" stroke="#1B4A7A" stroke-width="1.3" stroke-linecap="round"/></svg>';
    function mkPill(text, kind) {
      const p = document.createElement("div");
      p.className = "kz-pill" + (kind === "hail" ? " kz-pill--hail" : kind === "meet" ? " kz-pill--meet" : kind === "meetend" ? " kz-pill--meetend" : "");
      if (kind === "hail") p.appendChild(document.createElement("span")).className = "kz-dot";
      if (kind === "meet") { const g = svgFromString(MEET_GLYPH); if (g) p.appendChild(g); }
      // La fin de rendez-vous reprend le calendrier, en ambre.
      if (kind === "meetend") { const g = svgFromString(MEET_GLYPH.split("#1B4A7A").join("#8A5108")); if (g) p.appendChild(g); }
      p.appendChild(document.createTextNode(text));
      return p;
    }

    // Le chiffre de tete passe en gros, comme dans la maquette. Sinon la phrase reste entiere.
    function mkQuoteRow(text, author, grey) {
      const row = document.createElement("div");
      row.className = "kz-quote-row";
      const mark = document.createElement("div");
      mark.className = "kz-mark" + (grey ? " kz-mark--grey" : "");
      mark.textContent = "\u201C";
      const col = document.createElement("div");
      col.className = "kz-quote-col";
      const t = document.createElement("div");
      t.className = "kz-quote-text";
      t.textContent = text;
      col.appendChild(t);
      if (author) {
        const a = document.createElement("div");
        a.className = "kz-author";
        const line = document.createElement("div");
        line.className = "kz-author-line" + (grey ? " kz-author-line--grey" : "");
        const name = document.createElement("div");
        name.className = "kz-author-name";
        name.textContent = author;
        a.appendChild(line); a.appendChild(name);
        col.appendChild(a);
      }
      row.appendChild(mark); row.appendChild(col);
      return row;
    }

    function mkLead(text) {
      const row = document.createElement("div");
      row.className = "kz-lead";
      const m = /^\s*(\d{1,3})\s+(\S[\s\S]*)$/.exec(text);
      if (m) {
        const n = document.createElement("div");
        n.className = "kz-lead-n";
        n.textContent = m[1];
        row.appendChild(n);
        const t = document.createElement("div");
        t.className = "kz-lead-t";
        t.textContent = m[2];
        row.appendChild(t);
      } else {
        const t = document.createElement("div");
        t.className = "kz-lead-t";
        t.textContent = text;
        row.appendChild(t);
      }
      return row;
    }

    // Ou en est la journee, un trait par objectif.
    function mkDayProgress(done, goal) {
      if (!goal || goal < 1) return null;
      const row = document.createElement("div");
      row.className = "kz-day";
      const segs = document.createElement("div");
      segs.className = "kz-day-segs";
      const shown = Math.min(goal, 8);
      for (let i = 0; i < shown; i++) {
        const seg = document.createElement("div");
        seg.className = "kz-seg" + (i < done ? " kz-seg--on" : "");
        segs.appendChild(seg);
      }
      // Au-dela de l'objectif, chaque habitude de plus compte et se voit :
      // un trait dore par bonus, trois au plus, et le libelle dit le total
      // reel et le surplus, plutot qu'un "3 sur 3" fige qui laissait croire
      // que la journee etait close. Demande du 2026-09-18.
      const bonus = Math.max(0, done - goal);
      for (let j = 0; j < Math.min(bonus, 3); j++) {
        const seg = document.createElement("div");
        seg.className = "kz-seg kz-seg--bonus";
        segs.appendChild(seg);
      }
      const lab = document.createElement("div");
      lab.className = "kz-day-lab" + (bonus > 0 ? " kz-day-lab--bonus" : (done >= goal ? " kz-day-lab--done" : ""));
      lab.textContent = bonus > 0
        ? kzMsg("dayProgressBonus", "{d} sur {g} aujourd'hui, +{n} en bonus").replace("{d}", done).replace("{g}", goal).replace("{n}", bonus)
        : kzMsg("dayProgress", "{d} sur {g} aujourd'hui").replace("{d}", Math.min(done, goal)).replace("{g}", goal);
      row.appendChild(segs); row.appendChild(lab);
      return row;
    }

    // Les lignes de la bulle se posent a 60 ms d'ecart.
    function stagger(bubble) {
      if (reduceMotion()) return;
      Array.prototype.forEach.call(bubble.children, (child, i) => {
        child.style.animation = "kzQuoteIn " + T.quote + "ms cubic-bezier(0.2,0,0,1) " + (i * T.line) + "ms both";
      });
    }

    // Echap vaut Plus tard, seule sortie depuis que la croix a disparu.
    // Un seul ecouteur par bulle, retire des qu'une issue est choisie.
    function armEscape(onLater) {
      const h = (e) => {
        // Un Echap simule par la page ne ferme rien.
        if (e.key === "Escape" && kzGesteReel(e)) { e.stopPropagation(); disarm(); onLater(); }
      };
      const disarm = () => { try { document.removeEventListener("keydown", h, true); } catch (err) { /* noop */ } };
      document.addEventListener("keydown", h, true);
      return disarm;
    }

    function openBubble(wrap, bubble) {
      wrap.appendChild(bubble);
      requestAnimationFrame(() => requestAnimationFrame(() => bubble.classList.add("kz-show")));
      return bubble;
    }

    // Fondu croise de 200 ms entre deux bulles.
    async function swapBubble(wrap, oldBubble, newBubble) {
      if (oldBubble) {
        oldBubble.style.transition = "opacity " + T.swap + "ms linear";
        oldBubble.style.opacity = "0";
        await sleep(T.swap);
        oldBubble.remove();
      }
      return openBubble(wrap, newBubble);
    }

    // 2026-09-25 : la question d'energie apres Fait ou Plus tard est retiree,
    // decision de Thomas. L'issue part des le clic, plus aucun ecran entre.

    // La coche se dessine en 300 ms, une onde part du cercle et le compteur de serie roule.
    const SPARKS = [
      { s: 5, c: "#2FAE4A", dx: "-22px", dy: "-16px", d: 0 },
      { s: 4, c: "#F5C877", dx: "20px", dy: "-18px", d: 60 },
      { s: 4, c: "#9BD4A8", dx: "24px", dy: "12px", d: 120 },
      { s: 5, c: "#2FAE4A", dx: "-20px", dy: "14px", d: 30 }
    ];
    function buildWin(b, streak) {
      const mark = document.createElement("div");
      mark.className = "kz-win-mark";
      const ripple = document.createElement("div");
      ripple.className = "kz-ripple";
      const disc = document.createElement("div");
      disc.className = "kz-disc";
      const check = svgFromString('<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path class="kz-check" d="M6 12.5 L10.5 17 L18 8" stroke="#1F5C2E" stroke-width="2.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>');
      if (check) disc.appendChild(check);
      mark.appendChild(ripple); mark.appendChild(disc);
      SPARKS.forEach((sp) => {
        const d = document.createElement("div");
        d.className = "kz-spark";
        d.style.width = sp.s + "px"; d.style.height = sp.s + "px"; d.style.background = sp.c;
        d.style.setProperty("--dx", sp.dx); d.style.setProperty("--dy", sp.dy);
        if (!reduceMotion()) d.style.animation = "kzSpark 760ms ease-out " + (T.check + sp.d) + "ms both";
        mark.appendChild(d);
      });

      const title = document.createElement("div");
      title.className = "kz-win-t";
      title.textContent = kzMsg("winTitle", "Bien joué");
      b.appendChild(mark); b.appendChild(title);

      if (streak > 0) {
        const row = document.createElement("div");
        row.className = "kz-win-row";
        const lab = document.createElement("div");
        lab.className = "kz-win-lab";
        lab.textContent = kzMsg("winStreak", "Série");
        const val = document.createElement("div");
        val.className = "kz-win-v";
        const n = document.createElement("div");
        n.className = "kz-win-n";
        n.textContent = String(streak);
        const unit = document.createElement("div");
        unit.className = "kz-win-lab";
        unit.textContent = kzMsg("winDays", "jours");
        val.appendChild(n); val.appendChild(unit);
        row.appendChild(lab); row.appendChild(val);
        b.appendChild(row);
        if (!reduceMotion()) n.style.animation = "kzRoll 520ms cubic-bezier(0.2,0,0,1) " + (T.check + 120) + "ms both";
      }

      // Sur un noeud SVG importe, la propriete style n'est pas garantie selon
      // le moteur. On passe par les attributs, toujours acceptes.
      const path = b.querySelector(".kz-check");
      if (reduceMotion()) {
        if (path) path.setAttribute("stroke-dashoffset", "0");
      } else {
        if (path) path.setAttribute("style", "animation: kzDraw " + T.check + "ms cubic-bezier(0.2,0,0,1) 60ms both");
        disc.style.animation = "kzPopIn 420ms cubic-bezier(0.34,1.06,0.4,1) both";
        ripple.style.animation = "kzRipple 760ms ease-out " + T.check + "ms both";
      }
      return b;
    }

    async function loadSettings() {
      try {
        const r = await api.storage.local.get(["customKoalas", "includeDefaultKoalas", "customQuotes", "customSport", "includeDefaultQuotes", "animMode", "hiddenQuotes"]);
        ANIM_MODE = (r.animMode === "always" || r.animMode === "never") ? r.animMode : "auto";
        // Une image de l'utilisateur est toujours une donnee integree (data:image).
        // Un import qui glisserait une adresse http ferait sortir une requete de
        // l'appareil a chaque page visitee, ce que la promesse de confidentialite
        // interdit : tout autre format est ecarte ici comme dans le popup.
        CUSTOMS = Array.isArray(r.customKoalas) ? r.customKoalas.filter((s) => typeof s === "string" && /^data:image\//i.test(s)) : [];
        INCLUDE_DEFAULTS = r.includeDefaultKoalas !== false;
        KOALAS = CUSTOMS.length ? (INCLUDE_DEFAULTS ? CUSTOMS.concat(DEFAULT_KOALAS) : CUSTOMS) : DEFAULT_KOALAS;

        const hidden = Array.isArray(r.hiddenQuotes) ? r.hiddenQuotes : [];
        const baseQ = ((typeof KZ_QUOTES !== "undefined") ? KZ_QUOTES : []).filter((q) => hidden.indexOf(q.t) < 0);
        const cq = Array.isArray(r.customQuotes) ? r.customQuotes.filter((q) => q && typeof q.t === "string" && q.t.trim()) : [];
        QUOTES = cq.length ? (r.includeDefaultQuotes ? baseQ.concat(cq) : cq) : baseQ;

        const baseS = (typeof KZ_SPORT !== "undefined") ? KZ_SPORT : [];
        const cs = Array.isArray(r.customSport) ? r.customSport.filter((s) => typeof s === "string" && s.trim()) : [];
        SPORT = cs.length ? cs : baseS;
      } catch (e) {
        CUSTOMS = []; INCLUDE_DEFAULTS = true; KOALAS = DEFAULT_KOALAS;
        QUOTES = (typeof KZ_QUOTES !== "undefined") ? KZ_QUOTES : [];
        SPORT = (typeof KZ_SPORT !== "undefined") ? KZ_SPORT : [];
      }
    }

    // Les objectifs defilent dans l'ordre de la liste, un seul par visite.
    async function nextSport() {
      if (!SPORT.length) return kzMsg("sportFallback", "Bouge un peu");
      try {
        const r = await api.storage.local.get("sportIndex");
        const i = Math.max(0, Number(r && r.sportIndex) || 0) % SPORT.length;
        await api.storage.local.set({ sportIndex: (i + 1) % SPORT.length });
        return SPORT[i];
      } catch (e) { return SPORT[0]; }
    }

    // Le personnage d'un role : le koala dessine du role, sauf si l'utilisateur
    // a ses propres images. Avec les koalas d'origine gardes, une image perso
    // et le koala du role tirent au sort a parts egales ; sans, images perso
    // seules, jamais deux fois de suite la meme.
    function pickKoala(role) {
      const vec = "svg:" + (role === "quote" ? "quote" : "reminder");
      if (!CUSTOMS.length) { lastKoala = -1; return vec; }
      const pool = INCLUDE_DEFAULTS ? CUSTOMS.concat([vec]) : CUSTOMS.slice();
      let i = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && i === lastKoala) i = (i + 1) % pool.length;
      lastKoala = i;
      return pool[i];
    }

    // Un SVG passe par DOMParser puis importNode ne se DESSINE PAS dans certains
    // navigateurs, en particulier dans un Shadow DOM. Le noeud existe, il est
    // dans l'arbre, et rien n'apparait. C'est ce qui faisait disparaitre le vu de
    // la coche de validation et le personnage de la bulle de relance.
    // 2026-08-04, le puits "innerHTML" signale par le linter des extensions (et
    // son remplacant Range.createContextualFragment, egalement signale) sont
    // retires : on reconstruit le SVG noeud par noeud avec createElementNS et
    // setAttribute, jamais d'assignation d'une chaine dans le DOM. DOMParser ne
    // fait que LIRE une chaine comme un arbre de donnees ; le noeud etranger
    // qu'il produit n'est jamais insere tel quel (pas d'importNode), ce qui
    // evite a la fois le puits signale et le bug de rendu ci-dessus. Verifie
    // cote a cote (meme SVG, meme shadow root) contre les autres approches. Ce
    // sont NOS chaines, definies en tete de ce fichier, jamais du contenu de
    // page.
    function rebuildSvgNode(foreign, doc) {
      if (foreign.nodeType === Node.TEXT_NODE) return doc.createTextNode(foreign.nodeValue);
      if (foreign.nodeType !== Node.ELEMENT_NODE) return null;
      // Filtre : jamais de script, d'objet etranger, d'attribut d'evenement ni de lien javascript, meme si nos dessins n'en ont pas.
      if (/^(script|foreignobject|iframe|object|embed)$/i.test(foreign.localName || foreign.tagName || "")) return null;
      const ns = foreign.namespaceURI || "http://www.w3.org/2000/svg";
      const el = doc.createElementNS(ns, foreign.localName || foreign.tagName);
      for (let i = 0; i < foreign.attributes.length; i++) {
        const a = foreign.attributes[i];
        if (/^on/i.test(a.name) || (/href$/i.test(a.name) && /^\s*(javascript|data):/i.test(a.value))) continue;
        el.setAttribute(a.name, a.value);
      }
      for (let j = 0; j < foreign.childNodes.length; j++) {
        const child = rebuildSvgNode(foreign.childNodes[j], doc);
        if (child) el.appendChild(child);
      }
      return el;
    }
    function svgFromString(markup) {
      try {
        const parsed = new DOMParser().parseFromString(markup, "image/svg+xml");
        const root = parsed.documentElement;
        if (!root || root.nodeName === "parsererror") return null;
        return rebuildSvgNode(root, document);
      } catch (e) { /* noop */ }
      return null;
    }

    function svgNode(role) {
      const n = svgFromString(KOALA_SVGS[role === "quote" ? "quote" : "reminder"]);
      if (n && role === "quote") n.setAttribute("class", "kz-svg kz-svg--quote");
      return n;
    }

    function setSvgFallback(container, role) {
      container.textContent = "";
      const n = svgNode(role);
      if (n) container.appendChild(n);
    }

    // Module M. Le cadre suit le format exact du fichier. Le carre de reference
    // fait 150 px, le cote court reste a 150 et le cote long est plafonne a
    // 280 px, donc rien n'est jamais deforme ni recadre.
    const KZ_CARRE = 150;
    const KZ_LONG_MAX = 280;
    const KZ_SEUIL_PAYSAGE = 1.9;

    function cadreImage(w, h) {
      if (!w || !h) return null;
      const ratio = w / h;
      const grand = Math.max(ratio, 1 / ratio);
      const court = KZ_CARRE;
      // Le cote long reste plafonne, mais on evite qu'une image large ecrase la
      // bulle. Au dela du carre de reference on limite la croissance.
      const long = Math.min(KZ_LONG_MAX, Math.round(KZ_CARRE * Math.min(grand, 1.6)));
      return (ratio >= 1)
        ? { w: long, h: Math.round(long / ratio), paysage: ratio > KZ_SEUIL_PAYSAGE }
        : { w: Math.round(court * ratio), h: court, paysage: false };
    }

    // Le placement se decide a la lecture des dimensions naturelles, une seule
    // bascule interne, aucun ecran conditionnel et aucun reglage de plus.
    function posePlacement(wrap, img, estPerso) {
      // Le paysage est une regle du build perso pour les images de l'utilisateur,
      // planches 06 et 07. Une image LIVREE avec l'extension ne doit jamais faire
      // basculer la mise en page, sinon la bulle passe au dessus et le personnage
      // se retrouve hors cadre.
      if (!estPerso) return;
      const c = cadreImage(img.naturalWidth, img.naturalHeight);
      if (!c) return;
      img.setAttribute("width", String(c.w));
      img.setAttribute("height", String(c.h));
      // La regle CSS .kz-photo pose width/height a auto avec un plafond en
      // max-width/max-height, ce qui l'emporte sur les attributs HTML
      // width/height ci-dessus (une image ne rend alors jamais a la taille
      // calculee, juste mise a l'echelle dans la boite de 280 par 280). Le
      // style en ligne a une specificite plus forte que la regle de classe
      // et fait vraiment appliquer le cadre voulu.
      img.style.width = c.w + "px";
      img.style.height = c.h + "px";
      wrap.classList.toggle("kz-koala--land", !!c.paysage);
    }

    // Remplit le conteneur photo d'un personnage, neuf ou reutilise. Separee de
    // buildKoala pour pouvoir rafraichir juste le visage d'un personnage qui
    // reste a l'ecran d'un rappel au suivant, sans rejouer d'entree.
    function fillKoalaPhoto(wrap, inner, src) {
      while (inner.firstChild) inner.removeChild(inner.firstChild);
      wrap.classList.remove("kz-koala--land");
      if (!src || src.indexOf("svg:") === 0) { wrap.classList.add("kz-koala--vec"); setSvgFallback(inner, src === "svg:quote" ? "quote" : "reminder"); return; }
      const img = document.createElement("img");
      img.className = "kz-photo";
      img.alt = "";
      img.decoding = "async";
      img.addEventListener("error", () => { wrap.classList.add("kz-koala--vec"); setSvgFallback(inner, "reminder"); });
      // Le format n'est connu qu'une fois l'image lue. Si elle est deja en
      // cache, load ne se declenche pas, d'ou le second appel immediat.
      // Une image de l'utilisateur est une donnee integree, pas un chemin du
      // paquet. C'est ce qui distingue les deux cas.
      const estPerso = src.indexOf("data:") === 0 || src.indexOf("blob:") === 0;
      img.addEventListener("load", () => { posePlacement(wrap, img, estPerso); });
      img.src = src;
      if (img.complete && img.naturalWidth) posePlacement(wrap, img, estPerso);
      inner.appendChild(img);
    }

    function buildKoala(shadow, src) {
      const wrap = document.createElement("div");
      wrap.className = "kz-koala";
      const inner = document.createElement("div");
      inner.className = "kz-inner";
      fillKoalaPhoto(wrap, inner, typeof src === "string" ? src : "svg:reminder");
      wrap.appendChild(inner);
      shadow.appendChild(wrap);
      return wrap;
    }

    function showQuoteBubble(wrap, quoteText, author, screenToday) {
      const b = document.createElement("div");
      b.className = "kz-bubble";
      b.appendChild(mkPill(kzMsg("bubblePillQuote", "Pensée du jour")));
      const row = mkQuoteRow(quoteText, author || kzMsg("authorUnknown", "Anonyme"), false);
      b.appendChild(row);
      appendScreenTime(b, screenToday);
      openBubble(wrap, b);
      // Le guillemet arrive en premier, la phrase monte en perdant son flou, l'auteur suit.
      if (!reduceMotion()) {
        const mark = b.querySelector(".kz-mark");
        const text = b.querySelector(".kz-quote-text");
        const auth = b.querySelector(".kz-author");
        if (mark) mark.style.animation = "kzMarkIn 300ms cubic-bezier(0.34,1.06,0.4,1) both";
        if (text) text.style.animation = "kzQuoteIn " + T.quote + "ms cubic-bezier(0.2,0,0,1) 120ms both";
        if (auth) auth.style.animation = "kzQuoteIn " + T.quote + "ms cubic-bezier(0.2,0,0,1) 260ms both";
      }
      return b;
    }

    // Le rappel. Le koala salue, le chiffre passe en gros, la journee se lit d'un coup d'oeil.
    function showSportBubble(wrap, promptText, doneToday, goal, handlers) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--act";
      // Accessibilite, la bulle est focusable et annoncee. Echap vaut Plus tard.
      b.setAttribute("tabindex", "0");
      b.setAttribute("role", "dialog");
      b.setAttribute("aria-label", kzMsg("bubbleAria", "Rappel Koala Zen"));
      const head = document.createElement("div");
      head.className = "kz-head";
      head.appendChild(mkPill(kzMsg("bubblePillHabit", "Coucou, c'est l'heure"), "hail"));
      b.appendChild(head);
      b.appendChild(mkLead(promptText));
      const day = mkDayProgress(doneToday, goal);
      if (day) b.appendChild(day);
      const actions = document.createElement("div");
      actions.className = "kz-actions";
      const done = document.createElement("button");
      done.type = "button"; done.className = "kz-btn kz-btn--done"; done.textContent = kzMsg("btnDone", "C'est fait");
      const later = document.createElement("button");
      later.type = "button"; later.className = "kz-btn kz-btn--later"; later.textContent = kzMsg("btnLater", "Plus tard");
      done.addEventListener("click", (e) => { e.stopPropagation(); handlers.onDone(); });
      later.addEventListener("click", (e) => { e.stopPropagation(); handlers.onLater(); });
      actions.appendChild(done); actions.appendChild(later);
      b.appendChild(actions);
      openBubble(wrap, b);
      stagger(b);
      return b;
    }

    async function runFocus(shadow, ctx) {
      // Voile qui bloque la page, seule chose propre au mode focus.
      const seconds = ctx.focusSeconds;
      const back = document.createElement("div");
      back.className = "kz-focus-back";
      shadow.appendChild(back);
      requestAnimationFrame(() => back.classList.add("kz-show"));

      const fmt = (v) => String(Math.floor(v / 60)).padStart(2, "0") + ":" + String(v % 60).padStart(2, "0");
      const removeBack = async () => { back.classList.remove("kz-show"); await sleep(320); back.remove(); };

      const k1 = buildKoala(shadow, pickKoala("reminder"));
      k1.classList.add("kz-koala--sport");
      playEnter(k1);
      await sleep(T.arrive + 60);

      const prompt = await nextSport();
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--act kz-bubble--focus";
      const head = document.createElement("div"); head.className = "kz-head";
      head.appendChild(mkPill(kzMsg("bubblePillFocus", "Pause focus")));
      const timer = document.createElement("div"); timer.className = "kz-timer"; timer.textContent = fmt(seconds);
      timer.setAttribute("aria-hidden", "true");
      head.appendChild(timer);
      // Region vocale du minuteur. Annoncee toutes les 10 s, jamais chaque
      // seconde, sinon le lecteur d'ecran devient inutilisable.
      const vocal = document.createElement("div");
      vocal.className = "kz-sr";
      vocal.setAttribute("aria-live", "polite");
      vocal.setAttribute("role", "status");
      vocal.textContent = kzMsg("focusRemaining", "Encore {n} secondes").replace("{n}", seconds);
      head.appendChild(vocal);
      const bar = document.createElement("div"); bar.className = "kz-bar";
      const barFill = document.createElement("div"); barFill.className = "kz-bar-f";
      bar.appendChild(barFill);
      const actions = document.createElement("div"); actions.className = "kz-actions";
      const done = document.createElement("button");
      done.type = "button"; done.className = "kz-btn kz-btn--done"; done.disabled = true;
      done.textContent = kzMsg("btnDoneIn", "Fait dans {n} s").replace("{n}", seconds);
      const later = document.createElement("button");
      later.type = "button"; later.className = "kz-btn kz-btn--later"; later.textContent = kzMsg("btnLater", "Plus tard");
      actions.appendChild(done); actions.appendChild(later);
      b.appendChild(head); b.appendChild(mkLead(prompt)); b.appendChild(bar); b.appendChild(actions);
      openBubble(k1, b);
      stagger(b);

      let settled = false;
      let desarmeF = null;
      const outcome = await new Promise((resolve) => {
        const finish = (r) => {
          if (settled) return;
          settled = true;
          if (desarmeF) desarmeF();
          resolve(r);
        };
        later.addEventListener("click", (e) => { e.stopPropagation(); finish("later"); });
        desarmeF = armEscape(() => finish("later"));
        let left = seconds;
        const t = setInterval(() => {
          if (settled) { clearInterval(t); return; }
          left -= 1;
          timer.textContent = fmt(Math.max(0, left));
          barFill.style.width = Math.round(((seconds - Math.max(0, left)) / seconds) * 100) + "%";
          done.textContent = kzMsg("btnDoneIn", "Fait dans {n} s").replace("{n}", Math.max(0, left));
          if (left > 0 && left % 10 === 0) {
            vocal.textContent = kzMsg("focusRemaining", "Encore {n} secondes").replace("{n}", left);
          }
          if (left <= 0) {
            clearInterval(t);
            timer.remove(); bar.remove();
            done.disabled = false;
            done.textContent = kzMsg("btnDone", "C'est fait");
            vocal.textContent = kzMsg("focusOver", "La pause est terminée, tu peux valider");
            done.addEventListener("click", (e) => { e.stopPropagation(); finish("done"); }, { once: true });
          }
        }, 1000);
      });

      if (outcome === "later") {
        await afterLater(shadow, k1, b, ctx);
        await removeBack();
        return;
      }
      await afterDone(shadow, k1, b, ctx);
      await removeBack();
    }

    // Rappel reporte : on note l'energie, puis le koala repart, bulle comprise.
    // Decision du 2026-09-16, un report est un report. Aucune relance, aucun
    // personnage qui pique, aucun retour anticipe, aucun rattrapage. Seules les
    // statistiques gardent le compte, par sendOutcome ci-dessous.
    async function afterLater(shadow, k1, bubble, ctx) {
      // Enregistre des le choix, avant l'animation de sortie. Si l'onglet se
      // ferme entre temps, le report est deja compte.
      sendOutcome("later");
      k1.classList.remove("kz-koala--sport");
      await playExit(k1);
      k1.remove();
    }

    // Habitude faite, coche puis citation en recompense.
    async function afterDone(shadow, k1, bubble, ctx) {
      // Enregistre avant de feliciter. L'ecran de validation annonce une serie,
      // il ne doit pas l'annoncer avant que la donnee soit ecrite.
      sendOutcome("done");
      const win = k1.querySelector(".kz-bubble");
      // streakFrom() de background.js compte DEJA aujourd'hui des qu'une
      // habitude du jour est faite. Le jour de plus ne s'ajoute donc qu'a la
      // premiere validation de la journee, sinon la serie affichait un jour de
      // trop des la deuxieme.
      await swapBubble(k1, win, winBubbleNode(ctx.streak + (ctx.doneToday > 0 ? 0 : 1)));
      await sleep(T.hold);
      k1.classList.remove("kz-koala--sport");
      await playExit(k1);
      k1.remove();

      // Toutes les citations masquees et aucune personnelle : pas de second
      // koala, plutot qu'un koala qui entre et disparait sur une erreur.
      const q = rand(QUOTES);
      if (!q || !q.t) return;
      await sleep(900);
      const k2 = buildKoala(shadow, pickKoala("quote"));
      let d2 = false;
      k2.addEventListener("click", () => { d2 = true; });
      playEnter(k2);
      await sleep(T.arrive + 60);
      showQuoteBubble(k2, q.t, q.a, ctx.screenToday);
      await waitOrDismiss(9500, () => d2);
      await playExit(k2);
      k2.remove();
    }

    function winBubbleNode(streak) {
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--act kz-bubble--win";
      buildWin(b, streak);
      return b;
    }

    function playEnter(wrap) {
      if (reduceMotion()) { wrap.style.animation = "kzFadeIn " + T.reduced + "ms linear both"; return; }
      // Le koala dessine ne respire pas en continu (choix de Thomas, yeux et
      // oreilles seulement) ; les images de l'utilisateur gardent le souffle.
      wrap.style.animation = "kzArrive " + T.arrive + "ms cubic-bezier(0.34,1.06,0.4,1) both" + (wrap.classList.contains("kz-koala--vec") ? "" : ", kzBreath 5s ease-in-out 300ms infinite");
    }

    async function playExit(wrap) {
      if (reduceMotion()) {
        wrap.style.animation = "kzFadeOut " + T.reduced + "ms linear both";
        await sleep(T.reduced + 20);
        return;
      }
      wrap.style.animation = "kzLeave " + T.leave + "ms cubic-bezier(0.2,0,0,1) both";
      await sleep(T.leave + 30);
    }

    // Le nettoyage de secours. A la fin d'une sequence, normale ou sur une
    // exception, plus rien ne doit rester a l'ecran ni dans l'arbre.
    function clearKoalas() {
      const sh = kzShadowDe(document.getElementById(HOST_ID));
      if (!sh) return;
      sh.querySelectorAll(".kz-koala, .kz-focus, .kz-focus-back").forEach((n) => n.remove());
    }

    async function waitOrDismiss(ms, isDismissed) {
      const step = 100;
      let t = 0;
      while (t < ms) { if (isDismissed()) return; await sleep(step); t += step; }
    }

    async function runSequence(opts) {
      if (running) return;
      running = true;
      const ctx = {
        focus: !!(opts && opts.focus),
        focusSeconds: Math.max(5, Math.min(120, Math.round((opts && opts.focusSeconds) || 30))),
        screenToday: (opts && opts.screenToday != null) ? opts.screenToday : null,
        intervalMinutes: Math.max(0, Math.round((opts && opts.intervalMinutes) || 0)),
        doneToday: Math.max(0, Math.round((opts && opts.doneToday) || 0)),
        goal: Math.max(0, Math.round((opts && opts.habitGoal) || 0)),
        streak: Math.max(0, Math.round((opts && opts.streak) || 0))
      };
      try {
        // Dans le try : sur un document ou le Shadow DOM est impossible (page
        // SVG servie en http, par exemple), une exception ici laissait running
        // a vrai pour toujours et avalait tous les rappels de l'onglet.
        const shadow = ensureShadow();
        await loadSettings();
        if (ctx.focus) { await runFocus(shadow, ctx); return; }

        // Plus aucun personnage ne reste a l'ecran d'un rappel a l'autre. Un
        // reste eventuel (page qui a garde un noeud) cede la place.
        shadow.querySelectorAll(".kz-koala").forEach((n) => n.remove());
        const k1 = buildKoala(shadow, pickKoala("reminder"));
        k1.classList.add("kz-koala--sport");
        playEnter(k1);
        await sleep(T.arrive + 60);

        let bubble = null;
        const prompt = await nextSport();
        let desarme = null;
        const outcome = await new Promise((resolve) => {
          let settled = false;
          const finish = (r) => {
            if (settled) return;
            settled = true;
            if (desarme) desarme();
            resolve(r);
          };
          bubble = showSportBubble(k1, prompt, ctx.doneToday, ctx.goal, {
            onDone: () => finish("done"),
            onLater: () => finish("later")
          });
          desarme = armEscape(() => finish("later"));
          // Aucun delai : le rappel attend une reponse, C'est fait, Plus tard ou
          // Echap. Retour du test en conditions reelles du 2026-09-17, une bulle
          // qui disparaissait au bout de 18 s etait manquee des qu'on avait le
          // dos tourne. Un rappel suivant qui arrive pendant l'attente est
          // simplement ignore par le garde running, un seul koala a la fois.
        });

        if (outcome === "later") {
          await afterLater(shadow, k1, bubble, ctx);
          return;
        }
        await afterDone(shadow, k1, bubble, ctx);
      } catch (e) {
        // Le finally ci dessous efface l'ecran. Sans cette capture, une exception
        // faisait disparaitre le koala SANS AUCUNE TRACE, ni erreur ni indice.
        // C'est ce qui a rendu trois tours d'enquete si penibles.
        try { console.warn("Koala Zen, sequence interrompue,", e && e.message); } catch (_) { /* noop */ }
      } finally {
        clearKoalas();
        running = false;
      }
    }

    // ---------- Module agenda. Le rappel de rendez-vous, trois minutes avant ----------
    // Meme personnage et meme bulle claire que le rappel d'habitude, mais rien a
    // valider : un clic sur le koala le renvoie, sinon il part seul apres 20 s.
    // Un bouton Rejoindre n'apparait que si le rendez-vous porte un lien de
    // visio, et l'ouverture passe par background.js, jamais par la page.
    function meetingWhenLine(startMs, people) {
      const d = new Date(Number(startMs) || Date.now());
      const heure = String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      let ligne = kzMsg("meetingSoonAt", "À {h}").replace("{h}", heure);
      if (people >= 2) ligne += " · " + kzMsg("meetingSoonPeople", "{n} participants").replace("{n}", people);
      return ligne;
    }

    // Compte a rebours lisible : "2 min 05", "45 s", "1 h 05 min".
    function fmtCount(ms) {
      const s = Math.max(0, Math.round(ms / 1000));
      if (s < 60) return s + " s";
      const m = Math.floor(s / 60), r = s % 60;
      if (m < 60) return m + " min " + String(r).padStart(2, "0");
      return Math.floor(m / 60) + " h " + String(m % 60).padStart(2, "0") + " min";
    }

    // 2026-09-21 : deux sortes de bulles d'agenda, meme squelette.
    //  - "soon", bleue, trois minutes avant le debut, bouton Rejoindre s'il y a
    //    un lien ;
    //  - "end", ambre, cinq minutes avant la fin, pour tenir la duree prevue.
    // Toutes deux portent un compte a rebours qui tourne a la seconde et un
    // bouton Fermer : rien ne les efface tant qu'on n'a pas ferme, la
    // demande est explicite. Passe l'echeance, le compte continue en
    // "depuis", jamais un zero fige.
    function buildMeetingBubble(info, kind, onJoin, onClose) {
      const fin = kind === "end";
      const b = document.createElement("div");
      b.className = "kz-bubble kz-bubble--act kz-bubble--meet" + (fin ? " kz-bubble--meetend" : "");
      b.setAttribute("role", "status");
      const minutes = Math.max(1, Math.round(Number(info.minutes) || (fin ? 5 : 3)));
      b.appendChild(mkPill(fin
        ? kzMsg("meetingEndPill", "Fin dans {n} min").replace("{n}", minutes)
        : kzMsg("meetingSoonPill", "Rendez-vous dans {n} min").replace("{n}", minutes), fin ? "meetend" : "meet"));
      const titre = document.createElement("div");
      titre.className = "kz-meet-title";
      titre.textContent = String(info.title || "").trim() || kzMsg("meetingUntitled", "Sans titre");
      b.appendChild(titre);
      const compte = document.createElement("div");
      compte.className = "kz-meet-count";
      b.appendChild(compte);
      const quand = document.createElement("div");
      quand.className = "kz-meet-when";
      quand.textContent = fin
        ? kzMsg("meetingUntil", "jusqu'à {h}").replace("{h}", agendaHeure(info.end))
        : meetingWhenLine(info.start, Number(info.people) || 0);
      b.appendChild(quand);
      const echeance = Number(fin ? info.end : info.start) || 0;
      const tick = () => {
        const reste = echeance - Date.now();
        if (reste >= 0) {
          compte.textContent = (fin ? kzMsg("meetingEndCountdown", "Se termine dans {t}") : kzMsg("meetingCountdown", "Commence dans {t}")).replace("{t}", fmtCount(reste));
        } else {
          compte.textContent = (fin ? kzMsg("meetingEnded", "Terminé depuis {t}") : kzMsg("meetingStarted", "A commencé il y a {t}")).replace("{t}", fmtCount(-reste));
        }
      };
      tick();
      b.kzTimer = setInterval(tick, 1000);
      const actions = document.createElement("div");
      actions.className = "kz-actions";
      if (!fin && info.url && /^https?:\/\//i.test(String(info.url))) {
        const join = document.createElement("button");
        join.type = "button"; join.className = "kz-btn kz-btn--join"; join.textContent = kzMsg("meetingJoin", "Rejoindre la visio");
        // Le lien vient de l'invitation, parfois
        // externe ; son site est dit avant le clic.
        try { join.title = new URL(info.url).hostname; } catch (e) { /* noop */ }
        kzMarqueVu(join);
        join.addEventListener("click", (e) => { e.stopPropagation(); if (kzGesteReel(e) && kzBienVisible(join)) onJoin(); });
        actions.appendChild(join);
      }
      // Prevenir les participants, 2026-09-22 : avant le debut seulement, et
      // seulement si la boite d'envoi est choisie dans le popup.
      if (!fin && info.canNotify && info.id) {
        const prev = document.createElement("button");
        prev.type = "button"; prev.className = "kz-btn kz-btn--notify"; prev.textContent = kzMsg("notifyButtonShort", "Prévenir");
        prev.addEventListener("click", (e) => { e.stopPropagation(); openNotifyPanel(b, info, onClose); });
        actions.appendChild(prev);
      }
      const close = document.createElement("button");
      close.type = "button"; close.className = "kz-btn kz-btn--close"; close.textContent = kzMsg("meetingClose", "Fermer");
      close.addEventListener("click", (e) => { e.stopPropagation(); onClose(); });
      actions.appendChild(close);
      b.appendChild(actions);
      return b;
    }

    // Le volet Prevenir, dans la bulle de rendez-vous. Trois messages prets
    // (retard de 5 ou 10 minutes, absence), les destinataires en puces que
    // l'on peut retirer, le texte relisible et modifiable, un seul bouton
    // Envoyer. Rien ne part sans ce clic. Le compte a rebours et les actions
    // de la bulle sont masques pendant ce temps et reviennent apres.
    function notifyErrText(code) {
      if (code === "notify_off") return kzMsg("notifyErrOff", "Active « Prévenir les participants » dans Koala Zen.");
      if (code === "missing_scope" || code === "invalid_token") return kzMsg("notifyErrScope", "Le jeton n'a pas le périmètre workspace:mail.");
      if (code === "offline") return kzMsg("notifyErrOffline", "Pas de connexion. Réessaie.");
      if (code === "rate_limited") return kzMsg("notifyErrRate", "Trop d'envois en peu de temps. Réessaie dans un moment.");
      if (code === "not_allowed") return kzMsg("notifyErrExpired", "Cette bulle a expiré. Passe par Koala Zen pour prévenir.");
      if (code === "bad_recipients") return kzMsg("notifyErrRecipients", "Un destinataire ne fait pas partie des invités. Rien n'est parti.");
      if (code === "not_configured") return kzMsg("notifyErrTokens", "Il manque un jeton. Colle-le dans Koala Zen, carte Agenda.");
      if (code === "no_recipients") return kzMsg("notifyNoRecipients", "Personne à prévenir.");
      if (code === "already_sent") return kzMsg("notifyAlready", "Déjà envoyé");
      return kzMsg("notifyErrGeneric", "Envoi impossible. Réessaie, ou écris depuis kMail.");
    }
    async function demande(msg) {
      try { const r = await api.runtime.sendMessage(msg); return r || { ok: false, error: "unknown" }; }
      catch (e) { return { ok: false, error: "unknown" }; }
    }
    // La fusee du mail parti : une seconde et demie, puis la confirmation.
    // Rien de tout ca en mouvement reduit, la confirmation suffit.
    const ROCKET_SVG = '<svg viewBox="0 0 40 64" aria-hidden="true"><path class="kz-rocket-flame" d="M14 50 Q20 64 26 50 Q20 56 14 50 Z" fill="#F5C877"/><path d="M20 2 C30 12 32 30 30 46 L10 46 C8 30 10 12 20 2 Z" fill="#FFFFFF" stroke="#1F63A8" stroke-width="2"/><circle cx="20" cy="24" r="5" fill="#EDF4FC" stroke="#1F63A8" stroke-width="2"/><path d="M10 34 L2 46 L10 46 Z M30 34 L38 46 L30 46 Z" fill="#1F63A8"/></svg>';
    function mkRocket() {
      const w = document.createElement("div");
      w.className = "kz-rocket";
      const trail = document.createElement("div"); trail.className = "kz-rocket-trail";
      w.appendChild(trail);
      const svg = svgFromString(ROCKET_SVG);
      if (svg) w.appendChild(svg);
      return w;
    }
    function openNotifyPanel(b, info, onClose) {
      if (b.kzPanelClose) return;
      const caches = Array.prototype.filter.call(b.children, (n) => n.classList.contains("kz-meet-count") || n.classList.contains("kz-meet-when") || n.classList.contains("kz-actions"));
      caches.forEach((n) => n.classList.add("kz-hide"));
      const panel = document.createElement("div");
      panel.className = "kz-notify";
      // Un clic n'importe ou dans le volet (champ, puces) ne doit jamais
      // remonter au koala, dont le clic ferme : le champ devenait ineditable.
      panel.addEventListener("click", (e) => { e.stopPropagation(); });
      panel.addEventListener("mousedown", (e) => { e.stopPropagation(); });
      panel.addEventListener("keydown", (e) => { e.stopPropagation(); });
      panel.addEventListener("keyup", (e) => { e.stopPropagation(); });
      panel.addEventListener("keypress", (e) => { e.stopPropagation(); });
      const attente = document.createElement("div");
      attente.className = "kz-notify-msg";
      attente.textContent = kzMsg("notifyLoading", "Chargement des participants…");
      panel.appendChild(attente);
      b.appendChild(panel);
      const fermerPanel = () => {
        if (panel.parentNode) panel.remove();
        caches.forEach((n) => n.classList.remove("kz-hide"));
        b.kzPanelClose = null;
      };
      b.kzPanelClose = fermerPanel;
      // Le jeton d'envoi remis par le fond avec
      // cette bulle. Sans lui, le fond refuse de preparer comme d'envoyer.
      demande({ type: "kz-notify-prepare", id: info.id, nonce: info.notifyNonce || "" }).then((data) => {
        if (!b.kzPanelClose) return;
        panel.textContent = "";
        if (!data.ok) {
          const err = document.createElement("div");
          err.className = "kz-notify-msg kz-notify-msg--err";
          err.textContent = notifyErrText(data.error);
          panel.appendChild(err);
          const acts = document.createElement("div"); acts.className = "kz-actions";
          const retour = document.createElement("button"); retour.type = "button"; retour.className = "kz-btn kz-btn--close"; retour.textContent = kzMsg("notifyBack", "Retour");
          retour.addEventListener("click", (e) => { e.stopPropagation(); fermerPanel(); });
          acts.appendChild(retour); panel.appendChild(acts);
          return;
        }
        data.nonce = info.notifyNonce || "";
        buildNotifyForm(panel, data, fermerPanel, onClose);
      });
    }
    function buildNotifyForm(panel, data, fermerPanel, onClose) {
      const kinds = [["late5", kzMsg("notifyLate5", "5 min de retard")], ["late10", kzMsg("notifyLate10", "10 min de retard")], ["absent", kzMsg("notifyAbsent", "Absence")]];
      const sent = Array.isArray(data.sent) ? data.sent : [];
      let kind = (kinds.find((k) => sent.indexOf(k[0]) < 0) || kinds[0])[0];
      let destinataires = (data.recipients || []).slice();
      const rangee = document.createElement("div"); rangee.className = "kz-notify-kinds";
      const boutons = {};
      const subj = document.createElement("div"); subj.className = "kz-notify-subj";
      // Le texte se relit et se retouche ici (demande de Thomas, 2026-09-22) ;
      // l'objet reste construit par le fond.
      const ta = document.createElement("textarea"); ta.className = "kz-notify-body"; ta.setAttribute("aria-label", kzMsg("notifyBodyLabel", "Message"));
      let gabaritCourant = "";
      const applique = () => {
        Object.keys(boutons).forEach((k) => boutons[k].classList.toggle("kz-kind--on", k === kind));
        const g = (data.templates && data.templates[kind]) || { subject: "", body: "" };
        subj.textContent = "";
        const lab = document.createTextNode(kzMsg("notifySubject", "Objet") + " : ");
        const bold = document.createElement("b"); bold.textContent = g.subject;
        subj.appendChild(lab); subj.appendChild(bold);
        // Le texte n'est remplace que s'il n'a pas ete retouche.
        if (!ta.value || ta.value === gabaritCourant) ta.value = g.body;
        gabaritCourant = g.body;
      };
      kinds.forEach(([k, lib]) => {
        const bt = document.createElement("button"); bt.type = "button"; bt.className = "kz-kind"; bt.textContent = lib;
        if (sent.indexOf(k) >= 0) { bt.disabled = true; bt.title = kzMsg("notifyAlready", "Déjà envoyé"); bt.textContent = "✓ " + lib; }
        bt.addEventListener("click", (e) => { e.stopPropagation(); kind = k; applique(); });
        boutons[k] = bt; rangee.appendChild(bt);
      });
      panel.appendChild(rangee);
      const a = document.createElement("div"); a.className = "kz-notify-to";
      const labA = document.createElement("span"); labA.className = "kz-notify-lab"; labA.textContent = kzMsg("notifyTo", "À") + " :";
      a.appendChild(labA);
      const msgLigne = document.createElement("div"); msgLigne.className = "kz-notify-msg";
      const acts = document.createElement("div"); acts.className = "kz-actions";
      const envoyer = document.createElement("button"); envoyer.type = "button"; envoyer.className = "kz-btn kz-btn--send"; envoyer.textContent = kzMsg("notifySend", "Envoyer");
      // Grise le temps d'etre vu : un clic trop rapide ne
      // passe pas, et ca se voit au lieu d'etre ignore en silence.
      let envoyerPret = false;
      const retour = document.createElement("button"); retour.type = "button"; retour.className = "kz-btn kz-btn--close"; retour.textContent = kzMsg("notifyBack", "Retour");
      const fermerTout = document.createElement("button"); fermerTout.type = "button"; fermerTout.className = "kz-btn kz-btn--close"; fermerTout.textContent = kzMsg("meetingClose", "Fermer");
      fermerTout.addEventListener("click", (e) => { e.stopPropagation(); fermerPanel(); if (typeof onClose === "function") onClose(); });
      const dessinePuces = () => {
        Array.prototype.slice.call(a.querySelectorAll(".kz-chip")).forEach((n) => n.remove());
        destinataires.forEach((d) => {
          const chip = document.createElement("span"); chip.className = "kz-chip";
          const n = document.createElement("span"); n.className = "kz-chip-n"; n.textContent = d.name || d.address; n.title = d.address;
          const x = document.createElement("button"); x.type = "button"; x.className = "kz-chip-x"; x.textContent = "×";
          x.setAttribute("aria-label", kzMsg("notifyRemove", "Retirer {n}").replace("{n}", d.name || d.address));
          x.addEventListener("click", (e) => { e.stopPropagation(); destinataires = destinataires.filter((z) => z.address !== d.address); dessinePuces(); });
          chip.appendChild(n); chip.appendChild(x); a.appendChild(chip);
        });
        envoyer.disabled = destinataires.length === 0 || !envoyerPret;
        msgLigne.textContent = destinataires.length === 0 ? kzMsg("notifyNoRecipients", "Personne à prévenir.") : "";
        msgLigne.className = "kz-notify-msg" + (destinataires.length === 0 ? " kz-notify-msg--err" : "");
      };
      dessinePuces();
      panel.appendChild(a); panel.appendChild(subj); panel.appendChild(ta); panel.appendChild(msgLigne);
      applique();
      envoyer.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (envoyer.disabled || !kzGesteReel(e) || !kzBienVisible(envoyer)) return;
        envoyer.disabled = true; retour.disabled = true;
        envoyer.textContent = kzMsg("notifySending", "Envoi…");
        const r = await demande({ type: "kz-notify-send", id: data.id, nonce: data.nonce, kind: kind, body: ta.value, to: destinataires.map((d) => d.address) });
        if (!r.ok) {
          envoyer.disabled = false; retour.disabled = false; envoyer.textContent = kzMsg("notifySend", "Envoyer");
          msgLigne.textContent = notifyErrText(r.error); msgLigne.className = "kz-notify-msg kz-notify-msg--err";
          return;
        }
        panel.textContent = "";
        const ok = document.createElement("div"); ok.className = "kz-notify-msg kz-notify-msg--ok";
        ok.textContent = (r.count === 1 ? kzMsg("notifySentOne", "Envoyé à 1 personne") : kzMsg("notifySentMany", "Envoyé à {n} personnes").replace("{n}", r.count));
        const anime = !reduceMotion();
        if (anime) panel.appendChild(mkRocket());
        panel.appendChild(ok);
        setTimeout(() => { if (panel.parentNode) fermerPanel(); }, anime ? 2600 : 1800);
      });
      retour.addEventListener("click", (e) => { e.stopPropagation(); fermerPanel(); });
      acts.appendChild(envoyer); acts.appendChild(retour); acts.appendChild(fermerTout); panel.appendChild(acts);
      kzMarqueVu(envoyer);
      setTimeout(() => { envoyerPret = true; if (destinataires.length && envoyer.textContent === kzMsg("notifySend", "Envoyer")) envoyer.disabled = false; }, KZ_VU_MS);
      try { ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; } catch (e) { /* noop */ }
    }
    function agendaHeure(ts) {
      const d = new Date(Number(ts) || 0);
      return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    }

    // La bulle d'agenda a l'ecran, s'il y en a une, pour qu'une nouvelle la
    // remplace au lieu d'etre refusee : la fin d'un rendez-vous chasse son
    // debut, le debut du suivant chasse la fin du precedent.
    let meetingActive = null;

    // repondre({shown}) n'est appele qu'une fois la bulle vraiment posee, ou
    // avec shown a faux si quoi que ce soit echoue avant : background.js ne
    // bascule sur la notification du systeme que sur une reponse honnete,
    // jamais sur une promesse d'affichage qui aurait pu echouer ensuite.
    async function runMeeting(info, kind, repondre) {
      running = true;
      let k = null;
      let annonce = false;
      let b = null;
      let desarme = null;
      try {
        const shadow = ensureShadow();
        await loadSettings();
        shadow.querySelectorAll(".kz-koala").forEach((n) => n.remove());
        k = buildKoala(shadow, pickKoala("reminder"));
        let fini = false;
        // Echap et un clic sur le koala ferment d'abord le volet Prevenir s'il
        // est ouvert, la bulle ensuite.
        // armEscape n'ecoute qu'une fois : apres avoir ferme le volet, on se
        // rearme pour que l'Echap suivant ferme bien la bulle.
        const fermer = () => { if (b && b.kzPanelClose) { b.kzPanelClose(); desarme = armEscape(fermer); return; } fini = true; };
        meetingActive = { close: () => { fini = true; } };
        k.addEventListener("click", fermer);
        playEnter(k);
        await sleep(T.arrive + 60);
        b = buildMeetingBubble(info, kind, () => {
          try { api.runtime.sendMessage({ type: "kz-open-url", url: info.url }); } catch (e) { /* noop */ }
          fermer();
        }, fermer);
        openBubble(k, b);
        stagger(b);
        desarme = armEscape(fermer);
        annonce = true;
        repondre({ shown: true });
        // Aucun delai : la bulle reste, avec son compte a rebours, jusqu'a
        // Fermer, Rejoindre, Echap, un clic sur le koala, ou la bulle suivante.
        while (!fini) await sleep(150);
        await playExit(k);
      } catch (e) {
        try { console.warn("Koala Zen, rappel de rendez-vous interrompu,", e && e.message); } catch (_) { /* noop */ }
        if (!annonce) repondre({ shown: false });
      } finally {
        if (desarme) desarme();
        if (b && b.kzTimer) clearInterval(b.kzTimer);
        if (k && k.parentNode) k.remove();
        meetingActive = null;
        running = false;
      }
    }

    async function accueilleMeeting(msg, kind, repondre) {
      if (running && meetingActive) {
        // Une bulle d'agenda est deja la : elle cede la place, on attend
        // qu'elle soit partie (sortie animee comprise) avant de poser l'autre.
        meetingActive.close();
        for (let i = 0; i < 30 && running; i++) await sleep(100);
      }
      if (running) { repondre({ shown: false }); return; }
      await runMeeting(msg, kind, repondre);
    }

    api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (!msg) return;
      if (msg.type === "kz-show") {
        runSequence({
          focus: msg.focus,
          focusSeconds: msg.focusSeconds,
          screenToday: msg.screenToday,
          intervalMinutes: msg.intervalMinutes,
          doneToday: msg.doneToday,
          habitGoal: msg.habitGoal,
          streak: msg.streak
        });
        return;
      }
      if (msg.type === "kz-meeting-soon" || msg.type === "kz-meeting-end") {
        // Si un rappel d'habitude est deja a l'ecran, la page decline tout de
        // suite et background.js bascule sur une notification. Une bulle
        // d'agenda deja la cede sa place. Sinon la reponse est differee
        // (return true) jusqu'a ce que la bulle soit posee.
        let repondu = false;
        const repondre = (r) => {
          if (repondu) return;
          repondu = true;
          try { if (typeof sendResponse === "function") sendResponse(r); } catch (e) { /* noop */ }
        };
        accueilleMeeting(msg, msg.type === "kz-meeting-end" ? "end" : "soon", repondre);
        return true;
      }
    });
  })();
}
