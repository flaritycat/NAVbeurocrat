# nav

`nav` er en personvernvennlig hjelpeveiviser for privatpersoner i Norge som trenger hjelp til å orientere seg i støtteordninger, rettigheter og riktige første kontaktpunkter. Løsningen viderefører designretningen fra `kommune`, men er bygget som en frontend-only modul uten innlogging og uten serverlagring av brukersvar.

Offentlig base path er `https://dev.raoul.no/nav`.

## Hva modulen gjør

- leder brukeren gjennom ett spørsmål om gangen
- starter i situasjonen brukeren står i, ikke i navnet på en ytelse
- prioriterer akutte forhold tydelig, også når helse eller trygghet haster
- foreslår relevante ordninger, tjenester og hjelpetiltak hos NAV, kommunen, Husbanken eller helsetjenesten
- viser vanlig dokumentasjon som bør samles
- viser hva brukeren kan be om i kontakt med hjelpeapparatet
- viser en kort `før kontakt`-oversikt med hva brukeren kan si, ha klart og be om
- bygger også `telefonkort` og `møteark` som korte lokale arbeidsflater for mobil, telefon og møte
- deler resultatet i `gjør dette i dag`, `gjør dette denne uken` og `dette kan vente litt`
- skiller mellom hovedløp, parallelle løp og støtteløp
- forklarer hvorfor andre spor ikke er løftet høyere akkurat nå
- skiller tydelig mellom nødhjelp, rettigheter, praktisk hjelp og veiledning
- markerer svar som virker uklare eller motstridende, slik at brukeren kan rydde før videre kontakt
- genererer saklig forslag til formulering for kontakt, melding eller forberedelse
- peker videre til offisielle kilder på `nav.no`, `husbanken.no`, `helsenorge.no` og `statsforvalteren.no`
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

4. Kjør tester:

   ```bash
   docker run --rm -v "$PWD/frontend:/app" -w /app node:20-alpine npm test
   ```

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
- Hjelpemidler og tilrettelegging
- Grunnstønad
- Hjelpestønad
- Pleiepenger for sykt barn
- Opplæringspenger
- Helseoppfølging og dokumentasjon
- Klage og juridisk veiledning
- Brev, vedtak og frister som eget inngangsspor
- Ung eller førstegangskontakt som eget inngangsspor

## Dokumentasjon

Se [docs/solution-architecture.md](/home/project/NAV/docs/solution-architecture.md) for:

- informasjonsarkitektur
- komponentstruktur
- datamodell for regelmotoren
- første spørsmålstre
- personvernarkitektur
- videre utvidelsesplan
