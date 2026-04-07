import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { InlineNotice } from "../../components/InlineNotice";
import { ProgressBar } from "../../components/ProgressBar";
import { PublicNotice } from "../../components/PublicNotice";
import { StatusBadge } from "../../components/StatusBadge";
import { useContentBundle } from "../../lib/contentDrafts";
import { buildGuideResult } from "../../lib/ruleEngine";
import { addWizardCheckpoint, clearWizardSession, readWizardSession, setWizardAnswer, writeWizardSession } from "../../lib/sessionState";
import type { AnswerValue, Question, WizardSession } from "../../lib/types";

const LETTER_SCAN_QUESTION_IDS = ["letter_decision_context", "decision_timeline", "existing_followup", "follow_up_need"] as const;

function toSelectionState(question: Question, value: AnswerValue | undefined) {
  if (question.selectionMode === "multi") {
    return Array.isArray(value) ? value : [];
  }

  return typeof value === "string" ? value : "";
}

export function LetterScanPage() {
  const bundle = useContentBundle();
  const navigate = useNavigate();
  const [session, setSession] = useState<WizardSession>(() => readWizardSession());
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [selection, setSelection] = useState<string | string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const questions = useMemo(
    () =>
      LETTER_SCAN_QUESTION_IDS.map((id) => bundle.questions.find((question) => question.id === id)).filter(
        (question): question is Question => Boolean(question),
      ),
    [bundle.questions],
  );
  const activeQuestion =
    questions.find((question) => question.id === activeQuestionId) ??
    questions.find((question) => session.answers[question.id] === undefined) ??
    null;

  useEffect(() => {
    if (session.answers.start_situation === "letter_or_decision") {
      return;
    }

    const nextSession = writeWizardSession(setWizardAnswer(session, "start_situation", "letter_or_decision"));
    setSession(nextSession);
  }, [session]);

  useEffect(() => {
    if (!activeQuestion && questions.length > 0) {
      setActiveQuestionId(questions.find((question) => session.answers[question.id] === undefined)?.id ?? questions[0].id);
      return;
    }

    if (activeQuestion) {
      setSelection(toSelectionState(activeQuestion, session.answers[activeQuestion.id]));
    }
  }, [activeQuestion, questions, session.answers]);

  function handleContinue() {
    if (!activeQuestion) {
      return;
    }

    const hasSelection =
      activeQuestion.selectionMode === "multi"
        ? Array.isArray(selection) && selection.length > 0
        : typeof selection === "string" && selection.length > 0;

    if (!hasSelection) {
      setNotice("Velg et svar før du går videre. Du kan alltid velge «Vet ikke».");
      return;
    }

    setNotice(null);

    const letterSession =
      session.answers.start_situation === "letter_or_decision"
        ? session
        : setWizardAnswer(session, "start_situation", "letter_or_decision");
    const updatedSession = setWizardAnswer(letterSession, activeQuestion.id, selection as AnswerValue);
    const previewResult = buildGuideResult(bundle, updatedSession.answers, updatedSession);
    const answerSummary = activeQuestion.options
      .filter((option) =>
        activeQuestion.selectionMode === "multi"
          ? Array.isArray(selection) && selection.includes(option.id)
          : selection === option.id,
      )
      .map((option) => option.label)
      .join(", ");
    const nextSession = writeWizardSession(
      addWizardCheckpoint(updatedSession, {
        questionId: activeQuestion.id,
        questionTitle: activeQuestion.title,
        answerSummary: `${activeQuestion.title}: ${answerSummary}`,
        recommendationTitle: previewResult.primaryRecommendation.recommendation.title,
      }),
    );
    const currentIndex = questions.findIndex((question) => question.id === activeQuestion.id);
    const nextQuestion = questions.slice(currentIndex + 1).find((question) => nextSession.answers[question.id] === undefined) ?? null;

    setSession(nextSession);

    if (!nextQuestion) {
      setActiveQuestionId(null);
      return;
    }

    setActiveQuestionId(nextQuestion.id);
  }

  function handleBack() {
    if (!activeQuestion) {
      navigate("/");
      return;
    }

    const currentIndex = questions.findIndex((question) => question.id === activeQuestion.id);
    if (currentIndex <= 0) {
      navigate("/");
      return;
    }

    setActiveQuestionId(questions[currentIndex - 1].id);
  }

  function handleRestart() {
    const confirmed = window.confirm("Vil du starte brevscanner på nytt og slette svarene i denne nettlesersesjonen?");
    if (!confirmed) {
      return;
    }

    clearWizardSession();
    setSession(readWizardSession());
    setActiveQuestionId(null);
    setNotice(null);
  }

  if (!activeQuestion) {
    const result = buildGuideResult(bundle, session.answers, session);

    return (
      <div className="page stack">
        <section className="hero-card hero-card--single">
          <div>
            <p className="eyebrow">Brevscanner</p>
            <h1>{result.primaryRecommendation.recommendation.title}</h1>
            <p className="lead">{result.primaryRecommendation.recommendation.summary}</p>
          </div>
          <div className="action-row">
            <Link className="primary-button" to="/result">
              Åpne full oversikt
            </Link>
            <Link className="ghost-button" to="/brief">
              Åpne kortversjon
            </Link>
            <button className="ghost-button" onClick={handleRestart} type="button">
              Start på nytt
            </button>
          </div>
        </section>

        <PublicNotice />

        {result.acuteItems.length ? (
          <section className="card stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Hva haster</p>
                <h2>Dette må tas først</h2>
              </div>
            </div>
            {result.acuteItems.map((item) => (
              <article className="note-box note-box--warning" key={item.rule.id}>
                <h3>{item.rule.title}</h3>
                <p>{item.rule.summary}</p>
              </article>
            ))}
          </section>
        ) : null}

        <section className="dashboard-grid">
          <section className="card stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Første grep</p>
                <h2>Dette kan du gjøre videre</h2>
              </div>
            </div>
            <article className="note-box note-box--fact">
              <h3>Kontakt først</h3>
              <p>{result.beforeContact.contactFirst}</p>
            </article>
            <article className="policy-card">
              <h3>Det kan være lurt å be om</h3>
              <ul className="plain-list plain-list--spaced">
                {result.askForList.slice(0, 4).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
          </section>

          <section className="card stack">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Ikke anta</p>
                <h2>Dette bør du passe på</h2>
              </div>
            </div>
            {result.doNotAssumeList.slice(0, 4).map((item) => (
              <article className="note-box note-box--warning" key={item}>
                <p>{item}</p>
              </article>
            ))}
          </section>
        </section>
      </div>
    );
  }

  const currentStep = questions.findIndex((question) => question.id === activeQuestion.id) + 1;

  return (
    <div className="page stack">
      <ProgressBar current={currentStep} total={questions.length} />

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Brevscanner</p>
            <h1>{activeQuestion.title}</h1>
          </div>
          <StatusBadge>Rask flyt</StatusBadge>
        </div>

        {activeQuestion.description ? <p className="lead lead--compact">{activeQuestion.description}</p> : null}
        <PublicNotice />
        {notice ? <InlineNotice tone="warning">{notice}</InlineNotice> : null}

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
    </div>
  );
}
