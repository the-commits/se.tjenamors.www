# tjenamors.se

Synthwave-radiostation. Den funkar. Oftast.

## Kom igång

```bash
npm install
node scripts/build.mjs     # src/ → dist/ (Tailwind JIT + minify)
```

`dist/` kommer ut om du har tur. Cloudflare Pages deployar från `main`.
Det är i alla fall planen.

Tailwind CSS JIT kompileras via PostCSS under bygget — använd arbiträr värden
som `mt-[2.5em]` direkt i HTML. Config i `tailwind.config.mjs`.

## Testa

```bash
# Om du orkar
node tests/mobile-centering.mjs
node tests/sun-fade.mjs
node tests/player-spacing.mjs

# Hela skiten (pre-push)
npm run lint && npm run lint:lines && node scripts/build.mjs \
  && node tests/mobile-centering.mjs && node tests/sun-fade.mjs \
  && node tests/abr-speeds.mjs

# Testa mot prod (varför inte)
TEST_URL=https://tjenamors.se node tests/player-spacing.mjs
```

## Deploya

Pusha till `main` så deployar Cloudflare Pages. Pre-push-hooken kör
lint + build + E2E. Använd `SKIP_E2E=1 git push` om du inte bryr dig.

---

**Lyssna på [tjenamors.se](https://tjenamors.se)** det är ändå
nåt att göra.
