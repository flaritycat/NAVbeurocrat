import type {
  AcuteRule,
  AnswerValue,
  DocumentList,
  GuideContentBundle,
  GuideResult,
  MatchedAcuteItem,
  OfficialLink,
  PhraseTemplate,
  Question,
  QuestionOption,
  RankedRecommendation,
  Recommendation,
  ResultDocumentSection,
  WizardEvaluation,
} from "./types";

function normalizeAnswerValue(value: AnswerValue | undefined) {
  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === "string" && value ? [value] : [];
}

function isQuestionVisible(question: Question, flags: Set<string>) {
  const matchesAny =
    !question.showWhenAnyFlags || question.showWhenAnyFlags.length === 0
      ? true
      : question.showWhenAnyFlags.some((flag) => flags.has(flag));

  const matchesAll =
    !question.showWhenAllFlags || question.showWhenAllFlags.length === 0
      ? true
      : question.showWhenAllFlags.every((flag) => flags.has(flag));

  const matchesNo =
    !question.showWhenNoFlags || question.showWhenNoFlags.length === 0
      ? true
      : question.showWhenNoFlags.every((flag) => !flags.has(flag));

  return matchesAny && matchesAll && matchesNo;
}

function getSelectedOptions(question: Question, answerValue: AnswerValue | undefined) {
  const selectedIds = normalizeAnswerValue(answerValue);
  return question.options.filter((option) => selectedIds.includes(option.id));
}

function collectDocumentSections(bundle: GuideContentBundle, documentListIds: string[]) {
  const seen = new Set<string>();
  const sections: ResultDocumentSection[] = [];

  documentListIds.forEach((documentListId) => {
    if (seen.has(documentListId)) {
      return;
    }

    const documentList = bundle.documentLists.find((item) => item.id === documentListId);
    if (!documentList) {
      return;
    }

    seen.add(documentListId);
    sections.push({
      title: documentList.title,
      items: [...documentList.items],
    });
  });

  return sections;
}

function collectOfficialLinks(bundle: GuideContentBundle, officialLinkIds: string[]) {
  const seen = new Set<string>();
  const links: OfficialLink[] = [];

  officialLinkIds.forEach((linkId) => {
    if (seen.has(linkId)) {
      return;
    }

    const link = bundle.officialLinks.find((item) => item.id === linkId);
    if (!link) {
      return;
    }

    seen.add(linkId);
    links.push(link);
  });

  return links;
}

function buildReasons(recommendation: Recommendation, rationaleIds: string[]) {
  return rationaleIds
    .map((rationaleId) => recommendation.rationaleMap[rationaleId])
    .filter((reason): reason is string => Boolean(reason));
}

export function evaluateWizard(bundle: GuideContentBundle, answers: Record<string, AnswerValue>) {
  const flags = new Set<string>();
  const scores = new Map<string, number>();
  const rationaleMap = new Map<string, Set<string>>();
  const visibleQuestions: Question[] = [];
  const answeredFacts: string[] = [];

  bundle.questions.forEach((question) => {
    if (!isQuestionVisible(question, flags)) {
      return;
    }

    visibleQuestions.push(question);

    const selectedOptions = getSelectedOptions(question, answers[question.id]);
    if (!selectedOptions.length) {
      return;
    }

    answeredFacts.push(`${question.title}: ${selectedOptions.map((option) => option.label).join(", ")}`);

    selectedOptions.forEach((option) => {
      (option.effects.flags ?? []).forEach((flag) => flags.add(flag));

      Object.entries(option.effects.scores ?? {}).forEach(([recommendationId, score]) => {
        scores.set(recommendationId, (scores.get(recommendationId) ?? 0) + score);

        const existing = rationaleMap.get(recommendationId) ?? new Set<string>();
        (option.effects.rationaleIds ?? []).forEach((rationaleId) => existing.add(rationaleId));
        rationaleMap.set(recommendationId, existing);
      });
    });
  });

  return {
    visibleQuestions,
    flags: [...flags],
    scores: Object.fromEntries(scores),
    rationaleMap: Object.fromEntries([...rationaleMap.entries()].map(([key, value]) => [key, [...value]])),
    answeredFacts,
  } satisfies WizardEvaluation;
}

function matchesRule(rule: AcuteRule, flags: Set<string>) {
  const matchesAny =
    !rule.whenAnyFlags || rule.whenAnyFlags.length === 0 ? true : rule.whenAnyFlags.some((flag) => flags.has(flag));
  const matchesAll =
    !rule.whenAllFlags || rule.whenAllFlags.length === 0 ? true : rule.whenAllFlags.every((flag) => flags.has(flag));
  const matchesNo =
    !rule.whenNoFlags || rule.whenNoFlags.length === 0 ? true : rule.whenNoFlags.every((flag) => !flags.has(flag));

  return matchesAny && matchesAll && matchesNo;
}

function rankRecommendations(bundle: GuideContentBundle, evaluation: WizardEvaluation) {
  const ranked = bundle.recommendations
    .map((recommendation) => {
      const score = evaluation.scores[recommendation.id] ?? 0;
      const reasons = buildReasons(recommendation, evaluation.rationaleMap[recommendation.id] ?? []);

      return {
        recommendation,
        score,
        reasons,
      } satisfies RankedRecommendation;
    })
    .filter((item) => item.score >= item.recommendation.minScore)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.recommendation.priority - right.recommendation.priority;
    });

  if (ranked.length > 0) {
    return ranked;
  }

  const fallback =
    bundle.recommendations.find((item) => item.id === "arbeid_oppfolging") ??
    bundle.recommendations.find((item) => item.id === "okonomisk_sosialhjelp");

  if (!fallback) {
    throw new Error("Fant ikke fallback-anbefaling.");
  }

  return [
    {
      recommendation: fallback,
      score: 1,
      reasons: ["Veiviseren har for lite opplysninger til en tydeligere prioritering. Start med offisiell veiledning og en enkel oversikt over situasjonen din."],
    },
  ];
}

function buildAcuteItems(bundle: GuideContentBundle, evaluation: WizardEvaluation) {
  const flags = new Set(evaluation.flags);

  return bundle.acuteRules
    .filter((rule) => matchesRule(rule, flags))
    .sort((left, right) => left.priority - right.priority)
    .map((rule) => ({
      rule,
      links: collectOfficialLinks(bundle, rule.officialLinkIds),
      documentLists: collectDocumentSections(bundle, rule.documentListIds),
    })) satisfies MatchedAcuteItem[];
}

function buildContactDraft(
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  phraseTemplate: PhraseTemplate | undefined,
  acuteItems: MatchedAcuteItem[],
) {
  const lines = [
    "Hei,",
    "",
    `Jeg ønsker veiledning om ${primaryRecommendation.recommendation.title.toLowerCase()}.`,
  ];

  if (acuteItems[0]) {
    lines.push(`Det som haster mest for meg nå er: ${acuteItems[0].rule.title.toLowerCase()}.`, "");
  }

  lines.push("Kort oppsummering av situasjonen min:", ...evaluation.answeredFacts.slice(0, 5).map((fact) => `- ${fact}`), "");

  if (phraseTemplate) {
    lines.push(phraseTemplate.content, "");
  }

  lines.push(
    "Kan dere veilede meg om hva jeg bør gjøre først, og hvilken dokumentasjon dere trenger fra meg?",
    "",
    "Vennlig hilsen",
  );

  return lines.join("\n");
}

function buildSummaryText(
  primaryRecommendation: RankedRecommendation,
  alternatives: RankedRecommendation[],
  acuteItems: MatchedAcuteItem[],
  documentSections: ResultDocumentSection[],
  officialLinks: OfficialLink[],
  contactDraft: string,
) {
  const lines = [
    "NAV-veiviser",
    "",
    `Anbefalt hovedløp: ${primaryRecommendation.recommendation.title}`,
    primaryRecommendation.recommendation.summary,
    "",
    "Hvorfor dette foreslås:",
    ...(primaryRecommendation.reasons.length ? primaryRecommendation.reasons : ["- Trenger mer avklaring i kontakt med NAV."]).map(
      (reason) => `- ${reason}`,
    ),
  ];

  if (alternatives.length) {
    lines.push("", "Alternative muligheter:", ...alternatives.map((item) => `- ${item.recommendation.title}: ${item.recommendation.summary}`));
  }

  if (acuteItems.length) {
    lines.push("", "Hva som haster:", ...acuteItems.map((item) => `- ${item.rule.title}: ${item.rule.summary}`));
  }

  if (documentSections.length) {
    lines.push("", "Vanlig dokumentasjon:");
    documentSections.forEach((section) => {
      lines.push(`- ${section.title}`);
      section.items.forEach((item) => lines.push(`  * ${item}`));
    });
  }

  lines.push("", "Forslag til formulering:", contactDraft);

  if (officialLinks.length) {
    lines.push("", "Offisielle lenker:");
    officialLinks.forEach((link) => lines.push(`- ${link.title} (${link.publisher}): ${link.url}`));
  }

  return lines.join("\n");
}

export function buildGuideResult(bundle: GuideContentBundle, answers: Record<string, AnswerValue>) {
  const evaluation = evaluateWizard(bundle, answers);
  const rankedRecommendations = rankRecommendations(bundle, evaluation);
  const primaryRecommendation = rankedRecommendations[0];
  const alternativeRecommendations = rankedRecommendations.slice(1, 4);
  const acuteItems = buildAcuteItems(bundle, evaluation);

  const documentListIds = [
    ...acuteItems.flatMap((item) => item.rule.documentListIds),
    ...primaryRecommendation.recommendation.documentListIds,
    ...alternativeRecommendations.flatMap((item) => item.recommendation.documentListIds),
  ];
  const officialLinkIds = [
    ...acuteItems.flatMap((item) => item.rule.officialLinkIds),
    ...primaryRecommendation.recommendation.officialLinkIds,
    ...alternativeRecommendations.flatMap((item) => item.recommendation.officialLinkIds),
  ];

  const documentSections = collectDocumentSections(bundle, documentListIds);
  const officialLinks = collectOfficialLinks(bundle, officialLinkIds);
  const phraseTemplate = bundle.phraseTemplates.find(
    (template) => template.id === primaryRecommendation.recommendation.phraseTemplateId,
  );
  const contactDraft = buildContactDraft(evaluation, primaryRecommendation, phraseTemplate, acuteItems);
  const summaryText = buildSummaryText(
    primaryRecommendation,
    alternativeRecommendations,
    acuteItems,
    documentSections,
    officialLinks,
    contactDraft,
  );

  return {
    evaluation,
    primaryRecommendation,
    alternativeRecommendations,
    acuteItems,
    documentSections,
    officialLinks,
    contactDraft,
    summaryText,
    disclaimers: bundle.disclaimers,
  } satisfies GuideResult;
}
