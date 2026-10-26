# Books Pro — its own repository

**New repository (created by the owner):** https://github.com/MrCedric-max/Books-pro

## Status (2026-10-26)

- ✅ The owner created the `Books-pro` repository on GitHub.
- ❌ This Arena session still cannot write to it. Its GitHub token is scoped to
  `MrCedric-max/school-manager` only: `gh repo view MrCedric-max/Books-pro` cannot
  resolve it, and `git ls-remote https://github.com/MrCedric-max/Books-pro.git`
  returns `403 — Write access to repository not granted`.
- Therefore the project cannot be pushed to `Books-pro` from this session. Use
  Route A or B below — both are already prepared and tested.

## Route A — new Arena session (easiest)

Start a new Arena session linked to **Books-pro** and say:

> Copy the Books Pro project from MrCedric-max/school-manager (root of branch
> arena/605bce77-school-manager) into this repo, excluding azobe-school-manager/.

That session's token will be scoped to Books-pro, so it can push there.

## Route B — locally

```bash
# from a clone of school-manager, on branch arena/605bce77-school-manager:
bash scripts/export-to-new-repo.sh /tmp/Books-pro
cd /tmp/Books-pro
git remote add origin https://github.com/MrCedric-max/Books-pro.git
git push -u origin main
```

The export script copies only the Books Pro project (root `index.html`, `assets/`,
`data/`, `scripts/`, README and this file), initialises git, and makes a first
commit. It deliberately excludes `azobe-school-manager/` and this repo's `.git`.

## After the move

- Optionally enable GitHub Pages on Books-pro (Settings → Pages → main branch).
- If books are added to the Drive `books pro` folder, update `data/books-pro.json`
  and re-run `python3 scripts/build_books_data.py`.
