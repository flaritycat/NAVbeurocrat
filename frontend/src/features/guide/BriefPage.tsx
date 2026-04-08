import { Link, useNavigate } from "react-router-dom";
import { CopyBlock } from "../../components/CopyBlock";
import { StatusBadge } from "../../components/StatusBadge";
import { useContentBundle } from "../../lib/contentDrafts";
import { buildGuideResult, evaluateWizard } from "../../lib/ruleEngine";
import { clearWizardSession, readWizardSession } from "../../lib/sessionState";

export function BriefPage() {
  const bundle = useContentBundle();
  const navigate = useNavigate();
  const session = readWizardSession();
  const evaluation = evaluateWizard(bundle, session.answers);

  if (evaluation.visibleQuestions.length === 0) {
    return (
      <div className="page">
        <section className="card stack">
          <h1>Ingen veiviserøkt funnet</h1>
          <p>Start veiviseren først for å lage en kortversjon.</p>
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
          <p>Fullfør spørsmålene først for å få en kortversjon som er tydelig nok til å bruke videre.</p>
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
          <p className="eyebrow">Kortversjon</p>
          <h1>{result.primaryRecommendation.recommendation.title}</h1>
          <p className="lead">{result.primaryRecommendation.recommendation.summary}</p>
        </div>
        <div className="action-row">
          <Link className="primary-button" to="/result">
            Til full oversikt
          </Link>
          <Link className="ghost-button" to="/call">
            Ringekort
          </Link>
          <button className="ghost-button" onClick={handleRestart} type="button">
            Start på nytt
          </button>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="card stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Telefon</p>
              <h2>{result.phoneCard.title}</h2>
            </div>
            <StatusBadge tone="fact">Kort</StatusBadge>
          </div>
          <p>{result.phoneCard.intro}</p>
          <ul className="plain-list plain-list--spaced">
            {result.phoneCard.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <CopyBlock content={result.phoneCard.copyText} title="Kopier telefonkort" />
        </section>

        <section className="card stack">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Møte</p>
              <h2>{result.meetingCard.title}</h2>
            </div>
            <StatusBadge>Møteark</StatusBadge>
          </div>
          <p>{result.meetingCard.intro}</p>
          <ul className="plain-list plain-list--spaced">
            {result.meetingCard.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <CopyBlock content={result.meetingCard.copyText} title="Kopier møteark" />
        </section>
      </div>
    </div>
  );
}
