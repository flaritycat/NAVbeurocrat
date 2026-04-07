# nav

`nav` er en personvernvennlig veiviser for privatpersoner i Norge som trenger hjelp til å orientere seg i NAV-systemet. Løsningen viderefører designretningen fra `kommune`, men er bygget som en frontend-only modul uten innlogging og uten serverlagring av brukersvar.

Offentlig base path er `https://dev.raoul.no/nav`.

## Hva modulen gjør

- leder brukeren gjennom ett spørsmål om gangen
- starter i situasjonen brukeren står i, ikke i navnet på en ytelse
- prioriterer akutte forhold tydelig
- foreslår relevante ordninger, tjenester og hjelpetiltak
- viser vanlig dokumentasjon som bør samles
- genererer saklig forslag til formulering mot NAV
- peker videre til offisielle kilder på `nav.no` og `husbanken.no`
- lar brukeren kopiere tekst og eksportere resultatet til PDF

## Personvernmodell

- ingen innlogging
- ingen backend for brukersaker
- ingen database for personsaker
- alle brukersvar holdes i `sessionStorage` i nettleseren
- ingen spørsmålsdata eller resultater sendes til serveren som en personlig sak
- innholdsredigering skjer bare lokalt i nettleseren via JSON-utkast

## Prosjektstruktur

```text
NAV/
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── content/
│   │   ├── features/guide/
│   │   ├── lib/
│   │   └── styles/
├── infra/nginx/
├── docs/
├── docker-compose.yml
└── .env.example
```

## Viktige byggesteiner

- Frontend: React + Vite + TypeScript
- PDF-eksport: `jspdf`
- Klientlagring:
  - veivisersvar i `sessionStorage`
  - lokal innholdsredigering i `localStorage`
- Innholdsstyring:
  - `questions.json`
  - `acuteLogic.json`
  - `recommendations.json`
  - `documentLists.json`
  - `phraseTemplates.json`
  - `officialLinks.json`
  - `disclaimers.json`
- Drift:
  - Nginx i frontend-container
  - base path `/nav`
  - health-endepunkter `/nav/healthz` og `/nav/readyz`

## Lokal kjøring

1. Opprett miljøfil:

   ```bash
   cp .env.example .env
   ```

2. Start modulen:

   ```bash
   docker compose up --build -d
   ```

3. Åpne:

   - App: `http://127.0.0.1:18081/nav/`
   - Health: `http://127.0.0.1:18081/nav/healthz`
   - Ready: `http://127.0.0.1:18081/nav/readyz`

## Base path `/nav`

- Vite bygges med `VITE_APP_BASE_PATH=/nav/`
- React Router kjører med `basename=/nav`
- Nginx serverer SPA-en under `/nav/`
- både `/nav` og `/nav/` fungerer offentlig
- uppercase `/NAV` håndteres også av samme modul

## Containerstrategi

Modulen følger samme enkle containerstrategi som `kommune`, men uten backend:

- `nav-frontend`: eneste applikasjonscontainer
- eksponeres på loopback-port `127.0.0.1:${NAV_PUBLIC_PORT}`
- kobles til eksisterende edge-nettverk `arctic_edge_public`
- reverse proxy i `Environ` ruter `/nav*` til `nav-frontend:8080`

## Innholdsredigering

`/nav/admin` er en enkel lokal innholdsside for redigering av JSON-konfig:

- lagres bare lokalt i nettleseren
- overstyrer standardinnholdet lokalt
- kan kopieres ut og legges i git ved behov
- påvirker ikke lagring av brukersvar

## Innholdsmodeller som er inkludert

- Dagpenger
- Økonomisk sosialhjelp
- Arbeidsavklaringspenger (AAP)
- Kvalifiseringsprogram
- Økonomi- og gjeldsrådgivning
- Bostøtte
- Midlertidig botilbud ved akutt behov
- Hjelp til å komme i arbeid

## Dokumentasjon

Se [docs/solution-architecture.md](/home/project/NAV/docs/solution-architecture.md) for:

- informasjonsarkitektur
- komponentstruktur
- datamodell for regelmotoren
- første spørsmålstre
- personvernarkitektur
- videre utvidelsesplan
