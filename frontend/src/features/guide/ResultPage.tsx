import { Link, useNavigate } from "react-router-dom";
import { CopyBlock } from "../../components/CopyBlock";
import { PublicNotice } from "../../components/PublicNotice";
import { SafeExternalLink } from "../../components/SafeExternalLink";
import { StatusBadge } from "../../components/StatusBadge";
import { useContentBundle } from "../../lib/contentDrafts";
import { exportTextToPdf } from "../../lib/pdf";
import { buildGuideResult, evaluateWizard } from "../../lib/ruleEngine";
import { clearWizardSession, readWizardSession } from "../../lib/sessionState";

export function ResultPage() {
  const bundle = useContentBundle();
  const navigate = useNavigate();
  const session = readWizardSession();
  const evaluation = evaluateWizard(bundle, session.answers);

  if (evaluation.visibleQuestions.length === 0) {
    return (
      <div className="page">
        <section className="card stack">
          <h1>Ingen veiviserøkt funnet</h1>
          <p>Start veiviseren først for å få et resultat.</p>
          <Link className="primary-button" to="/guide">
            Start veiviseren
          </Link>
        </section>
      </div>
    );
  }

  const unanswered = evaluation.visibleQuestions.find((question) => session.answers[question.id] === undefined);
  if (unanswered) {
    return (
      <div className="page">
        <section className="card stack">
          <h1>Veiviseren er ikke fullført ennå</h1>
          <p>Du har fortsatt spørsmål igjen før resultatet blir tydelig nok.</p>
          <div className="action-row">
            <Link className="primary-button" to="/guide">
              Fortsett veiviseren
            </Link>
            <Link className="ghost-button" to="/">
              Til forsiden
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const result = buildGuideResult(bundle, session.answers);

  function handleRestart() {
    const confirmed = window.confirm("Vil du slette veivisersvarene i denne økten og starte på nytt?");
    if (!confirmed) {
      return;
    }

    clearWizardSession();
    navigate("/");
  }

  function handlePdfExport() {
    exportTextToPdf("NAV-veiviser", result.summaryText);
  }

  return (
    <div className="page stack">
      <section className="hero-card hero-card--single">
        <div>
          <p className="eyebrow">Resultat</p>
          <h1>{result.primaryRecommendation.recommendation.title}</h1>
          <p className="lead">{result.primaryRecommendation.recommendation.summary}</p>
        </div>
        <div className="hero-card__signals">
          <div className="signal-card">
            <h3>Hvorfor dette foreslås</h3>
            <ul className="plain-list">
              {(result.primaryRecommendation.reasons.length
                ? result.primaryRecommendation.reasons
                : ["Veiviseren anbefaler at du starter med en generell avklaring hos NAV."]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="signal-card">
            <h3>Neste handling</h3>
            <p>Bruk dokumentlisten, formuleringen og de offisielle lenkene nedenfor når du skal videre.</p>
          </div>
        </div>
      </section>

      <PublicNotice />

      <section className="card">
        <div className="action-row">
          <button className="primary-button" onClick={handlePdfExport} type="button">
            Eksporter PDF
          </button>
          <button className="ghost-button" onClick={handleRestart} type="button">
            Start på nytt
          </button>
          <Link className="ghost-button" to="/guide">
            Endre svar
          </Link>
        </div>
      </section>

      {result.acuteItems.length ? (
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Hva haster</p>
              <h2>Prioriter dette først</h2>
            </div>
          </div>

          <div className="stack">
            {result.acuteItems.map((item) => (
              <article className="note-box note-box--warning" key={item.rule.id}>
                <div className="section-heading">
                  <h3>{item.rule.title}</h3>
                  <StatusBadge tone="warning">Haster</StatusBadge>
                </div>
                <p>{item.rule.summary}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="dashboard-grid">
        <section className="stack">
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Anbefalt hovedløp</p>
                <h2>{result.primaryRecommendation.recommendation.title}</h2>
              </div>
              <StatusBadge tone="fact">{result.primaryRecommendation.recommendation.category}</StatusBadge>
            </div>
            <p>{result.primaryRecommendation.recommendation.summary}</p>
            <ul className="plain-list plain-list--spaced">
              {(result.primaryRecommendation.reasons.length
                ? result.primaryRecommendation.reasons
                : ["Veiviseren anbefaler at du starter med en generell avklaring hos NAV."]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Alternative muligheter</p>
                <h2>Kan også være relevant</h2>
              </div>
            </div>
            <div className="stack">
              {result.alternativeRecommendations.length === 0 ? <p>Ingen tydelige alternativer ble løftet over terskelen denne gangen.</p> : null}
              {result.alternativeRecommendations.map((item) => (
                <article className="policy-card" key={item.recommendation.id}>
                  <div className="section-heading">
                    <strong>{item.recommendation.title}</strong>
                    <StatusBadge>{item.recommendation.category}</StatusBadge>
                  </div>
                  <p>{item.recommendation.summary}</p>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="stack">
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Vanlig dokumentasjon</p>
                <h2>Samle dette først</h2>
              </div>
            </div>

            <div className="stack stack--tight">
              {result.documentSections.map((section) => (
                <article className="policy-card" key={section.title}>
                  <strong>{section.title}</strong>
                  <ul className="plain-list">
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Offisielle kilder</p>
                <h2>Lenker videre</h2>
              </div>
            </div>

            <div className="stack stack--tight">
              {result.officialLinks.map((link) => (
                <SafeExternalLink className="source-suggestion" href={link.url} key={link.id}>
                  <strong>{link.title}</strong>
                  <span>{link.description}</span>
                </SafeExternalLink>
              ))}
            </div>
          </section>
        </section>
      </div>

      <CopyBlock content={result.contactDraft} title="Forslag til formulering" />
      <CopyBlock content={result.summaryText} title="Kopierbar oppsummering" />

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Forbehold</p>
            <h2>Bruk resultatet med riktig forventning</h2>
          </div>
        </div>
        <div className="stack stack--tight">
          {result.disclaimers.map((disclaimer) => (
            <article className="policy-card" key={disclaimer.id}>
              <strong>{disclaimer.title}</strong>
              <p>{disclaimer.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
