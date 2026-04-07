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
  whyPrompt?: string;
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
  history: WizardCheckpoint[];
  checklistState: Record<string, boolean>;
};

export type WizardCheckpoint = {
  id: string;
  questionId: string;
  questionTitle: string;
  answerSummary: string;
  recommendationTitle: string;
  recordedAt: string;
};

export type WizardEvaluation = {
  visibleQuestions: Question[];
  flags: string[];
  scores: Record<string, number>;
  rationaleMap: Record<string, string[]>;
  answeredFacts: string[];
  flagSources: Record<string, string[]>;
};

export type RankedRecommendation = {
  recommendation: Recommendation;
  score: number;
  reasons: string[];
};

export type ActionBucket = {
  id: "today" | "this_week" | "later";
  title: string;
  tone: "warning" | "fact" | "neutral";
  items: string[];
};

export type BeforeContactCard = {
  contactFirst: string;
  whyNow: string[];
  sayThisFirst: string[];
  haveReady: string[];
  askFor: string[];
  copyText: string;
};

export type ConsistencyNote = {
  title: string;
  description: string;
  tone: "warning" | "missing";
};

export type AlternativeAssessment = {
  recommendation: RankedRecommendation;
  whyStillRelevant: string[];
  whyNotHigher: string[];
};

export type HelpModeCard = {
  id: "emergency" | "rights" | "practical" | "guidance";
  title: string;
  description: string;
  tone: "warning" | "fact" | "neutral";
  items: string[];
};

export type CompactGuideCard = {
  title: string;
  intro: string;
  items: string[];
  copyText: string;
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
  alternativeAssessments: AlternativeAssessment[];
  parallelRecommendations: RankedRecommendation[];
  supportRecommendations: RankedRecommendation[];
  acuteItems: MatchedAcuteItem[];
  documentSections: ResultDocumentSection[];
  officialLinks: OfficialLink[];
  helpModeCards: HelpModeCard[];
  actionBuckets: ActionBucket[];
  beforeContact: BeforeContactCard;
  phoneCard: CompactGuideCard;
  meetingCard: CompactGuideCard;
  consistencyNotes: ConsistencyNote[];
  nextSteps: string[];
  askForList: string[];
  riskNotes: string[];
  doNotAssumeList: string[];
  contactDraft: string;
  summaryText: string;
  sessionHistory: WizardCheckpoint[];
  disclaimers: Disclaimer[];
};
