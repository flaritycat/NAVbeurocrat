import { sessionStorageKey } from "./config";
import type { AnswerValue, Question, WizardSession } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function emptySession(): WizardSession {
  const timestamp = nowIso();
  return {
    answers: {},
    startedAt: timestamp,
    updatedAt: timestamp,
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
