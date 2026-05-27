# Team Logos

Drop PNG files here (e.g. `wahda.png`, `jaish.png`).

Then reference them from `src/data/standings.json` using:

```json
"logo": "/src/assets/logos/wahda.png"
```

Vite will resolve `/src/...` paths at build time. Alternatively, import each
logo in `App.jsx` and inject the resolved URL into the data before passing it
to `RankChart`.
