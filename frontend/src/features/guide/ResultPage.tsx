import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChecklistPanel } from "../../components/ChecklistPanel";
import { CopyBlock } from "../../components/CopyBlock";
import { SafeExternalLink } from "../../components/SafeExternalLink";
import { StatusBadge } from "../../components/StatusBadge";
import { useContentBundle } from "../../lib/contentDrafts";
import { buildGuideResult, evaluateWizard } from "../../lib/ruleEngine";
import { clearChecklistState, clearWizardSession, readWizardSession, setChecklistItem, writeWizardSession } from "../../lib/sessionState";
import type { CompactGuideCard, PdfExportMode } from "../../lib/types";

function badgeTone(tone: "warning" | "fact" | "neutral") {
  if (tone === "warning") {
    return "warning";
  }

  if (tone === "fact") {
    return "fact";
  }

  return undefined;
}

function severityTone(severity: "high" | "medium" | "low") {
  if (severity === "high") {
    return "missing";
  }

  if (severity === "medium") {
    return "warning";
  }

  return "fact";
}

function buildScenarioKey(questionId: string, alternativeAnswer: string) {
  return `${questionId}-${alternativeAnswer}`;
}

function strengthLabelText(label: "sterk" | "middels" | "svak") {
  if (label === "sterk") {
    return "Tydelig retning";
  }

  if (label === "middels") {
    return "Brukbar retning";
  }

  return "Foreløpig retning";
}

type MobileFoldSectionProps = {
  eyebrow: string;
  title: string;
  badge?: string;
  defaultOpen?: boolean;
  children: ReactNode;
};

function MobileFoldSection({ eyebrow, title, badge, defaultOpen = false, children }: MobileFoldSectionProps) {
  return (
    <details className="card mobile-fold-card" open={defaultOpen}>
      <summary className="mobile-fold-card__summary">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {badge ? <StatusBadge>{badge}</StatusBadge> : <span className="mobile-fold-card__hint">Åpne</span>}
      </summary>
      <div className="stack stack--tight mobile-fold-card__body">{children}</div>
    </details>
  );
}

export function ResultPage() {
  const bundle = useContentBundle();
  const navigate = useNavigate();
  const [exportMode, setExportMode] = useState<PdfExportMode | null>(null);
  const [selectedScenarioKey, setSelectedScenarioKey] = useState<string | null>(null);
  const [session, setSession] = useState(() => readWizardSession());
  const evaluation = useMemo(() => evaluateWizard(bundle, session.answers), [bundle, session.answers]);

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

  const result = buildGuideResult(bundle, session.answers, session);
  const firstContact = result.officialLinks[0];
  const firstActionBucket = result.actionBuckets[0];
  const compactGuideCards = [
    result.letterSummaryCard,
    result.youthGuideCard,
    result.childSchoolCard,
  ].filter((card): card is CompactGuideCard => Boolean(card));
  const inlineGlossaryTerms = result.glossaryTerms.slice(0, 3);
  const selectedScenario =
    result.whatIfScenarios.find((scenario) => buildScenarioKey(scenario.questionId, scenario.alternativeAnswer) === selectedScenarioKey) ??
    result.whatIfScenarios[0] ??
    null;
  const primaryReasons = result.primaryRecommendation.reasons.length
    ? result.primaryRecommendation.reasons
    : ["Veiviseren anbefaler at du starter med en generell avklaring hos riktig hjelpeinstans."];
  const checklistItems = useMemo(
    () =>
      [
        ...result.actionBuckets.flatMap((bucket) =>
          bucket.items.map((item) => ({
            id: `action-${bucket.id}-${item}`,
            label: item,
          })),
        ),
        ...result.beforeContact.haveReady.slice(0, 3).map((item) => ({
          id: `ready-${item}`,
          label: `Ha klart: ${item}`,
        })),
      ].slice(0, 10),
    [result.actionBuckets, result.beforeContact.haveReady],
  );

  function handleRestart() {
    const confirmed = window.confirm("Vil du slette veivisersvarene i denne økten og starte på nytt?");
    if (!confirmed) {
      return;
    }

    clearWizardSession();
    navigate("/");
  }

  function handleChecklistToggle(id: string, checked: boolean) {
    const nextSession = writeWizardSession(setChecklistItem(session, id, checked));
    setSession(nextSession);
  }

  function handleChecklistReset() {
    const nextSession = writeWizardSession(clearChecklistState(session));
    setSession(nextSession);
  }

  async function handlePdfExport(mode: PdfExportMode) {
    if (exportMode) {
      return;
    }

    setExportMode(mode);

    try {
      const pdfModule = await import("../../lib/pdf");
      pdfModule.exportGuideResultToPdf(result, mode);
    } finally {
      setExportMode(null);
    }
  }

  return (
    <div className="page stack">
      <section className="hero-card hero-card--single result-hero">
        <div>
          <p className="eyebrow">Resultat</p>
          <h1>{result.primaryRecommendation.recommendation.title}</h1>
          <p className="lead">{result.primaryRecommendation.recommendation.summary}</p>
        </div>
        <div className="hero-card__signals">
          <div className="signal-card">
            <h3>Hvorfor dette foreslås</h3>
            <ul className="plain-list">
              {primaryReasons.map((reason) => (
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

      <section className="card">
        <div className="action-row">
          <button className="primary-button" disabled={Boolean(exportMode)} onClick={() => handlePdfExport("action")} type="button">
            {exportMode === "action" ? "Lager handlingskort..." : "PDF: handlingskort"}
          </button>
          <button className="ghost-button" disabled={Boolean(exportMode)} onClick={() => handlePdfExport("meeting")} type="button">
            {exportMode === "meeting" ? "Lager møteark..." : "PDF: møteark"}
          </button>
          <button className="ghost-button" disabled={Boolean(exportMode)} onClick={() => handlePdfExport("full")} type="button">
            {exportMode === "full" ? "Lager full oversikt..." : "PDF: full oversikt"}
          </button>
          <Link className="ghost-button" to="/call">
            Før du ringer
          </Link>
          <Link className="ghost-button" to="/brief">
            Åpne kortversjon
          </Link>
          <button className="ghost-button" onClick={handleRestart} type="button">
            Start på nytt
          </button>
          <Link className="ghost-button" to="/guide">
            Endre svar
          </Link>
        </div>
      </section>

      <div className="result-mobile stack">
        {result.missingItems.length ? (
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Hva som mangler</p>
                <h2>Dette gjør retningen tryggere</h2>
              </div>
            </div>
            <div className="stack stack--tight">
              {result.missingItems.map((item) => (
                <article className={`note-box note-box--${severityTone(item.severity)}`} key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {result.acuteItems.length ? (
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Haster først</p>
                <h2>Dette bør bryte inn foran resten</h2>
              </div>
              <StatusBadge tone="warning">Prioriter nå</StatusBadge>
            </div>
            <div className="stack stack--tight">
              {result.acuteItems.map((item) => (
                <article className="note-box note-box--warning" key={item.rule.id}>
                  <h3>{item.rule.title}</h3>
                  <p>{item.rule.summary}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card result-priority">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Det viktigste på mobilen</p>
              <h2>Kontakt, formulering og hva du bør ha klart</h2>
            </div>
            <StatusBadge tone="fact">Start her</StatusBadge>
          </div>

          <article className="note-box note-box--fact">
            <h3>Kontakt først</h3>
            <p>{result.beforeContact.contactFirst}</p>
          </article>

          <article className="policy-card">
            <h3>Si dette først</h3>
            <ul className="plain-list plain-list--spaced">
              {result.beforeContact.sayThisFirst.slice(0, 2).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          <article className="policy-card">
            <h3>Ha dette klart</h3>
            <ul className="plain-list plain-list--spaced">
              {result.beforeContact.haveReady.slice(0, 3).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>

          {result.askForList.length ? (
            <article className="policy-card">
              <h3>Det kan være lurt å be om</h3>
              <ul className="plain-list plain-list--spaced">
                {result.askForList.slice(0, 2).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ) : null}
        </section>

        <MobileFoldSection badge={`${checklistItems.length} punkt`} defaultOpen eyebrow="Handlingsplan" title="Hva du kan gjøre nå">
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
        </MobileFoldSection>

        {compactGuideCards.length ? (
          <MobileFoldSection eyebrow="Ekstra kort" title="Kortversjoner for spesielle situasjoner">
            {compactGuideCards.map((card) => (
              <article className="policy-card" key={`mobile-${card.title}`}>
                <h3>{card.title}</h3>
                <p>{card.intro}</p>
                <ul className="plain-list plain-list--spaced">
                  {card.items.map((item) => (
                    <li key={`${card.title}-${item}`}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </MobileFoldSection>
        ) : null}

        <MobileFoldSection eyebrow="Hvorfor denne retningen" title={result.primaryRecommendation.recommendation.title}>
          {result.situationMap.scoreLines.slice(0, 1).map((line) => (
            <article className="policy-card" key={`mobile-strength-${line.title}`}>
              <div className="section-heading">
                <h3>{line.title}</h3>
                <StatusBadge tone={line.tone === "primary" ? "fact" : undefined}>{strengthLabelText(line.strengthLabel)}</StatusBadge>
              </div>
              <div className="strength-meter" aria-hidden="true">
                <div className="strength-meter__bar" style={{ width: `${line.strengthPercent}%` }} />
              </div>
              <ul className="plain-list plain-list--spaced">
                {line.pullsUp.slice(0, 2).map((item) => (
                  <li key={`up-${line.title}-${item}`}>Trekker opp: {item}</li>
                ))}
                {line.pullsDown.slice(0, 1).map((item) => (
                  <li key={`down-${line.title}-${item}`}>Trekker ned: {item}</li>
                ))}
              </ul>
            </article>
          ))}

          <article className="policy-card">
            <h3>Hvorfor dette foreslås</h3>
            <ul className="plain-list plain-list--spaced">
              {primaryReasons.slice(0, 3).map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          </article>

          {result.situationMap.keyFacts.map((fact) => (
            <article className="note-box note-box--fact" key={fact}>
              <p>{fact}</p>
            </article>
          ))}

          {selectedScenario ? (
            <article className="policy-card">
              <h3>Hvis ett nøkkelsvar blir annerledes</h3>
              <div className="stack stack--tight">
                {result.whatIfScenarios.slice(0, 3).map((scenario) => {
                  const key = buildScenarioKey(scenario.questionId, scenario.alternativeAnswer);
                  const isSelected =
                    buildScenarioKey(selectedScenario.questionId, selectedScenario.alternativeAnswer) === key;

                  return (
                    <button
                      className={isSelected ? "signal-card signal-card--selected" : "signal-card"}
                      key={key}
                      onClick={() => setSelectedScenarioKey(key)}
                      type="button"
                    >
                      <strong>{scenario.questionTitle}</strong>
                      <p>{scenario.summary}</p>
                    </button>
                  );
                })}

                <article className="note-box note-box--fact">
                  <h3>{selectedScenario.resultingRecommendation}</h3>
                  <p>{selectedScenario.resultingSummary}</p>
                  <p>{`Kontakt først: ${selectedScenario.resultingContact}`}</p>
                </article>
              </div>
            </article>
          ) : null}
        </MobileFoldSection>

        <MobileFoldSection eyebrow="Dokumentasjon og spørsmål" title="Dette bør du ha eller spørre om">
          {result.consistencyNotes.map((note) => (
            <article className={note.tone === "warning" ? "note-box note-box--warning" : "note-box note-box--missing"} key={note.title}>
              <h3>{note.title}</h3>
              <p>{note.description}</p>
            </article>
          ))}

          {result.documentSections.map((section) => (
            <article className="policy-card" key={section.title}>
              <h3>{section.title}</h3>
              <ul className="plain-list plain-list--spaced">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ))}

          {result.askForList.length ? (
            <article className="policy-card">
              <h3>Spør gjerne om dette</h3>
              <ul className="plain-list plain-list--spaced">
                {result.askForList.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ) : null}

          {result.doNotAssumeList.length ? (
            <article className="note-box note-box--warning">
              <h3>Dette bør du ikke anta</h3>
              <ul className="plain-list plain-list--spaced">
                {result.doNotAssumeList.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          ) : null}
        </MobileFoldSection>

        <MobileFoldSection eyebrow="Andre spor og kontaktpunkter" title="Hva mer kan være relevant">
          {inlineGlossaryTerms.length ? (
            <article className="policy-card">
              <h3>Kort forklart underveis</h3>
              <div className="stack stack--tight">
                {inlineGlossaryTerms.map((term) => (
                  <div className="inline-glossary" key={term.id}>
                    <strong>{term.title}</strong>
                    <p>{term.description}</p>
                  </div>
                ))}
              </div>
            </article>
          ) : null}

          {result.alternativeAssessments.map((item) => (
            <article className="policy-card" key={item.recommendation.recommendation.id}>
              <div className="section-heading">
                <strong>{item.recommendation.recommendation.title}</strong>
                <StatusBadge>{item.recommendation.recommendation.category}</StatusBadge>
              </div>
              <ul className="plain-list plain-list--spaced">
                {item.whyStillRelevant.slice(0, 1).map((reason) => (
                  <li key={`still-${item.recommendation.recommendation.id}-${reason}`}>Fortsatt relevant: {reason}</li>
                ))}
                {item.whyNotHigher.slice(0, 1).map((reason) => (
                  <li key={`lower-${item.recommendation.recommendation.id}-${reason}`}>Ikke løftet høyere nå: {reason}</li>
                ))}
              </ul>
            </article>
          ))}

          {result.parallelRecommendations.map((item) => (
            <article className="policy-card" key={`parallel-${item.recommendation.id}`}>
              <strong>{item.recommendation.title}</strong>
              <p>{item.recommendation.summary}</p>
            </article>
          ))}

          {result.supportRecommendations.map((item) => (
            <article className="policy-card" key={`support-${item.recommendation.id}`}>
              <strong>{item.recommendation.title}</strong>
              <p>{item.recommendation.summary}</p>
            </article>
          ))}

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

          {result.actorGuidance.map((card) => (
            <article className="timeline-card timeline-card--neutral" key={`actor-${card.group}`}>
              <div className="section-heading">
                <h3>{card.title}</h3>
                <StatusBadge>{card.group}</StatusBadge>
              </div>
              <ul className="plain-list plain-list--spaced">
                {card.items.map((item) => (
                  <li key={`${card.group}-${item}`}>{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </MobileFoldSection>

        <MobileFoldSection eyebrow="Mer bakgrunn" title="Risiko, ordliste og kopierbar tekst">
          {result.riskNotes.map((risk) => (
            <article className="note-box note-box--missing" key={risk}>
              <p>{risk}</p>
            </article>
          ))}

          {result.glossaryTerms.map((term) => (
            <article className="policy-card" key={term.id}>
              <strong>{term.title}</strong>
              <p>{term.description}</p>
            </article>
          ))}

          {result.disclaimers.map((disclaimer) => (
            <article className="policy-card" key={disclaimer.id}>
              <strong>{disclaimer.title}</strong>
              <p>{disclaimer.text}</p>
            </article>
          ))}

          <CopyBlock content={result.beforeContact.copyText} title="Kort før-kontakt-notat" />
          <CopyBlock content={result.contactDraft} title="Forslag til melding" />
        </MobileFoldSection>
      </div>

      <div className="result-desktop stack">
        <ChecklistPanel
          intro="Marker det du allerede har gjort. Sjekklisten holdes bare lokalt i denne nettlesersesjonen og hjelper deg å holde oversikt."
          items={checklistItems.map((item) => ({
            ...item,
            checked: Boolean(session.checklistState[item.id]),
          }))}
          onReset={handleChecklistReset}
          onToggle={handleChecklistToggle}
          title="Dette kan du krysse av lokalt"
        />

        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Situasjonskart</p>
              <h2>Dette er svarene som løftet retningen høyest</h2>
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="stack">
              {result.situationMap.keyFacts.map((fact) => (
                <article className="note-box note-box--fact" key={fact}>
                  <p>{fact}</p>
                </article>
              ))}
            </section>

            <section className="stack">
              {result.situationMap.scoreLines.map((line) => (
                <article className={line.tone === "primary" ? "timeline-card timeline-card--fact" : "timeline-card timeline-card--neutral"} key={line.title}>
                  <div className="section-heading">
                    <h3>{line.title}</h3>
                    <StatusBadge tone={line.tone === "primary" ? "fact" : undefined}>{strengthLabelText(line.strengthLabel)}</StatusBadge>
                  </div>
                  <div className="strength-meter" aria-hidden="true">
                    <div className="strength-meter__bar" style={{ width: `${line.strengthPercent}%` }} />
                  </div>
                  <ul className="plain-list plain-list--spaced">
                    {line.explanation.map((item) => (
                      <li key={`${line.title}-${item}`}>{item}</li>
                    ))}
                  </ul>
                  {line.pullsUp.length ? (
                    <div className="stack stack--tight">
                      <strong>Trekker opp</strong>
                      <ul className="plain-list plain-list--spaced">
                        {line.pullsUp.map((item) => (
                          <li key={`${line.title}-up-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {line.pullsDown.length ? (
                    <div className="stack stack--tight">
                      <strong>Trekker ned</strong>
                      <ul className="plain-list plain-list--spaced">
                        {line.pullsDown.map((item) => (
                          <li key={`${line.title}-down-${item}`}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </article>
              ))}
            </section>
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

        {result.missingItems.length ? (
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Hva som mangler</p>
                <h2>Dette bør avklares før du legger for mye vekt på resultatet</h2>
              </div>
            </div>
            <div className="timeline-grid">
              {result.missingItems.map((item) => (
                <article className={`timeline-card timeline-card--${severityTone(item.severity) === "fact" ? "fact" : severityTone(item.severity) === "warning" ? "warning" : "neutral"}`} key={item.title}>
                  <div className="section-heading">
                    <h3>{item.title}</h3>
                    <StatusBadge tone={severityTone(item.severity)}>
                      {item.severity === "high" ? "Viktig" : item.severity === "medium" ? "Bør avklares" : "Nyttig"}
                    </StatusBadge>
                  </div>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {result.acuteItems.length ? (
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Akuttvern</p>
                <h2>Dette bør bryte inn foran resten</h2>
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
                  <ul className="plain-list plain-list--spaced">
                    {item.links.slice(0, 2).map((link) => (
                      <li key={link.id}>{link.actionLabel}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Hva slags hjelp er dette?</p>
              <h2>Skille mellom nødhjelp, rettigheter, praktisk hjelp og veiledning</h2>
            </div>
          </div>

          <div className="timeline-grid">
            {result.helpModeCards.map((card) => (
              <article className={`timeline-card timeline-card--${card.tone}`} key={card.id}>
                <div className="section-heading">
                  <h3>{card.title}</h3>
                  <StatusBadge tone={badgeTone(card.tone)}>{card.items.length ? `${card.items.length} spor` : "Oversikt"}</StatusBadge>
                </div>
                <p>{card.description}</p>
                <ul className="plain-list plain-list--spaced">
                  {card.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {inlineGlossaryTerms.length ? (
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Kort forklart underveis</p>
                <h2>Begreper du møter i dette resultatet</h2>
              </div>
            </div>
            <div className="dashboard-grid">
              {inlineGlossaryTerms.map((term) => (
                <article className="policy-card inline-glossary" key={`inline-${term.id}`}>
                  <strong>{term.title}</strong>
                  <p>{term.description}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {result.sessionHistory.length ? (
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Historikk i økten</p>
                <h2>Slik endret retningen seg mens du svarte</h2>
              </div>
            </div>
            <div className="stack">
              {result.sessionHistory.slice(-8).map((entry) => (
                <article className="policy-card" key={entry.id}>
                  <div className="section-heading">
                    <strong>{entry.recommendationTitle}</strong>
                    <StatusBadge>{new Intl.DateTimeFormat("nb-NO", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.recordedAt))}</StatusBadge>
                  </div>
                  <p>{entry.answerSummary}</p>
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
              <p className="eyebrow">Kortversjoner</p>
              <h2>Mobil og møteformat</h2>
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="stack">
              <article className="policy-card">
                <h3>{result.phoneCard.title}</h3>
                <p>{result.phoneCard.intro}</p>
                <ul className="plain-list plain-list--spaced">
                  {result.phoneCard.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <CopyBlock content={result.phoneCard.copyText} title="Kopier telefonkort" />
            </section>

            <section className="stack">
              <article className="policy-card">
                <h3>{result.meetingCard.title}</h3>
                <p>{result.meetingCard.intro}</p>
                <ul className="plain-list plain-list--spaced">
                  {result.meetingCard.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <CopyBlock content={result.meetingCard.copyText} title="Kopier møteark" />
            </section>
          </div>

          {compactGuideCards.length ? (
            <div className="dashboard-grid">
              {compactGuideCards.map((card) => (
                <section className="stack" key={card.title}>
                  <article className="policy-card">
                    <h3>{card.title}</h3>
                    <p>{card.intro}</p>
                    <ul className="plain-list plain-list--spaced">
                      {card.items.map((item) => (
                        <li key={`${card.title}-${item}`}>{item}</li>
                      ))}
                    </ul>
                  </article>
                  <CopyBlock content={card.copyText} title={`Kopier ${card.title.toLowerCase()}`} />
                </section>
              ))}
            </div>
          ) : null}
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
              <p className="eyebrow">Hvem gjør hva</p>
              <h2>Skille mellom NAV, kommune, helse, skole og andre spor</h2>
            </div>
          </div>

          <div className="timeline-grid">
            {result.actorGuidance.map((card) => (
              <article className="timeline-card timeline-card--neutral" key={card.group}>
                <div className="section-heading">
                  <h3>{card.title}</h3>
                  <StatusBadge>{card.group}</StatusBadge>
                </div>
                <p>{card.description}</p>
                <ul className="plain-list plain-list--spaced">
                  {card.items.map((item) => (
                    <li key={`${card.group}-${item}`}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        {selectedScenario ? (
          <section className="card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Sammenlign svar</p>
                <h2>Hvis ett nøkkelsvar blir annerledes</h2>
              </div>
            </div>

            <div className="dashboard-grid">
              <section className="stack">
                {result.whatIfScenarios.map((scenario) => {
                  const key = buildScenarioKey(scenario.questionId, scenario.alternativeAnswer);
                  const isSelected =
                    buildScenarioKey(selectedScenario.questionId, selectedScenario.alternativeAnswer) === key;

                  return (
                    <button
                      className={isSelected ? "signal-card signal-card--selected" : "signal-card"}
                      key={key}
                      onClick={() => setSelectedScenarioKey(key)}
                      type="button"
                    >
                      <strong>{scenario.questionTitle}</strong>
                      <p>{scenario.summary}</p>
                    </button>
                  );
                })}
              </section>

              <section className="stack">
                <article className="policy-card">
                  <div className="section-heading">
                    <strong>{selectedScenario.questionTitle}</strong>
                    <StatusBadge>{selectedScenario.resultingRecommendation}</StatusBadge>
                  </div>
                  <p>{`Nå: ${selectedScenario.currentAnswer}`}</p>
                  <p>{`Alternativt svar: ${selectedScenario.alternativeAnswer}`}</p>
                  <p>{selectedScenario.resultingSummary}</p>
                  <p>{`Kontakt først da: ${selectedScenario.resultingContact}`}</p>
                </article>
              </section>
            </div>
          </section>
        ) : null}

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
                {primaryReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </section>

            <section className="card">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Hvorfor ikke høyere</p>
                  <h2>Andre spor som fortsatt kan være relevante</h2>
                </div>
              </div>
              <div className="stack">
                {result.alternativeAssessments.length === 0 ? <p>Veiviseren fant ikke tydelige sekundære spor å forklare nærmere denne gangen.</p> : null}
                {result.alternativeAssessments.map((item) => (
                  <article className="policy-card" key={item.recommendation.recommendation.id}>
                    <div className="section-heading">
                      <strong>{item.recommendation.recommendation.title}</strong>
                      <StatusBadge>{item.recommendation.recommendation.category}</StatusBadge>
                    </div>
                    <p>{item.recommendation.recommendation.summary}</p>
                    <ul className="plain-list plain-list--spaced">
                      {item.whyStillRelevant.map((reason) => (
                        <li key={`still-${item.recommendation.recommendation.id}-${reason}`}>Fortsatt relevant: {reason}</li>
                      ))}
                      {item.whyNotHigher.map((reason) => (
                        <li key={`lower-${item.recommendation.recommendation.id}-${reason}`}>Ikke løftet høyere nå: {reason}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
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
                  <p className="eyebrow">Ikke anta</p>
                  <h2>Dette bør du ikke legge til grunn uten videre</h2>
                </div>
              </div>

              <div className="stack">
                {result.doNotAssumeList.map((item) => (
                  <article className="note-box note-box--warning" key={item}>
                    <p>{item}</p>
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

            {result.glossaryTerms.length ? (
              <section className="card">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Ordliste</p>
                    <h2>Kort forklart uten fagspråk</h2>
                  </div>
                </div>

                <div className="stack stack--tight">
                  {result.glossaryTerms.map((term) => (
                    <article className="policy-card" key={term.id}>
                      <strong>{term.title}</strong>
                      <p>{term.description}</p>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

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
    </div>
  );
}
