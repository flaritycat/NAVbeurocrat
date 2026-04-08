import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { InlineNotice } from "../../components/InlineNotice";
import { ProgressBar } from "../../components/ProgressBar";
import { StatusBadge } from "../../components/StatusBadge";
import { useContentBundle } from "../../lib/contentDrafts";
import { buildConsistencyNotes, buildGuideResult, buildQuestionReason, evaluateWizard } from "../../lib/ruleEngine";
import { addWizardCheckpoint, clearWizardSession, pruneWizardAnswers, readWizardSession, setWizardAnswer, writeWizardSession } from "../../lib/sessionState";
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
  const goal = searchParams.get("goal");

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
    const previewResult = buildGuideResult(bundle, prunedSession.answers, prunedSession);
    const answerSummary = activeQuestion.options
      .filter((option) =>
        activeQuestion.selectionMode === "multi"
          ? Array.isArray(selection) && selection.includes(option.id)
          : selection === option.id,
      )
      .map((option) => option.label)
      .join(", ");
    const sessionWithHistory = addWizardCheckpoint(prunedSession, {
      questionId: activeQuestion.id,
      questionTitle: activeQuestion.title,
      answerSummary: `${activeQuestion.title}: ${answerSummary}`,
      recommendationTitle: previewResult.primaryRecommendation.recommendation.title,
    });
    const persistedSession = writeWizardSession(sessionWithHistory);
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

  const hasSelection =
    activeQuestion?.selectionMode === "multi"
      ? Array.isArray(selection) && selection.length > 0
      : typeof selection === "string" && selection.length > 0;
  const previewAnswers = useMemo(() => {
    if (!activeQuestion || !hasSelection) {
      return session.answers;
    }

    return {
      ...session.answers,
      [activeQuestion.id]: selection as AnswerValue,
    };
  }, [activeQuestion, hasSelection, selection, session.answers]);
  const previewEvaluation = useMemo(() => evaluateWizard(bundle, previewAnswers), [bundle, previewAnswers]);
  const previewConsistencyNote = hasSelection ? buildConsistencyNotes(previewEvaluation)[0] ?? null : null;
  const previewResult = useMemo(() => {
    if (!hasSelection) {
      return null;
    }

    return buildGuideResult(bundle, previewAnswers, session);
  }, [bundle, hasSelection, previewAnswers, session]);

  if (!activeQuestion && evaluation.visibleQuestions.length > 0) {
    const result = buildGuideResult(bundle, session.answers, session);

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
              <p className="eyebrow">Foreløpig hovedspor</p>
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
  const questionReasons = buildQuestionReason(activeQuestion, evaluation);
  const consistencyNotes = buildConsistencyNotes(evaluation);
  const firstConsistencyNote = consistencyNotes[0];
  const previewAcuteItem = previewResult?.acuteItems[0] ?? null;
  const recentAnswers = evaluation.answeredFacts.slice(-2).reverse();
  const goalText =
    goal === "urgency"
      ? "Du kom hit via hurtigveien for hva som haster mest. Veiviseren vil fortsatt be om noen få opplysninger for å prioritere mer presist."
      : goal === "contact"
        ? "Du kom hit via hurtigveien for hvem du bør kontakte. Veiviseren vil vektlegge første kontaktpunkt, formulering og rekkefølge."
        : goal === "documents"
          ? "Du kom hit via hurtigveien for hva du bør samle. Veiviseren vil bruke svarene dine til å løfte dokumentasjon, sjekkliste og før-kontakt-notat."
          : null;

  return (
    <div className="page stack">
      <ProgressBar current={currentStep} total={evaluation.visibleQuestions.length} />

      <section className="card">
        <div className="section-heading">
          <div>
            <h1>{activeQuestion.title}</h1>
          </div>
          <span className="guide-choice-mode">
            <StatusBadge>{activeQuestion.selectionMode === "multi" ? "Flere svar mulig" : "Velg ett svar"}</StatusBadge>
          </span>
        </div>

        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            handleContinue();
          }}
        >
          <fieldset className="choices" role={activeQuestion.selectionMode === "multi" ? "group" : "radiogroup"}>
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

          {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}
          {activeQuestion.description ? <p className="lead lead--compact question-description question-description--desktop">{activeQuestion.description}</p> : null}
          {activeQuestion.description ? (
            <details className="question-description-mobile">
              <summary>Les kort forklaring</summary>
              <p>{activeQuestion.description}</p>
            </details>
          ) : null}
          {goalText ? <InlineNotice tone="warning">{goalText}</InlineNotice> : null}
          {firstConsistencyNote ? (
            <InlineNotice tone={firstConsistencyNote.tone === "warning" ? "warning" : "error"}>
              <strong>{firstConsistencyNote.title}.</strong> {firstConsistencyNote.description}
            </InlineNotice>
          ) : null}
          {questionReasons.length ? (
            <article className="question-context">
              <p className="eyebrow">Hvorfor dette spørsmålet kommer nå</p>
              <ul className="plain-list plain-list--spaced">
                {questionReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {previewResult ? (
            <article className="question-preview">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Foreløpig retning</p>
                  <h3>{previewResult.primaryRecommendation.recommendation.title}</h3>
                </div>
                <StatusBadge tone="fact">{previewResult.primaryRecommendation.recommendation.category}</StatusBadge>
              </div>
              <p className="question-preview__summary">{previewResult.primaryRecommendation.recommendation.summary}</p>
              <ul className="plain-list plain-list--spaced question-preview__reasons">
                {(previewResult.primaryRecommendation.reasons.length
                  ? previewResult.primaryRecommendation.reasons
                  : ["Dette ser foreløpig ut som et trygt sted å starte videre avklaring."]).map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {previewAcuteItem ? (
            <article className="question-preview">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Akuttvern</p>
                  <h3>{previewAcuteItem.rule.title}</h3>
                </div>
                <StatusBadge tone="warning">Dette bryter inn</StatusBadge>
              </div>
              <p>{previewAcuteItem.rule.summary}</p>
              <ul className="plain-list plain-list--spaced">
                {previewAcuteItem.links.slice(0, 2).map((link) => (
                  <li key={link.id}>{link.actionLabel}</li>
                ))}
              </ul>
            </article>
          ) : null}
          {previewConsistencyNote && previewConsistencyNote.title !== firstConsistencyNote?.title ? (
            <InlineNotice tone={previewConsistencyNote.tone === "warning" ? "warning" : "error"}>
              <strong>Hvis du velger dette:</strong> {previewConsistencyNote.title}. {previewConsistencyNote.description}
            </InlineNotice>
          ) : null}

          <div className="action-row">
            <button className="text-button" onClick={handleBack} type="button">
              Tilbake
            </button>
            <button className="primary-button" type="submit">
              {previewAcuteItem ? "Fortsett med hastefokus" : "Fortsett"}
            </button>
          </div>

          {recentAnswers.length ? (
            <section className="guide-recent">
              <div className="guide-recent__header">
                <p className="eyebrow">Siste svar</p>
                <span className="guide-recent__count">{`${evaluation.answeredFacts.length} totalt`}</span>
              </div>
              <div className="guide-recent__items">
                {recentAnswers.map((fact) => (
                  <p className="guide-recent__item" key={fact}>
                    {fact}
                  </p>
                ))}
              </div>
            </section>
          ) : null}
        </form>
      </section>
    </div>
  );
}
