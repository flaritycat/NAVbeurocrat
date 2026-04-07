import { Link } from "react-router-dom";
import { PublicNotice } from "../../components/PublicNotice";
import { useContentBundle } from "../../lib/contentDrafts";

const processSteps = [
  {
    title: "1. Start med situasjonen din",
    description: "Du starter med hva som faktisk skjer i livet ditt nå, ikke med navnet på en ordning.",
  },
  {
    title: "2. Ett spørsmål om gangen",
    description: "Veiviseren stiller korte spørsmål og lar deg alltid svare «Vet ikke».",
  },
  {
    title: "3. Det viktigste først",
    description: "Hvis helse, trygghet, mat, bolig eller andre grunnleggende behov haster, løftes det foran alt annet.",
  },
  {
    title: "4. Få en ryddig handlingsplan",
    description: "Du får anbefalt hovedspor, alternative muligheter, dokumentasjonsliste, ting du kan be om og forslag til formulering.",
  },
  {
    title: "5. Se hvem som kan hjelpe videre",
    description: "Resultatet peker videre til NAV, kommunen, Husbanken, helse eller rettshjelp der det passer.",
  },
  {
    title: "6. Eksporter lokalt",
    description: "Du kan kopiere tekst eller eksportere resultatet som PDF uten at svarene dine blir lagret som en serverbasert sak.",
  },
] as const;

export function DashboardPage() {
  const bundle = useContentBundle();
  const startQuestion = bundle.questions.find((question) => question.id === "start_situation");

  return (
    <div className="page">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Veiviser</p>
          <h1>Finn hjelp, støtte og riktige første steg.</h1>
          <p className="lead">
            Denne veiviseren er laget for privatpersoner i Norge som trenger en rolig og tydelig oversikt over hva som
            kan være riktig å undersøke videre hos NAV, kommunen, Husbanken, helsetjenesten eller andre offentlige
            hjelpespor.
          </p>
          <div className="action-row">
            <Link className="primary-button" to="/guide">
              Start veiviseren
            </Link>
            <Link className="ghost-button" to="/admin">
              Lokal innholdsredigering
            </Link>
          </div>
        </div>

        <div className="hero-card__signals">
          <div className="signal-card">
            <h3>Bygget for hjelp, ikke bare ytelser</h3>
            <p>Veiviseren kan peke mot støtte, tilrettelegging, helse, bolig og juridiske spor i tillegg til NAV-ordninger.</p>
          </div>
          <div className="signal-card">
            <h3>Ingen personsak på server</h3>
            <p>Svarene dine behandles bare i nettleseren og blir ikke lagret som en NAV-sak.</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Slik fungerer det</p>
            <h2>Pedagogisk arbeidsflyt</h2>
          </div>
        </div>

        <div className="process-grid">
          {processSteps.map((step) => (
            <article className="process-step" key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Startkategorier</p>
              <h2>Situasjoner veiviseren tar utgangspunkt i</h2>
            </div>
          </div>
          <PublicNotice />

          <div className="stack">
            {startQuestion?.options.map((option) => (
              <Link className="list-card" key={option.id} to={`/guide?start=${option.id}`}>
                <div className="list-card__meta">
                  <strong>{option.label}</strong>
                  <span>{option.description}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="stack">
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Resultatet gir deg</p>
                <h2>Hva du får ut</h2>
              </div>
            </div>

            <div className="stack">
              <article className="note-box note-box--fact">
                <h3>Anbefalt hovedspor</h3>
                <p>Det sporet som ser mest relevant ut først, enten det handler om NAV, kommune, helse eller annet hjelpeapparat.</p>
              </article>
              <article className="note-box note-box--warning">
                <h3>Hvem som kan hjelpe videre</h3>
                <p>Du får tydeligere første kontaktpunkt og lenker videre til riktig sted.</p>
              </article>
              <article className="note-box note-box--missing">
                <h3>Dokumentasjon, spørsmål og formulering</h3>
                <p>Du får en kort liste over hva du bør samle, hva du kan be om og hvordan du kan formulere deg saklig.</p>
              </article>
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Forbehold</p>
                <h2>Viktig å vite</h2>
              </div>
            </div>
            <div className="stack stack--tight">
              {bundle.disclaimers.map((disclaimer) => (
                <article className="policy-card" key={disclaimer.id}>
                  <strong>{disclaimer.title}</strong>
                  <p>{disclaimer.text}</p>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
