import { sessionStorageKey } from "./config";
import type { AnswerValue, Question, WizardCheckpoint, WizardSession } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function emptySession(): WizardSession {
  const timestamp = nowIso();
  return {
    answers: {},
    startedAt: timestamp,
    updatedAt: timestamp,
    history: [],
    checklistState: {},
  };
}

export function readWizardSession() {
  if (typeof window === "undefined") {
    return emptySession();
  }

  const raw = window.sessionStorage.getItem(sessionStorageKey);
  if (!raw) {
    return emptySession();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<WizardSession>;
    return {
      answers: parsed.answers && typeof parsed.answers === "object" ? (parsed.answers as Record<string, AnswerValue>) : {},
      startedAt: typeof parsed.startedAt === "string" ? parsed.startedAt : nowIso(),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : nowIso(),
      history: Array.isArray(parsed.history) ? (parsed.history as WizardCheckpoint[]) : [],
      checklistState:
        parsed.checklistState && typeof parsed.checklistState === "object"
          ? (parsed.checklistState as Record<string, boolean>)
          : {},
    };
  } catch {
    return emptySession();
  }
}

export function writeWizardSession(session: WizardSession) {
  window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(session));
  return session;
}

export function clearWizardSession() {
  window.sessionStorage.removeItem(sessionStorageKey);
}

export function setWizardAnswer(session: WizardSession, questionId: string, value: AnswerValue) {
  return {
    ...session,
    answers: {
      ...session.answers,
      [questionId]: value,
    },
    updatedAt: nowIso(),
  } satisfies WizardSession;
}

export function pruneWizardAnswers(session: WizardSession, visibleQuestions: Question[]) {
  const visibleQuestionIds = new Set(visibleQuestions.map((question) => question.id));
  const prunedAnswers = Object.fromEntries(
    Object.entries(session.answers).filter(([questionId]) => visibleQuestionIds.has(questionId)),
  ) as Record<string, AnswerValue>;

  return {
    ...session,
    answers: prunedAnswers,
    updatedAt: nowIso(),
  } satisfies WizardSession;
}

export function addWizardCheckpoint(session: WizardSession, checkpoint: Omit<WizardCheckpoint, "id" | "recordedAt">) {
  const recordedAt = nowIso();

  return {
    ...session,
    history: [
      ...session.history,
      {
        ...checkpoint,
        id: `${checkpoint.questionId}-${recordedAt}`,
        recordedAt,
      },
    ].slice(-24),
    updatedAt: recordedAt,
  } satisfies WizardSession;
}

export function setChecklistItem(session: WizardSession, key: string, checked: boolean) {
  return {
    ...session,
    checklistState: {
      ...session.checklistState,
      [key]: checked,
    },
    updatedAt: nowIso(),
  } satisfies WizardSession;
}

export function clearChecklistState(session: WizardSession) {
  return {
    ...session,
    checklistState: {},
    updatedAt: nowIso(),
  } satisfies WizardSession;
}
