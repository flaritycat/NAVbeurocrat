export type AnswerValue = string | string[];

export type QuestionOption = {
  id: string;
  label: string;
  description?: string;
  effects: {
    flags?: string[];
    scores?: Record<string, number>;
    rationaleIds?: string[];
  };
};

export type Question = {
  id: string;
  title: string;
  description?: string;
  selectionMode: "single" | "multi";
  showWhenAnyFlags?: string[];
  showWhenAllFlags?: string[];
  showWhenNoFlags?: string[];
  options: QuestionOption[];
};

export type Recommendation = {
  id: string;
  title: string;
  owner: string;
  category: "ytelse" | "tjeneste" | "hjelpetiltak";
  priority: number;
  minScore: number;
  summary: string;
  documentListIds: string[];
  phraseTemplateId: string;
  officialLinkIds: string[];
  rationaleMap: Record<string, string>;
};

export type AcuteRule = {
  id: string;
  priority: number;
  title: string;
  summary: string;
  whenAnyFlags?: string[];
  whenAllFlags?: string[];
  whenNoFlags?: string[];
  documentListIds: string[];
  officialLinkIds: string[];
  recommendedIds: string[];
};

export type DocumentList = {
  id: string;
  title: string;
  items: string[];
};

export type PhraseTemplate = {
  id: string;
  title: string;
  content: string;
};

export type OfficialLink = {
  id: string;
  title: string;
  publisher: string;
  group: "NAV" | "kommune" | "Husbanken" | "helse" | "rettshjelp";
  url: string;
  actionLabel: string;
  description: string;
  whenRelevant?: string;
  priority?: number;
};

export type Disclaimer = {
  id: string;
  title: string;
  text: string;
};

export type GuideContentBundle = {
  questions: Question[];
  recommendations: Recommendation[];
  acuteRules: AcuteRule[];
  documentLists: DocumentList[];
  phraseTemplates: PhraseTemplate[];
  officialLinks: OfficialLink[];
  disclaimers: Disclaimer[];
};

export type WizardSession = {
  answers: Record<string, AnswerValue>;
  startedAt: string;
  updatedAt: string;
};

export type WizardEvaluation = {
  visibleQuestions: Question[];
  flags: string[];
  scores: Record<string, number>;
  rationaleMap: Record<string, string[]>;
  answeredFacts: string[];
};

export type RankedRecommendation = {
  recommendation: Recommendation;
  score: number;
  reasons: string[];
};

export type MatchedAcuteItem = {
  rule: AcuteRule;
  links: OfficialLink[];
  documentLists: ResultDocumentSection[];
};

export type ResultDocumentSection = {
  title: string;
  items: string[];
};

export type GuideResult = {
  evaluation: WizardEvaluation;
  primaryRecommendation: RankedRecommendation;
  alternativeRecommendations: RankedRecommendation[];
  acuteItems: MatchedAcuteItem[];
  documentSections: ResultDocumentSection[];
  officialLinks: OfficialLink[];
  nextSteps: string[];
  askForList: string[];
  riskNotes: string[];
  contactDraft: string;
  summaryText: string;
  disclaimers: Disclaimer[];
};
