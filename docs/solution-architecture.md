# NAV hjelpeveiviser: løsning og arkitektur

## 1. Informasjonsarkitektur

Hovednivåer i produktet:

1. Forside
2. Veiviser
3. Resultat
4. Lokal innholdsredigering

Informasjonsstruktur i resultatet:

- anbefalt hovedspor
- andre spor som også kan være relevante
- hva som haster
- hvem som kan hjelpe videre
- hva brukeren kan be om
- hvorfor dette foreslås
- risiko og avgrensninger
- vanlig dokumentasjon
- forslag til formulering
- kontaktpunkter og offisielle lenker
- forbehold

## 2. Komponentstruktur

Gjenbrukbare komponenter:

- `Layout`
- `PublicNotice`
- `ProgressBar`
- `StatusBadge`
- `CopyBlock`
- `SafeExternalLink`
- `InlineNotice`

Sider:

- `DashboardPage`
- `GuidePage`
- `ResultPage`
- `AdminPage`

Tekniske moduler:

- `contentBundle.ts`
- `contentDrafts.ts`
- `sessionState.ts`
- `ruleEngine.ts`
- `pdf.ts`

## 3. Datamodell for regelmotoren

Spørsmål:

- `id`
- `title`
- `description`
- `selectionMode`
- `showWhenAnyFlags`
- `showWhenAllFlags`
- `showWhenNoFlags`
- `options[]`

Svaralternativ:

- `id`
- `label`
- `description`
- `effects.flags[]`
- `effects.scores{}`
- `effects.rationaleIds[]`

Anbefaling:

- `id`
- `title`
- `owner`
- `category`
- `priority`
- `minScore`
- `summary`
- `documentListIds[]`
- `phraseTemplateId`
- `officialLinkIds[]`
- `rationaleMap{}`

Akuttregel:

- `id`
- `priority`
- `title`
- `summary`
- `whenAnyFlags[]`
- `whenAllFlags[]`
- `whenNoFlags[]`
- `documentListIds[]`
- `officialLinkIds[]`
- `recommendedIds[]`

Støttestrukturer:

- dokumentlister
- formuleringstekster
- offisielle lenker
- disclaimere

## 4. Full UI-flyt

1. Brukeren åpner forsiden.
2. Brukeren starter veiviseren fra knapp eller startkategori.
3. Veiviseren viser ett spørsmål om gangen.
4. Synlige spørsmål bestemmes av tidligere svar og flagg.
5. Når alle synlige spørsmål er besvart, bygges resultatet lokalt i klienten.
6. Brukeren kan:
   - lese anbefalingene
   - kopiere oppsummering
   - kopiere forslag til formulering
   - eksportere PDF
   - gå tilbake og endre svar
7. Innholdsansvarlig kan bruke `/admin` til å teste lokale innholdsjusteringer.

## 5. Forslag til første spørsmålstre

Start:

- mistet jobb / permittert
- mangler penger til nødvendige utgifter
- syk og kan ikke jobbe
- fare for å miste bolig / uten bolig
- gjeld og trenger hjelp
- hjelp til å komme i arbeid
- hjelpemidler / tilrettelegging / støtte i hverdagen
- foresatt eller omsorgsperson som trenger oversikt
- vet ikke hva som kan være aktuelt

Deretter:

- hva haster de neste 24 til 72 timene
- hvem situasjonen gjelder
- arbeidssituasjon
- helse og arbeidsevne
- støttebehov knyttet til hjelpemidler, tilrettelegging, pleie eller ekstrautgifter
- inntekt denne måneden
- husholdning og forsørgeransvar
- husholdningens økonomiske belastning
- boligsituasjon
- gjeldspress
- hva som allerede er avklart eller i gang
- type oppfølging brukeren trenger mest

## 6. Eksportfunksjon til PDF

Eksporten skjer fullt lokalt i nettleseren:

- resultatsammendrag bygges som ren tekst
- `jspdf` genererer PDF på klientsiden
- ingen resultater sendes til backend eller tredjepart

## 7. Personvernarkitektur

Brukersvar:

- lagres bare i `sessionStorage`
- brukes bare til lokal beregning av resultat
- kan nullstilles av brukeren når som helst

Innholdsredigering:

- lagres lokalt i `localStorage`
- gjelder bare denne nettleseren
- påvirker ikke server eller andre brukere

Server:

- leverer bare statiske filer
- fører ingen personsak
- mottar ikke spørsmålsdata som en sakslogg

## 8. Eksempelinnhold for minst 6 situasjoner

Innholdet dekker minst disse situasjonsløpene:

1. Arbeidsledig / permittert -> dagpenger
2. Ingen penger til nødvendige utgifter -> økonomisk sosialhjelp
3. Syk og ute av stand til å jobbe -> AAP
4. Lang vei tilbake til arbeid + tett oppfølgingsbehov -> kvalifiseringsprogram
5. Gjeld og inkasso -> økonomi- og gjeldsrådgivning
6. Fare for å miste bolig -> bostøtte og/eller midlertidig botilbud
7. Generell hjelp til å komme i arbeid -> arbeidsrettet oppfølging
8. Hjelpemidler eller tilrettelegging hjemme, i skole eller arbeid -> hjelpemidler og tilrettelegging
9. Varige ekstrautgifter på grunn av tilstand -> grunnstønad
10. Langvarig pleie- og tilsynsbehov -> hjelpestønad
11. Omsorg for sykt barn eller behov for nødvendig opplæring -> pleiepenger og/eller opplæringspenger
12. Uklare vedtak, brev eller klagebehov -> juridisk veiledning og klagespor

## 9. Plan for videre utvidelse

Kort sikt:

- mer presis regelmodell for sammensatte situasjoner
- bedre forklaring av hvorfor anbefalinger havner høyt eller lavt
- mer granulære dokumentlister per løp
- finere vekting av husholdning, forsørgeransvar, barn og omsorgsbelastning
- flere offisielle lenker og lokale hjelpespor per kommune

Mellomlang sikt:

- dedikert innholdsformat med validering og CI-sjekk
- mer strukturert admin-grensesnitt enn ren JSON-redigering
- støtte for flere språkvarianter
- mer finmasket akuttlogikk for familier, barn og sammensatte boforhold

Senere:

- separat innholds-API uten lagring av brukersvar
- redaksjonsflyt for kvalitetssikring av tekster
- sammenlignbar modul for andre offentlige veivisere
