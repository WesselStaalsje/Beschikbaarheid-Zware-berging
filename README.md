# Zware Berging – Plusdiensten

Productieklare mobiele webapp voor de status van Plusbergers per vestiging. De app heeft drie statussen: **Niet in dienst**, **Beschikbaar** en **Bezig**. Wijzigingen worden centraal opgeslagen en iedere vier seconden gesynchroniseerd.

## Uitrollen op Vercel

1. Pak de ZIP uit en zet de map in een GitHub-repository.
2. Kies in Vercel **Add New → Project** en importeer de repository.
3. Voeg via **Storage / Marketplace** een **Neon Postgres**-database toe aan dit project. Hierdoor wordt `DATABASE_URL` automatisch ingesteld.
4. Voeg bij **Settings → Environment Variables** toe:
   - `APP_USER`: bijvoorbeeld `meldkamer`
   - `APP_PASSWORD`: een lang, uniek wachtwoord
5. Start daarna de deployment opnieuw. De build maakt de vereiste tabel automatisch aan.

De Vercel-build stopt bewust wanneer `DATABASE_URL` ontbreekt. Zo wordt nooit per ongeluk een versie zonder centrale opslag gepubliceerd.

## Lokaal starten

```bash
cp .env.example .env.local
npm install
npm run db:setup
npm run dev
```

Open `http://localhost:3000`. De browser vraagt om de ingestelde gebruikersnaam en het wachtwoord.

## Installeren op telefoon

- **iPhone/iPad:** open de site in Safari, kies **Delen → Zet op beginscherm**.
- **Android:** open de site in Chrome en kies **App installeren**.

De app opent daarna beeldvullend vanaf het beginscherm. Een internetverbinding blijft vereist, omdat de getoonde statussen altijd centraal en actueel moeten zijn.
