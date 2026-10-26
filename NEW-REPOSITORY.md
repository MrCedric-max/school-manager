# Moving Books Pro to its own repository

**Intended new repository:** `books-pro` (under the same GitHub account, i.e. `MrCedric-max/books-pro`) — rename freely.

## Why a manual step is needed

This project was built in an Arena session that is permanently bound to the
`MrCedric-max/school-manager` repository and its session branch. That session can
only commit/push there, so it cannot create or push to the new repository for you.
One of these two routes will do it:

## Route A — new Arena session (easiest)

1. On GitHub, create an empty repository named **books-pro** (no README, no .gitignore).
2. Start a new Arena session linked to `books-pro` and say:
   "Copy the Books Pro project from MrCedric-max/school-manager (root of branch
   arena/605bce77-school-manager) into this repo, excluding azobe-school-manager/."

## Route B — do it locally (5 minutes)

```bash
# from a clone of this repo, on the session branch:
bash scripts/export-to-new-repo.sh /tmp/books-pro
cd /tmp/books-pro
git remote add origin https://github.com/MrCedric-max/books-pro.git
git push -u origin main
```

The export script copies only the Books Pro project (root `index.html`, `assets/`,
`data/`, `scripts/`, this file and the README), initialises git, and makes a first
commit. It deliberately excludes `azobe-school-manager/` (the preserved Azobe app)
and this repo's `.git`.

## After the move

- Enable GitHub Pages on the new repo (Settings → Pages → main branch) to publish the app.
- Update the Drive folder id / book catalogue in `data/books-pro.json` if books are added.
