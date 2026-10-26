# Moving Books Pro to its own repository

**Intended new repository:** `MrCedric-max/books-pro` (private suggested) — does not exist yet.

## Status (2026-10-26)

Creating the repo from this Arena session was attempted with
`gh repo create MrCedric-max/books-pro --private` and GitHub refused it:

> GraphQL: Resource not accessible by integration (createRepository)

This session's GitHub token is scoped to `MrCedric-max/school-manager` only, and the
session itself can only push to its own branch. So the repo must be created once
by the account owner, then the project (already packaged) is moved across.

## Step 1 — create the empty repo (30 seconds, owner only)

1. Go to https://github.com/new
2. Owner: `MrCedric-max` · Repository name: `books-pro`
3. Choose **Private** (recommended — school/book material)
4. Do **NOT** add a README, .gitignore or licence (the export brings its own)
5. Click **Create repository**

## Step 2 — move the project (pick one)

### Route A — new Arena session (easiest)
Start a new Arena session linked to `books-pro` and say:
"Copy the Books Pro project from MrCedric-max/school-manager (root of branch
arena/605bce77-school-manager) into this repo, excluding azobe-school-manager/."

### Route B — locally
```bash
# from a clone of school-manager, on branch arena/605bce77-school-manager:
bash scripts/export-to-new-repo.sh /tmp/books-pro
cd /tmp/books-pro
git remote add origin https://github.com/MrCedric-max/books-pro.git
git push -u origin main
```
The export script copies only the Books Pro project (root `index.html`, `assets/`,
`data/`, `scripts/`, README, this file), initialises git, and makes a first commit.
It deliberately excludes `azobe-school-manager/` and this repo's `.git`.

## After the move
- Optionally enable GitHub Pages on the new repo (Settings → Pages → main branch).
- If books are added to the Drive folder, update `data/books-pro.json` and re-run
  `python3 scripts/build_books_data.py`.
