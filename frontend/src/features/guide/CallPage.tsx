import { Link, useNavigate } from "react-router-dom";
import { CopyBlock } from "../../components/CopyBlock";
import { SafeExternalLink } from "../../components/SafeExternalLink";
import { StatusBadge } from "../../components/StatusBadge";
import { useContentBundle } from "../../lib/contentDrafts";
import { buildGuideResult, evaluateWizard } from "../../lib/ruleEngine";
import { clearWizardSession, readWizardSession } from "../../lib/sessionState";
import type { CompactGuideCard } from "../../lib/types";

export function CallPage() {
  const bundle = useContentBundle();
  const navigate = useNavigate();
  const session = readWizardSession();
  const evaluation = evaluateWizard(bundle, session.answers);

  if (evaluation.visibleQuestions.length === 0) {
    return (
      <div className="page">
        <section className="card stack">
          <h1>Ingen veiviserøkt funnet</h1>
          <p>Start veiviseren først for å lage en kort ringevisning.</p>
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
          <p>Fullfør spørsmålene først for å få en tydelig nok ringevisning.</p>
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
  const extraCards = [result.youthGuideCard, result.childSchoolCard, result.letterSummaryCard].filter(
    (card): card is CompactGuideCard => Boolean(card),
  );

  function handleRestart() {
    const confirmed = window.confirm("Vil du slette veivisersvarene i denne økten og starte på nytt?");
    if (!confirmed) {
      return;
    }

    clearWizardSession();
    navigate("/");
  }

  return (
    <div className="page stack">
      <section className="hero-card hero-card--single">
        <div>
          <p className="eyebrow">Før du ringer</p>
          <h1>{result.primaryRecommendation.recommendation.title}</h1>
          <p className="lead">{result.phoneCard.intro}</p>
        </div>
        <div className="action-row">
          <Link className="primary-button" to="/result">
            Til full oversikt
          </Link>
          <Link className="ghost-button" to="/brief">
            Kortversjon
          </Link>
          <button className="ghost-button" onClick={handleRestart} type="button">
            Start på nytt
          </button>
        </div>
      </section>
      {result.acuteItems.length ? (
        <section className="card stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Haster først</p>
              <h2>Dette bør bryte inn før resten</h2>
            </div>
            <StatusBadge tone="warning">Hastefokus</StatusBadge>
          </div>
          {result.acuteItems.map((item) => (
            <article className="note-box note-box--warning" key={item.rule.id}>
              <h3>{item.rule.title}</h3>
              <p>{item.rule.summary}</p>
            </article>
          ))}
        </section>
      ) : null}

      <section className="card call-sheet">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ringekort</p>
            <h2>Det viktigste du trenger på én skjerm</h2>
          </div>
          <StatusBadge tone="fact">Mobilklar</StatusBadge>
        </div>

        <div className="call-sheet__grid">
          <article className="note-box note-box--fact">
            <h3>Kontakt først</h3>
            <p>{result.beforeContact.contactFirst}</p>
          </article>
          <article className="policy-card">
            <h3>Si dette først</h3>
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
            <h3>Be om dette</h3>
            <ul className="plain-list plain-list--spaced">
              {result.beforeContact.askFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      {extraCards.length ? (
        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Tilpassede kort</p>
              <h2>Bruk dette hvis situasjonen din trenger en kortere variant</h2>
            </div>
          </div>

          <div className="dashboard-grid">
            {extraCards.map((card) => (
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
        </section>
      ) : null}

      <section className="dashboard-grid">
        <section className="card stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Kopier</p>
              <h2>Les opp eller lim inn</h2>
            </div>
          </div>
          <CopyBlock content={result.phoneCard.copyText} title="Kopier telefonkort" />
          <CopyBlock content={result.beforeContact.copyText} title="Kopier før-kontakt-notat" />
        </section>

        <section className="card stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Lenker</p>
              <h2>Offisielle kontaktpunkter</h2>
            </div>
          </div>
          {result.officialLinks.slice(0, 4).map((link) => (
            <article className="list-card" key={link.id}>
              <div className="list-card__meta">
                <strong>{link.actionLabel}</strong>
                <span>{link.description}</span>
              </div>
              <SafeExternalLink href={link.url}>{link.publisher}</SafeExternalLink>
            </article>
          ))}
        </section>
      </section>
    </div>
  );
}
