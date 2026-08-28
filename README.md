# Zware Berging – Plusdiensten

Productieklare mobiele webapp voor de status van Plusbergers per vestiging. De app heeft drie statussen: **Niet in dienst**, **Beschikbaar** en **Bezig**. Wijzigingen worden centraal opgeslagen en iedere vier seconden gesynchroniseerd.

## Uitrollen op Vercel

1. Importeer de GitHub-repository als Vercel-project.
2. Voeg via **Storage / Marketplace** een **Neon Postgres**-database toe aan dit project. Hierdoor wordt `DATABASE_URL` automatisch ingesteld.
3. Start daarna de deployment opnieuw. De build maakt de vereiste tabel automatisch aan.

De Vercel-build stopt bewust wanneer `DATABASE_URL` ontbreekt. Zo wordt nooit per ongeluk een versie zonder centrale opslag gepubliceerd.

## Lokaal starten

```bash
cp .env.example .env.local
npm install
npm run db:setup
npm run dev
```

Open `http://localhost:3000`. De app is openbaar toegankelijk en gebruikt geen inlogscherm.

## Installeren op telefoon

- **iPhone/iPad:** open de site in Safari, kies **Delen → Zet op beginscherm**.
- **Android:** open de site in Chrome en kies **App installeren**.

De app opent daarna beeldvullend vanaf het beginscherm. Een internetverbinding blijft vereist, omdat de getoonde statussen altijd centraal en actueel moeten zijn.
