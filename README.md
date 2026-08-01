# hackathon 2026

A simple page for saving website URLs. Built with Vite + React + TypeScript.

Saved URLs are held in memory only, so the list resets when you refresh the
page. All of that state lives in `src/hooks/useSavedUrls.ts` — swap that one
file to add `localStorage` or a backend later.

## Getting started

```bash
npm install
npm run dev
```

Then open the localhost URL that Vite prints.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run oxlint |
