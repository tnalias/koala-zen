#!/bin/bash
# Campagne complete. Lancee depuis la racine du depot, ou avec un chemin de build.
set -u
cd "$(dirname "$0")/.."
export NODE_PATH="${NODE_PATH:-$(pwd)/node_modules}"

cibles=("$@")
if [ ${#cibles[@]} -eq 0 ]; then
  if [ -f manifest.json ]; then cibles=(".")
  else cibles=(build/koala-zen); fi
fi

total=0
for d in "${cibles[@]}"; do
  echo "################ $d"
  for f in background kdrive content popup backup lot phrases passages rendu_passages; do
    node "tests/test_$f.js" "$d"
    total=$((total + $?))
  done
  python3 tests/test_conformite.py "$d"
  total=$((total + $?))
  python3 tests/test_integrite.py "$d"
  total=$((total + $?))
  echo
done
if [ $total -eq 0 ]; then echo "################ bilan global : TOUT EST VERT"
else echo "################ bilan global : $total suites en echec"; fi
exit $total
