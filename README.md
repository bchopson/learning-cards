# Learning Cards

Static flashcards built with remark and deployed to GitHub Pages.

## Authoring

Folders under `cards/` are topics; Markdown files are sets. Start each file with
its set title as a top-level heading (`# Title`), followed by one or more alternating
`## Question` and `## Answer` sections (case-insensitive). Use a space after the
heading markers, as required by Markdown. Both sides must be non-empty.

```markdown
# Phonics Set 1

## Question

dog

## Answer

[Listen](dog.m4a)

## Question

What says **meow**?

## Answer

A cat.
```

Put media alongside the Markdown file and use relative URLs. Audio links
(`.m4a`, `.mp3`, `.ogg`, `.wav`, `.aac`, `.webm`) become embedded players.
Images and other Markdown formatting are supported; raw HTML is not rendered.

Math uses LaTeX notation: `$\\pi r^2$` for inline math, or `$$` on separate lines
around a formula for display math. KaTeX renders formulas at build time; its CSS
and fonts are bundled locally, with no browser-side math JavaScript required.

## Build and preview

With Node.js 24+ and Aube installed (`mise install` installs Aube):

```sh
aube ci
aube run test
aube run build
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. The root `index.html` is a template; serve
`dist/`, not the repository root. Generated output is not committed.

The index groups sets by topic. Select a set, reveal each answer, and move
between cards with Previous/Next. Audio stops when changing cards or sets.

## GitHub Pages

In repository **Settings → Pages → Build and deployment**, select
**GitHub Actions** as the source. Push to `main` (or run the workflow manually)
to build and publish `dist/`. Update the workflow branch if your default branch
is different. Pull requests run tests and build without deploying.

Asset URLs are relative, so project sites such as
`https://username.github.io/learning-cards/` work without a base-URL setting.
