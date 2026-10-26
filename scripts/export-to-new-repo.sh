#!/usr/bin/env bash
# Export ONLY the Books Pro project (root level) into a fresh git repo folder.
# Usage: bash scripts/export-to-new-repo.sh /path/to/new/books-pro
set -euo pipefail
DEST="${1:?Usage: bash scripts/export-to-new-repo.sh /path/to/destination}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$DEST"
cp "$SRC/index.html" "$SRC/README.md" "$SRC/NEW-REPOSITORY.md" "$DEST/"
cp -r "$SRC/assets" "$SRC/data" "$DEST/"
mkdir -p "$DEST/scripts"
cp "$SRC/scripts/build_books_data.py" "$DEST/scripts/"
cat > "$DEST/.gitignore" <<'EOF'
azobe-school-manager/
*.log
EOF
cd "$DEST"
[ -d .git ] || git init -q -b main
git add -A
git -c user.name="Books Pro" -c user.email="books-pro@localhost" commit -qm "Books Pro — English learning & curriculum app (from Drive folder 'books pro')" || true
echo "Exported Books Pro to $DEST"
echo "Next: git -C $DEST remote add origin https://github.com/MrCedric-max/books-pro.git && git -C $DEST push -u origin main"
