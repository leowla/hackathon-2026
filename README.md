# hackathon 2026

State your intention, then save the sites it applies to. Built with Vite +
React + TypeScript.

All frontend code lives in `frontend/`. Two pages, switched by a button —
the front page holds the intention input, and "Page intentions" opens the
URL list.

Nothing persists yet: the intention and the saved URLs are held in memory
and reset on refresh. URL state lives in `frontend/src/hooks/useSavedUrls.ts`
— swap that one file to add `localStorage` or a backend later.

## Getting started

```bash
cd frontend
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
