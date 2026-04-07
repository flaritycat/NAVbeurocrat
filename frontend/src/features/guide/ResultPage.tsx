import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CopyBlock } from "../../components/CopyBlock";
import { PublicNotice } from "../../components/PublicNotice";
import { SafeExternalLink } from "../../components/SafeExternalLink";
import { StatusBadge } from "../../components/StatusBadge";
import { useContentBundle } from "../../lib/contentDrafts";
import { buildGuideResult, evaluateWizard } from "../../lib/ruleEngine";
import { clearWizardSession, readWizardSession } from "../../lib/sessionState";

function badgeTone(tone: "warning" | "fact" | "neutral") {
  if (tone === "warning") {
    return "warning";
  }

  if (tone === "fact") {
    return "fact";
  }

  return undefined;
}

export function ResultPage() {
  const bundle = useContentBundle();
  const navigate = useNavigate();
  const [isExportingPdf, setIsExportingPdf] = useState(false);
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
  const firstContact = result.officialLinks[0];
  const firstActionBucket = result.actionBuckets[0];

  function handleRestart() {
    const confirmed = window.confirm("Vil du slette veivisersvarene i denne økten og starte på nytt?");
    if (!confirmed) {
      return;
    }

    clearWizardSession();
    navigate("/");
  }

  async function handlePdfExport() {
    if (isExportingPdf) {
      return;
    }

    setIsExportingPdf(true);

    try {
      const pdfModule = await import("../../lib/pdf");
      pdfModule.exportGuideResultToPdf(result);
    } finally {
      setIsExportingPdf(false);
    }
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
                : ["Veiviseren anbefaler at du starter med en generell avklaring hos riktig hjelpeinstans."]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </div>
          <div className="signal-card">
            <h3>Første kontakt</h3>
            <p>{firstContact ? firstContact.actionLabel : "Bruk dokumentlisten, formuleringen og lenkene nedenfor når du skal videre."}</p>
            {firstContact ? <p>{firstContact.publisher}</p> : null}
          </div>
          <div className="signal-card">
            <h3>Det viktigste først</h3>
            <p>{firstActionBucket?.items[0] ?? "Start med første kontakt og bruk resultatet som støtte i samtalen."}</p>
          </div>
        </div>
      </section>

      <PublicNotice />

      <section className="card">
        <div className="action-row">
          <button className="primary-button" disabled={isExportingPdf} onClick={handlePdfExport} type="button">
            {isExportingPdf ? "Lager PDF..." : "Eksporter PDF"}
          </button>
          <button className="ghost-button" onClick={handleRestart} type="button">
            Start på nytt
          </button>
          <Link className="ghost-button" to="/guide">
            Endre svar
          </Link>
        </div>
      </section>

      {result.consistencyNotes.length ? (
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Dobbeltsjekk</p>
              <h2>Opplysninger som bør ryddes før videre kontakt</h2>
            </div>
          </div>
          <div className="stack">
            {result.consistencyNotes.map((note) => (
              <article className={note.tone === "warning" ? "note-box note-box--warning" : "note-box note-box--missing"} key={note.title}>
                <h3>{note.title}</h3>
                <p>{note.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

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

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Handlingsplan</p>
            <h2>Hva du kan gjøre nå, denne uken og senere</h2>
          </div>
        </div>

        <div className="timeline-grid">
          {result.actionBuckets.map((bucket) => (
            <article className={`timeline-card timeline-card--${bucket.tone}`} key={bucket.id}>
              <div className="section-heading">
                <h3>{bucket.title}</h3>
                <StatusBadge tone={badgeTone(bucket.tone)}>{`${bucket.items.length} punkt`}</StatusBadge>
              </div>
              <ul className="plain-list plain-list--spaced">
                {bucket.items.map((item) => (
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
            <p className="eyebrow">Før kontakt</p>
            <h2>Kort arbeidsflate før du ringer, skriver eller møter opp</h2>
          </div>
        </div>

        <div className="dashboard-grid">
          <section className="stack">
            <article className="note-box note-box--fact">
              <div className="section-heading">
                <h3>Kontakt først</h3>
                <StatusBadge tone="fact">Start her</StatusBadge>
              </div>
              <p>{result.beforeContact.contactFirst}</p>
            </article>

            <article className="policy-card">
              <h3>Hvorfor dette bør tas nå</h3>
              <ul className="plain-list plain-list--spaced">
                {result.beforeContact.whyNow.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="policy-card">
              <h3>Dette kan du si først</h3>
              <ul className="plain-list plain-list--spaced">
                {result.beforeContact.sayThisFirst.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="policy-card">
              <h3>Ha dette klart</h3>
              <ul className="plain-list plain-list--spaced">
                {result.beforeContact.haveReady.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>

            <article className="policy-card">
              <h3>Det kan være lurt å be om</h3>
              <ul className="plain-list plain-list--spaced">
                {result.beforeContact.askFor.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="stack">
            <CopyBlock content={result.beforeContact.copyText} title="Kort før-kontakt-notat" />
          </section>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Flere steg</p>
            <h2>Trinnvis oppfølging hvis du vil jobbe mer systematisk</h2>
          </div>
        </div>

        <div className="process-grid">
          {result.nextSteps.map((step, index) => (
            <article className="process-step" key={`${index + 1}-${step}`}>
              <p className="eyebrow">Steg {index + 1}</p>
              <p>{step}</p>
            </article>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="stack">
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Anbefalt hovedspor</p>
                <h2>{result.primaryRecommendation.recommendation.title}</h2>
              </div>
              <StatusBadge tone="fact">{result.primaryRecommendation.recommendation.category}</StatusBadge>
            </div>
            <p>{result.primaryRecommendation.recommendation.summary}</p>
            <ul className="plain-list plain-list--spaced">
              {(result.primaryRecommendation.reasons.length
                ? result.primaryRecommendation.reasons
                : ["Veiviseren anbefaler at du starter med en generell avklaring hos riktig hjelpeinstans."]).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Parallelle løp</p>
                <h2>Dette kan være lurt å undersøke samtidig</h2>
              </div>
            </div>
            <div className="stack">
              {result.parallelRecommendations.length === 0 ? <p>Ingen tydelige parallelle løp ble løftet over terskelen denne gangen.</p> : null}
              {result.parallelRecommendations.map((item) => (
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

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Støtteløp</p>
                <h2>Kan være nyttig når det viktigste er avklart</h2>
              </div>
            </div>
            <div className="stack">
              {result.supportRecommendations.length === 0 ? <p>Veiviseren løftet ikke fram tydelige støtteløp denne gangen.</p> : null}
              {result.supportRecommendations.map((item) => (
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
                  <ul className="plain-list plain-list--spaced">
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
                <p className="eyebrow">Det kan være lurt å be om dette</p>
                <h2>Gjør samtalen mer konkret</h2>
              </div>
            </div>

            <div className="stack">
              {result.askForList.map((item) => (
                <article className="note-box note-box--fact" key={item}>
                  <p>{item}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Risiko og avgrensninger</p>
                <h2>Forhold som kan endre vurderingen</h2>
              </div>
            </div>

            <div className="stack">
              {result.riskNotes.map((risk) => (
                <article className="note-box note-box--missing" key={risk}>
                  <p>{risk}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Hvem som kan hjelpe</p>
                <h2>Kontaktpunkter videre</h2>
              </div>
            </div>

            <div className="stack stack--tight">
              {result.officialLinks.map((link) => (
                <SafeExternalLink className="source-suggestion" href={link.url} key={link.id}>
                  <div className="source-suggestion__body">
                    <div className="section-heading">
                      <strong>{link.actionLabel}</strong>
                      <StatusBadge>{link.publisher}</StatusBadge>
                    </div>
                    <span>{link.description}</span>
                    {link.whenRelevant ? <span className="source-suggestion__meta">{link.whenRelevant}</span> : null}
                  </div>
                </SafeExternalLink>
              ))}
            </div>
          </section>
        </section>
      </div>

      <div className="dashboard-grid">
        <CopyBlock content={result.contactDraft} title="Forslag til melding eller forberedelse til kontakt" />
        <CopyBlock content={result.summaryText} title="Hele oppsummeringen" />
      </div>

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
