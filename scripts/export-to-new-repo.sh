#!/usr/bin/env bash
# Package this Books Pro project into a standalone folder (e.g. for an archive copy).
# Usage: bash scripts/export-to-new-repo.sh /path/to/destination
set -euo pipefail
DEST="${1:?Usage: bash scripts/export-to-new-repo.sh /path/to/destination}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$DEST"
cp "$SRC/index.html" "$SRC/README.md" "$SRC/NEW-REPOSITORY.md" "$SRC/.gitignore" "$DEST/"
cp -r "$SRC/assets" "$SRC/data" "$SRC/docs" "$DEST/"
mkdir -p "$DEST/scripts"
cp "$SRC/scripts/build_books_data.py" "$DEST/scripts/"
cd "$DEST"
[ -d .git ] || git init -q -b main
git add -A
git -c user.name="Books Pro" -c user.email="books-pro@localhost" commit -qm "Books Pro — English learning & curriculum app (from Drive folder 'books pro')" || true
echo "Packaged Books Pro into $DEST"
