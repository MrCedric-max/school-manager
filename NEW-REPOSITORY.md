# Books Pro — where it lives

Created 2026-10-26. Copied out of `MrCedric-max/school-manager` (branch
`arena/605bce77-school-manager`, root level) into a repository of its own,
**excluding** `azobe-school-manager/`.

## What was copied

`index.html`, `assets/` (`app.js`, `books-data.js`, `styles.css`), `data/books-pro.json`,
`docs/BOOKS-PRO.md`, `scripts/build_books_data.py`, `scripts/export-to-new-repo.sh`,
`README.md` and this file. Nothing from `azobe-school-manager/` was copied, and that
path is listed in `.gitignore` so it cannot creep back in.

Two small edits were made after copying, because the excluded folder was referenced:

- `index.html` footer no longer links to `azobe-school-manager/`.
- `scripts/build_books_data.py` takes the path to `school-data.js` as an argument
  (`python3 scripts/build_books_data.py /path/to/school-data.js`) instead of assuming
  the file sits in `azobe-school-manager/`. `assets/books-data.js` is already generated,
  so nothing needs rebuilding for normal use.

## Push status

| Target | Status |
|---|---|
| `MrCedric-max/school-manager` | ✅ writable — the copy was committed on branch `arena/8ab4e29e-school-manager` |
| `MrCedric-max/Books-pro` | ❌ not writable from the school-manager session: `git ls-remote` → `403 — Write access to repository not granted`, and the GitHub token cannot see the repo (`gh api repos/MrCedric-max/Books-pro` → 404) |

To finish the move, open an Arena session **linked to `MrCedric-max/Books-pro`** and ask it
to import the root of `arena/8ab4e29e-school-manager` from `MrCedric-max/school-manager`
(excluding `azobe-school-manager/`), or push from a local clone:

```bash
git clone -b arena/8ab4e29e-school-manager https://github.com/MrCedric-max/school-manager.git books-pro-export
cd books-pro-export
git remote add bookspro https://github.com/MrCedric-max/Books-pro.git
git push bookspro HEAD:main
```

`scripts/export-to-new-repo.sh /tmp/Books-pro` still works if you prefer a clean
single-commit copy instead of the migration branch.

## After the move

- Optionally enable GitHub Pages (Settings → Pages → `main`) — the app is static, no build step.
- If books are added to the Drive `books pro` folder, update `data/books-pro.json` and
  re-run `python3 scripts/build_books_data.py` with a `school-data.js` path.
