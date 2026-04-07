import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { InlineNotice } from "../../components/InlineNotice";
import { ProgressBar } from "../../components/ProgressBar";
import { PublicNotice } from "../../components/PublicNotice";
import { StatusBadge } from "../../components/StatusBadge";
import { useContentBundle } from "../../lib/contentDrafts";
import { buildGuideResult, evaluateWizard } from "../../lib/ruleEngine";
import { clearWizardSession, pruneWizardAnswers, readWizardSession, setWizardAnswer, writeWizardSession } from "../../lib/sessionState";
import type { AnswerValue, Question, WizardSession } from "../../lib/types";

function toSelectionState(question: Question, value: AnswerValue | undefined) {
  if (question.selectionMode === "multi") {
    return Array.isArray(value) ? value : [];
  }

  return typeof value === "string" ? value : "";
}

function nextQuestionAfter(questionId: string, questions: Question[], answers: Record<string, AnswerValue>) {
  const currentIndex = questions.findIndex((question) => question.id === questionId);
  const followingQuestions = questions.slice(Math.max(currentIndex + 1, 0));

  return followingQuestions.find((question) => answers[question.id] === undefined) ?? null;
}

export function GuidePage() {
  const bundle = useContentBundle();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<WizardSession>(() => readWizardSession());
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | string[]>([]);
  const [notice, setNotice] = useState<{ tone: "warning" | "error"; message: string } | null>(null);

  const evaluation = useMemo(() => evaluateWizard(bundle, session.answers), [bundle, session.answers]);
  const activeQuestion =
    evaluation.visibleQuestions.find((question) => question.id === activeQuestionId) ??
    evaluation.visibleQuestions.find((question) => session.answers[question.id] === undefined) ??
    evaluation.visibleQuestions[evaluation.visibleQuestions.length - 1] ??
    null;

  useEffect(() => {
    const preselectedStart = searchParams.get("start");
    if (!preselectedStart || session.answers.start_situation) {
      return;
    }

    const question = bundle.questions.find((item) => item.id === "start_situation");
    if (!question || !question.options.some((option) => option.id === preselectedStart)) {
      return;
    }

    const nextSession = writeWizardSession(setWizardAnswer(session, "start_situation", preselectedStart));
    setSession(nextSession);
  }, [bundle.questions, searchParams, session]);

  useEffect(() => {
    if (!activeQuestion && evaluation.visibleQuestions.length > 0) {
      setActiveQuestionId(evaluation.visibleQuestions.find((question) => session.answers[question.id] === undefined)?.id ?? evaluation.visibleQuestions[0].id);
      return;
    }

    if (activeQuestion) {
      setSelection(toSelectionState(activeQuestion, session.answers[activeQuestion.id]));
    }
  }, [activeQuestion, evaluation.visibleQuestions, session.answers]);

  function handleContinue() {
    if (!activeQuestion) {
      return;
    }

    setNotice(null);

    const hasSelection =
      activeQuestion.selectionMode === "multi"
        ? Array.isArray(selection) && selection.length > 0
        : typeof selection === "string" && selection.length > 0;

    if (!hasSelection) {
      setNotice({
        tone: "warning",
        message: "Velg et svar før du går videre. Du kan alltid velge «Vet ikke».",
      });
      return;
    }

    const updatedSession = setWizardAnswer(session, activeQuestion.id, selection as AnswerValue);
    const previewEvaluation = evaluateWizard(bundle, updatedSession.answers);
    const prunedSession = pruneWizardAnswers(updatedSession, previewEvaluation.visibleQuestions);
    const persistedSession = writeWizardSession(prunedSession);
    const finalEvaluation = evaluateWizard(bundle, persistedSession.answers);
    const nextQuestion = nextQuestionAfter(activeQuestion.id, finalEvaluation.visibleQuestions, persistedSession.answers);

    setSession(persistedSession);

    if (!nextQuestion) {
      navigate("/result");
      return;
    }

    setActiveQuestionId(nextQuestion.id);
  }

  function handleBack() {
    if (!activeQuestion) {
      return;
    }

    const currentIndex = evaluation.visibleQuestions.findIndex((question) => question.id === activeQuestion.id);
    if (currentIndex <= 0) {
      navigate("/");
      return;
    }

    setActiveQuestionId(evaluation.visibleQuestions[currentIndex - 1].id);
  }

  function handleRestart() {
    const confirmed = window.confirm("Vil du starte på nytt og slette svarene i denne nettlesersesjonen?");
    if (!confirmed) {
      return;
    }

    clearWizardSession();
    setSession(readWizardSession());
    setActiveQuestionId(null);
    setNotice(null);
  }

  if (!activeQuestion && evaluation.visibleQuestions.length > 0) {
    const result = buildGuideResult(bundle, session.answers);

    return (
      <div className="page stack">
        <section className="card">
          <h1>Veiviseren er fullført</h1>
          <p>Du har svart på alle synlige spørsmål i denne økten.</p>
          <div className="action-row">
            <Link className="primary-button" to="/result">
              Gå til resultat
            </Link>
            <button className="ghost-button" onClick={handleRestart} type="button">
              Start på nytt
            </button>
          </div>
        </section>

        <section className="card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Foreløpig hovedløp</p>
              <h2>{result.primaryRecommendation.recommendation.title}</h2>
            </div>
            <StatusBadge tone="fact">{result.primaryRecommendation.recommendation.category}</StatusBadge>
          </div>
          <p>{result.primaryRecommendation.recommendation.summary}</p>
        </section>
      </div>
    );
  }

  if (!activeQuestion) {
    return (
      <div className="page stack">
        <section className="card">
          <h1>Ingen spørsmål tilgjengelige</h1>
          <p>Veiviseren fant ingen spørsmål å vise akkurat nå. Start på nytt eller gå tilbake til forsiden.</p>
          <div className="action-row">
            <Link className="ghost-button" to="/">
              Til forsiden
            </Link>
            <button className="primary-button" onClick={handleRestart} type="button">
              Nullstill økten
            </button>
          </div>
        </section>
      </div>
    );
  }

  const currentStep = evaluation.visibleQuestions.findIndex((question) => question.id === activeQuestion.id) + 1;

  return (
    <div className="page stack">
      <ProgressBar current={currentStep} total={evaluation.visibleQuestions.length} />

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Veiviser</p>
            <h1>{activeQuestion.title}</h1>
          </div>
          <StatusBadge>{activeQuestion.selectionMode === "multi" ? "Flere svar mulig" : "Velg ett svar"}</StatusBadge>
        </div>

        {activeQuestion.description ? <p className="lead lead--compact">{activeQuestion.description}</p> : null}
        <PublicNotice />
        {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            handleContinue();
          }}
        >
          <fieldset className="choices" role="radiogroup">
            <legend className="sr-only">{activeQuestion.title}</legend>
            {activeQuestion.options.map((option) => {
              const checked =
                activeQuestion.selectionMode === "multi"
                  ? Array.isArray(selection) && selection.includes(option.id)
                  : selection === option.id;

              return (
                <label className={checked ? "choice-card is-selected" : "choice-card"} key={option.id}>
                  <input
                    checked={checked}
                    name={activeQuestion.id}
                    onChange={(event) => {
                      if (activeQuestion.selectionMode === "multi") {
                        const current = Array.isArray(selection) ? selection : [];
                        setSelection(
                          event.target.checked ? [...current, option.id] : current.filter((value) => value !== option.id),
                        );
                        return;
                      }

                      setSelection(option.id);
                    }}
                    type={activeQuestion.selectionMode === "multi" ? "checkbox" : "radio"}
                    value={option.id}
                  />
                  <div>
                    <strong>{option.label}</strong>
                    {option.description ? <p>{option.description}</p> : null}
                  </div>
                </label>
              );
            })}
          </fieldset>

          <div className="action-row">
            <button className="ghost-button" onClick={handleBack} type="button">
              Tilbake
            </button>
            <button className="primary-button" type="submit">
              Fortsett
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Svar så langt</p>
            <h2>Det veiviseren bygger på</h2>
          </div>
        </div>
        <div className="stack stack--tight">
          {evaluation.answeredFacts.length === 0 ? <p>Ingen svar registrert ennå.</p> : null}
          {evaluation.answeredFacts.map((fact) => (
            <div className="policy-card" key={fact}>
              <p>{fact}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
