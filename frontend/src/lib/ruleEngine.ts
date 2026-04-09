import type {
  ActionBucket,
  ActorGuideCard,
  AcuteRule,
  AlternativeAssessment,
  AnswerValue,
  BeforeContactCard,
  CompactGuideCard,
  ConsistencyNote,
  GlossaryTerm,
  GuideContentBundle,
  GuideResult,
  HelpModeCard,
  MatchedAcuteItem,
  MissingInformationItem,
  OfficialLink,
  PhraseTemplate,
  Question,
  RankedRecommendation,
  Recommendation,
  ResultDocumentSection,
  SituationMap,
  SituationScoreLine,
  WhatIfScenario,
  WizardSession,
  WizardEvaluation,
} from "./types";

function normalizeAnswerValue(value: AnswerValue | undefined) {
  if (Array.isArray(value)) {
    return value;
  }

  return typeof value === "string" && value ? [value] : [];
}

function uniqueStrings(items: string[]) {
  return [...new Set(items.filter(Boolean))];
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

  return links.sort((left, right) => {
    const leftPriority = left.priority ?? 99;
    const rightPriority = right.priority ?? 99;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.publisher.localeCompare(right.publisher, "nb-NO");
  });
}

function buildReasons(recommendation: Recommendation, rationaleIds: string[]) {
  return rationaleIds
    .map((rationaleId) => recommendation.rationaleMap[rationaleId])
    .filter((reason): reason is string => Boolean(reason));
}

function addFlagSource(flagSources: Map<string, Set<string>>, flag: string, fact: string) {
  const existing = flagSources.get(flag) ?? new Set<string>();
  existing.add(fact);
  flagSources.set(flag, existing);
}

export function evaluateWizard(bundle: GuideContentBundle, answers: Record<string, AnswerValue>) {
  const flags = new Set<string>();
  const scores = new Map<string, number>();
  const rationaleMap = new Map<string, Set<string>>();
  const flagSources = new Map<string, Set<string>>();
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

    const fact = `${question.title}: ${selectedOptions.map((option) => option.label).join(", ")}`;
    answeredFacts.push(fact);

    selectedOptions.forEach((option) => {
      (option.effects.flags ?? []).forEach((flag) => {
        flags.add(flag);
        addFlagSource(flagSources, flag, fact);
      });

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
    flagSources: Object.fromEntries([...flagSources.entries()].map(([key, value]) => [key, [...value]])),
  } satisfies WizardEvaluation;
}

const questionFallbackReasons: Record<string, string> = {
  start_situation: "Veiviseren starter med livssituasjonen din, ikke med navnet på en ordning.",
  unclear_focus: "Dette gjør resten av veiviseren kortere og mer relevant for det du faktisk trenger hjelp til.",
  acute_now: "Veiviseren sjekker om noe må prioriteres foran resten før den bygger et mer langsiktig løp.",
  help_applies_to: "Det er viktig å vite om behovet gjelder deg selv, et barn eller andre du har ansvar for.",
  work_relation: "Svaret påvirker om veiviseren bør tenke mer på inntektssikring, oppfølging eller mer langsiktig arbeidshjelp.",
  health_capacity: "Svaret brukes til å skille mellom helseoppfølging, dokumentasjon og ytelser knyttet til arbeidsevne.",
  support_needs: "Svaret gjør støtte-, omsorgs- og tilretteleggingsløpet mer konkret og mindre generelt.",
  support_acute_now: "Veiviseren sjekker om støttebehovet må avklares raskt før resten av løpet.",
  income_level: "Økonomien akkurat nå påvirker om akutt hjelp, inntektssikring eller mer langsiktige spor bør prioriteres.",
  household_situation: "Husholdning, barn og bosituasjon kan endre hvilke støtteordninger som er mest relevante.",
  child_household_detail: "Barnas faktiske bosituasjon og omsorgsordning kan påvirke både dokumentasjon og hvilke spor som bør undersøkes.",
  child_support_focus: "Dette gjør barne- og foresattsporet mer presist ved å skille mellom skole, avlastning, hjelp hjemme og langvarig omsorg.",
  household_finances: "Veiviseren trenger å vite om husholdningen samlet sett klarer seg, eller om flere er avhengige av den samme inntekten.",
  household_extra_factors: "Dette fanger opp delt omsorg, ekstra behov hos barn og andre husholdningsforhold som kan endre vurderingen.",
  housing_context_first: "Dette klargjør om problemet handler om akutt bolig, fare for å miste bolig eller mer varig press på boutgiftene.",
  debt_context_first: "Dette skiller mellom akutt betalingspress og mer håndterbare gjeldsproblemer.",
  housing_now: "Boligsituasjonen påvirker om akutt hjelp, boutgiftsstøtte eller annen oppfølging bør løftes høyere.",
  debt_pressure: "Betalingspresset påvirker hvor raskt økonomi- og gjeldsrådgivning bør inn i løpet.",
  existing_followup: "Dette viser om du trenger å starte på nytt, følge opp noe som allerede finnes eller få hjelp til å forstå det som er i gang.",
  young_first_contact_context: "Dette spørsmålet gjør førstegangskontakten mindre overveldende og hjelper veiviseren å sortere mellom arbeid, økonomi, bolig og ren veiledning.",
  municipal_support_focus: "Dette gjør den kommunale delen mer presis ved å skille mellom praktisk bistand, avlastning, lavterskel helse og koordinering.",
  family_safety_context: "Dette gjør familie-, trygghets- og barnesporet mer presist ved å skille mellom krise, bekymring for barn, konflikt, psykisk helse og klagebehov.",
  letter_decision_context: "Dette gjør brevet eller vedtaket mer konkret, slik at veiviseren lettere kan prioritere frist, klage og riktig første kontakt.",
  decision_timeline: "Brevdato og frister kan avgjøre om du må handle raskt eller om saken først og fremst trenger bedre oversikt.",
  follow_up_need: "Dette siste spørsmålet gjør resultatet mer handlingsrettet og lettere å bruke i møte med riktig instans.",
};

export function buildQuestionReason(question: Question, evaluation: WizardEvaluation) {
  const reasonSources = [
    ...(question.whyPrompt ? [question.whyPrompt] : []),
    ...(question.showWhenAnyFlags ?? []).flatMap((flag) => evaluation.flagSources[flag] ?? []),
    ...(question.showWhenAllFlags ?? []).flatMap((flag) => evaluation.flagSources[flag] ?? []),
  ];

  const uniqueReasons = uniqueStrings(reasonSources).slice(0, 3);

  if (uniqueReasons.length > 0) {
    return uniqueReasons;
  }

  const fallback = questionFallbackReasons[question.id];
  return fallback ? [fallback] : ["Dette spørsmålet gjør resten av veiviseren mer presis."];
}

function buildAnswerLabel(question: Question, answerValue: AnswerValue | undefined) {
  const selectedOptions = getSelectedOptions(question, answerValue);
  return selectedOptions.map((option) => option.label).join(", ");
}

const actorGuideMeta: Record<
  OfficialLink["group"],
  {
    title: string;
    description: string;
  }
> = {
  NAV: {
    title: "NAV",
    description: "NAV vurderer ytelser, oppfølging, kontaktspor og flere av de formelle løpene i resultatet.",
  },
  kommune: {
    title: "Kommune",
    description: "Kommunen vurderer blant annet akutt bolig, praktisk støtte, avlastning og andre kommunale tjenester.",
  },
  Husbanken: {
    title: "Husbanken",
    description: "Husbanken og kommunen kan være viktige når boutgifter eller mer varige boligspor må vurderes.",
  },
  helse: {
    title: "Helse",
    description: "Helse må ofte inn før andre rettigheter kan vurderes godt nok, særlig ved funksjon, dokumentasjon eller akutt belastning.",
  },
  skole: {
    title: "Skole og skolehelse",
    description: "Skole, barnehage og skolehelsetjeneste kan beskrive fravær, læringssituasjon og behov for tilrettelegging eller koordinering.",
  },
  rettshjelp: {
    title: "Klage og rettshjelp",
    description: "Klage- og rettshjelpsspor er nyttige når du må forstå brev, frister, begrunnelser eller uenighet i en sak.",
  },
  krise: {
    title: "Krise og trygghet",
    description: "Krise- og trygghetsspor bør komme først når vold, kontroll, alvorlig utrygghet eller akutt behov for beskyttelse er en del av situasjonen.",
  },
  familie: {
    title: "Familie og foreldrestøtte",
    description: "Familievern og foreldrestøtte kan være riktig når konflikt, samlivsbrudd eller samarbeid rundt barn må ryddes på en tryggere måte.",
  },
  barnevern: {
    title: "Barnevern og barnets trygghet",
    description: "Barnevern og hjelpetiltak kan være relevant når du er bekymret for barnets omsorgssituasjon, trygghet eller utvikling.",
  },
};

const glossaryCatalog: Array<{
  id: string;
  title: string;
  description: string;
  recommendationIds?: string[];
  groups?: OfficialLink["group"][];
  flags?: string[];
}> = [
  {
    id: "vedtak",
    title: "Vedtak",
    description: "Et skriftlig svar der en offentlig instans avgjør noe i saken din. Det er ofte dette du må forholde deg til ved klage eller videre oppfølging.",
    flags: ["has_existing_decision", "letter_start"],
  },
  {
    id: "klagefrist",
    title: "Klagefrist",
    description: "Tidsfristen du må forholde deg til hvis du vil klage eller be om ny vurdering. Fristen løper som regel selv om du ber noen hjelpe deg.",
    flags: ["deadline_running"],
  },
  {
    id: "okonomisk_sosialhjelp",
    title: "Økonomisk sosialhjelp",
    description: "En behovsprøvd støtte som NAV-kontoret vurderer konkret når du ikke klarer nødvendige utgifter som mat, strøm eller husleie.",
    recommendationIds: ["okonomisk_sosialhjelp"],
  },
  {
    id: "aap",
    title: "AAP",
    description: "Arbeidsavklaringspenger kan være aktuelt når helse begrenser arbeidsevnen over tid og NAV må vurdere videre løp mot arbeid eller aktivitet.",
    recommendationIds: ["aap"],
  },
  {
    id: "bostotte",
    title: "Bostøtte",
    description: "En støtte til boutgifter som vurderes ut fra blant annet inntekt, boutgifter og husholdning.",
    recommendationIds: ["bostotte"],
  },
  {
    id: "dagpenger",
    title: "Dagpenger",
    description: "En ytelse for deg som har mistet arbeid eller fått redusert arbeidstid og må få inntektssikring mens du søker arbeid.",
    recommendationIds: ["dagpenger"],
  },
  {
    id: "hjelpemidler",
    title: "Hjelpemidler og tilrettelegging",
    description: "Tiltak eller utstyr som gjør hverdagen, skolen, arbeid eller aktivitet mer mulig å gjennomføre i praksis.",
    recommendationIds: ["hjelpemidler_tilrettelegging"],
    flags: ["assistive_need", "home_assistive_need"],
  },
  {
    id: "avlastning",
    title: "Avlastning",
    description: "Kommunal støtte som kan gi familien eller omsorgspersoner avlastning når omsorgsbelastningen over tid blir for stor å bære alene.",
    flags: ["needs_relief_support", "family_coordination_overload", "ongoing_care_need"],
    groups: ["kommune"],
  },
  {
    id: "hjelpestonad",
    title: "Hjelpestønad",
    description: "En ytelse som kan være aktuell når tilsyn, pleie eller særskilt omsorg over tid er mer omfattende enn normalt.",
    recommendationIds: ["hjelpestonad"],
  },
  {
    id: "pleiepenger",
    title: "Pleiepenger",
    description: "Kan være aktuelt når omsorg for sykt barn gjør at du må være borte fra arbeid eller aktivitet.",
    recommendationIds: ["pleiepenger_barn"],
  },
  {
    id: "opplaeringspenger",
    title: "Opplæringspenger",
    description: "Kan være aktuelt når du trenger nødvendig opplæring for å kunne ta deg av barnet ditt eller den du har omsorg for.",
    recommendationIds: ["opplaeringspenger"],
  },
  {
    id: "skolehelsetjeneste",
    title: "Skolehelsetjeneste",
    description: "En kommunal helsetjeneste i skolen som kan være et lavterskel kontaktpunkt når fravær, belastning, trivsel eller funksjon må beskrives bedre.",
    flags: ["school_absence_concern", "school_adaptation_need"],
    groups: ["skole", "helse"],
  },
  {
    id: "samordnet_oppfolging",
    title: "Samordnet oppfølging",
    description: "Når flere instanser må forstå situasjonen samtidig, handler dette om å få tydeligere ansvar, rekkefølge og felles retning.",
    recommendationIds: ["samordnet_barneoppfolging"],
    flags: ["needs_service_coordination", "child_multiple_services", "child_needs_coordinated_plan"],
  },
  {
    id: "krisesenter",
    title: "Krisehjelp og beskyttelse",
    description: "Krisehjelp handler om trygghet først. Hvis vold, kontroll eller alvorlig utrygghet er en del av situasjonen, bør du bruke akutt hjelpeapparat før andre spor.",
    recommendationIds: ["krise_trygghet_vold"],
    groups: ["krise"],
  },
  {
    id: "familievern",
    title: "Familievern",
    description: "Familievernet gir samtaler og hjelp når konflikt, samlivsbrudd eller samarbeid rundt barn har låst seg og trenger roligere støtte.",
    recommendationIds: ["familie_og_foreldrestotte"],
    groups: ["familie"],
  },
  {
    id: "barnevern",
    title: "Barnevern og hjelpetiltak",
    description: "Barnevernet kan gi hjelpetiltak og oppfølging når barnets omsorgssituasjon, trygghet eller utvikling gir grunn til bekymring.",
    recommendationIds: ["barnevern_hjelpetiltak"],
    groups: ["barnevern"],
  },
  {
    id: "bup",
    title: "BUP og psykisk helsehjelp for barn og unge",
    description: "BUP og kommunale tjenester kan være aktuelle når barn eller unge strever psykisk og situasjonen går ut over fungering hjemme, på skolen eller i hverdagen.",
    recommendationIds: ["barn_og_unge_psykisk_helse"],
    flags: ["child_youth_mental_health"],
    groups: ["helse", "skole"],
  },
  {
    id: "pasient_og_brukerombud",
    title: "Pasient- og brukerombud",
    description: "Ombudet kan hjelpe deg å forstå rettigheter, klage og videre oppfølging når saken gjelder helse- eller omsorgstjenester.",
    recommendationIds: ["kommunal_klage_ombud"],
    groups: ["rettshjelp"],
  },
  {
    id: "karriereveiledning",
    title: "Karriereveiledning",
    description: "Karriereveiledning kan være et trygt første steg for unge eller andre som trenger hjelp til å sortere skole, arbeid og neste retning.",
    flags: ["young_adult", "transition_support"],
    groups: ["skole"],
  },
];

const whatIfQuestionIds = [
  "acute_now",
  "support_acute_now",
  "decision_timeline",
  "income_level",
  "housing_context_first",
  "debt_context_first",
  "child_household_detail",
  "household_finances",
  "young_first_contact_context",
  "family_safety_context",
] as const;

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

function buildRecommendationBuckets(
  primaryRecommendation: RankedRecommendation,
  rankedRecommendations: RankedRecommendation[],
  acuteItems: MatchedAcuteItem[],
) {
  const acuteRecommendedIds = new Set(acuteItems.flatMap((item) => item.rule.recommendedIds));
  const parallelRecommendations: RankedRecommendation[] = [];
  const supportRecommendations: RankedRecommendation[] = [];

  rankedRecommendations.slice(1, 7).forEach((item) => {
    const shouldBeParallel =
      acuteRecommendedIds.has(item.recommendation.id) ||
      item.score >= Math.max(primaryRecommendation.score - 2, item.recommendation.minScore) ||
      (item.recommendation.owner !== primaryRecommendation.recommendation.owner &&
        item.score >= Math.max(primaryRecommendation.score - 3, item.recommendation.minScore));

    if (shouldBeParallel && parallelRecommendations.length < 3) {
      parallelRecommendations.push(item);
      return;
    }

    if (supportRecommendations.length < 3) {
      supportRecommendations.push(item);
    }
  });

  return {
    parallelRecommendations,
    supportRecommendations,
  };
}

function recommendationNeedsMoreDocumentation(recommendationId: string, evaluation: WizardEvaluation) {
  const flags = new Set(evaluation.flags);

  switch (recommendationId) {
    case "dagpenger":
      return !flags.has("job_loss") && !flags.has("permittert") && !flags.has("unemployed_after_job");
    case "aap":
      return !flags.has("has_medical_followup");
    case "bostotte":
      return !flags.has("housing_cost_pressure") && !flags.has("housing_notice");
    case "samordnet_barneoppfolging":
      return !flags.has("child_multiple_services") && !flags.has("child_home_school_health") && !flags.has("child_needs_coordinated_plan");
    case "grunnstonad":
    case "hjelpestonad":
    case "pleiepenger_barn":
    case "opplaeringspenger":
      return !flags.has("has_medical_followup") && !flags.has("child_extra_needs_costs");
    case "krise_trygghet_vold":
      return !flags.has("urgent_unsafe_home") && !flags.has("needs_crisis_support");
    case "familie_og_foreldrestotte":
      return !flags.has("family_conflict_support") && !flags.has("has_child_contact_issue");
    case "barnevern_hjelpetiltak":
      return !flags.has("child_welfare_concern");
    case "barn_og_unge_psykisk_helse":
      return !flags.has("child_youth_mental_health");
    case "kommunal_klage_ombud":
      return !flags.has("needs_health_service_complaint") && !flags.has("has_existing_decision");
    case "karriereveiledning_ungdom":
      return !flags.has("young_adult") && !flags.has("transition_support") && !flags.has("first_public_contact");
    case "juridisk_veiledning":
      return !flags.has("has_existing_decision") && !flags.has("deadline_running") && !flags.has("needs_help_with_forms");
    default:
      return false;
  }
}

function buildAlternativeAssessments(
  primaryRecommendation: RankedRecommendation,
  alternativeRecommendations: RankedRecommendation[],
  acuteItems: MatchedAcuteItem[],
  evaluation: WizardEvaluation,
) {
  const acuteRecommendedIds = new Set(acuteItems.flatMap((item) => item.rule.recommendedIds));

  return alternativeRecommendations.slice(0, 4).map((item) => {
    const whyStillRelevant = item.reasons.length
      ? item.reasons.slice(0, 2)
      : [`${item.recommendation.title} kan fortsatt være relevant når situasjonen din blir vurdert mer konkret.`];

    const whyNotHigher = uniqueStrings([
      acuteItems.length > 0 && !acuteRecommendedIds.has(item.recommendation.id)
        ? "Veiviseren prioriterer mer akutte eller grunnleggende forhold foran dette sporet akkurat nå."
        : "",
      primaryRecommendation.score - item.score >= 3 ? "Svarene dine ga foreløpig tydeligere treff på hovedsporet." : "",
      recommendationNeedsMoreDocumentation(item.recommendation.id, evaluation)
        ? "Dette sporet trenger mer dokumentasjon eller en tydeligere avklaring før det kan løftes høyere."
        : "",
      item.recommendation.category === "tjeneste" && primaryRecommendation.recommendation.category === "ytelse"
        ? "Veiviseren løfter først sporet som ser mest kritisk ut for økonomi, bolig eller andre grunnbehov."
        : "",
      item.recommendation.category === "ytelse" && primaryRecommendation.recommendation.category !== "ytelse"
        ? "Dette ser mulig ut, men veiviseren mener først at du trenger avklaring, oppfølging eller dokumentasjon rundt situasjonen."
        : "",
    ]).slice(0, 2);

    return {
      recommendation: item,
      whyStillRelevant,
      whyNotHigher: whyNotHigher.length
        ? whyNotHigher
        : ["Dette ser foreløpig svakere ut enn hovedsporet, men kan fortsatt være relevant som parallelt eller senere løp."],
    } satisfies AlternativeAssessment;
  });
}

function buildContextOfficialLinkIds(evaluation: WizardEvaluation) {
  const flags = new Set(evaluation.flags);
  const extraLinkIds: string[] = [];

  if (flags.has("urgent_unsafe_home") || flags.has("needs_crisis_support")) {
    extraLinkIds.push("krise_trygghet", "alarmtelefon_barn");
  }

  if (flags.has("family_conflict_support") || flags.has("has_child_contact_issue")) {
    extraLinkIds.push("familievern");
  }

  if (flags.has("child_welfare_concern")) {
    extraLinkIds.push("barnevern", "alarmtelefon_barn");
  }

  if (flags.has("child_youth_mental_health")) {
    extraLinkIds.push("barn_unge_psykisk_helse", "skolehelsetjeneste");
  }

  if (flags.has("needs_health_service_complaint")) {
    extraLinkIds.push("pasient_brukerombud", "statsforvalteren_klage");
  }

  if (flags.has("young_adult") || flags.has("transition_support")) {
    extraLinkIds.push("karriereveiledning");
  }

  if (flags.has("needs_relief_support") || flags.has("family_coordination_overload") || flags.has("ongoing_care_need")) {
    extraLinkIds.push("avlastning");
  }

  if (flags.has("school_absence_concern") || flags.has("school_adaptation_need") || flags.has("child_home_school_health")) {
    extraLinkIds.push("skolehelsetjeneste");
  }

  if (flags.has("school_absence_concern")) {
    extraLinkIds.push("skolefravar");
  }

  if (flags.has("deadline_running") || flags.has("has_existing_decision")) {
    extraLinkIds.push("klage_nav");
  }

  if (flags.has("municipal_practical_help")) {
    extraLinkIds.push("praktisk_bistand");
  }

  if (flags.has("municipal_low_threshold_health")) {
    extraLinkIds.push("kommunal_psykisk_helse");
  }

  return uniqueStrings(extraLinkIds);
}

function buildStrengthMeta(score: number, maxScore: number) {
  const rawPercent = Math.round((score / Math.max(maxScore, 1)) * 100);
  const strengthPercent = Math.max(24, Math.min(100, rawPercent));
  const strengthLabel = strengthPercent >= 76 ? "sterk" : strengthPercent >= 52 ? "middels" : "svak";

  return {
    strengthPercent,
    strengthLabel,
  } satisfies Pick<SituationScoreLine, "strengthPercent" | "strengthLabel">;
}

function buildSituationMap(
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  alternativeAssessments: AlternativeAssessment[],
) {
  const keyFacts = uniqueStrings([
    ...(evaluation.rationaleMap[primaryRecommendation.recommendation.id] ?? []).flatMap(
      (rationaleId) => evaluation.flagSources[rationaleId] ?? [],
    ),
    ...primaryRecommendation.reasons,
    ...evaluation.answeredFacts,
  ]).slice(0, 5);

  const highestScore = Math.max(
    primaryRecommendation.score,
    ...alternativeAssessments.map((item) => item.recommendation.score),
  );
  const primaryPullsUp = primaryRecommendation.reasons.length
    ? primaryRecommendation.reasons.slice(0, 3)
    : ["Dette ser foreløpig ut som det tryggeste stedet å starte videre avklaring."];
  const primaryPullsDown = uniqueStrings([
    evaluation.answeredFacts.some((fact) => fact.includes("Vet ikke"))
      ? "Flere svar er fortsatt uklare og kan endre hvilken retning som blir sterkest."
      : "",
    recommendationNeedsMoreDocumentation(primaryRecommendation.recommendation.id, evaluation)
      ? "Dette sporet trenger mer dokumentasjon før det står like sterkt i en konkret vurdering."
      : "",
    alternativeAssessments.length > 0
      ? "Andre spor er fortsatt relevante og kan løftes høyere hvis nye opplysninger kommer inn."
      : "",
  ]).slice(0, 2);

  const scoreLines: SituationScoreLine[] = [
    {
      title: primaryRecommendation.recommendation.title,
      score: primaryRecommendation.score,
      tone: "primary",
      explanation: [...primaryPullsUp.slice(0, 2), ...primaryPullsDown.slice(0, 1)],
      pullsUp: primaryPullsUp,
      pullsDown: primaryPullsDown,
      ...buildStrengthMeta(primaryRecommendation.score, highestScore),
    },
    ...alternativeAssessments.slice(0, 3).map((item) => ({
      title: item.recommendation.recommendation.title,
      score: item.recommendation.score,
      tone: "alternative" as const,
      explanation: [...item.whyStillRelevant, ...item.whyNotHigher].slice(0, 2),
      pullsUp: item.whyStillRelevant,
      pullsDown: item.whyNotHigher,
      ...buildStrengthMeta(item.recommendation.score, highestScore),
    })),
  ];

  return {
    keyFacts: keyFacts.length ? keyFacts : evaluation.answeredFacts.slice(0, 5),
    scoreLines,
  } satisfies SituationMap;
}

function buildActorGuidance(officialLinks: OfficialLink[]) {
  const groupedLinks = officialLinks.reduce<Record<string, OfficialLink[]>>((accumulator, link) => {
    const existing = accumulator[link.group] ?? [];
    existing.push(link);
    accumulator[link.group] = existing;
    return accumulator;
  }, {});

  const orderedGroups: OfficialLink["group"][] = [
    "krise",
    "familie",
    "barnevern",
    "NAV",
    "kommune",
    "Husbanken",
    "helse",
    "skole",
    "rettshjelp",
  ];

  return orderedGroups
    .filter((group) => groupedLinks[group]?.length)
    .map((group) => {
      const links = groupedLinks[group];
      return {
        group,
        title: actorGuideMeta[group].title,
        description: actorGuideMeta[group].description,
        items: uniqueStrings(links.flatMap((link) => [link.actionLabel, link.whenRelevant ?? ""])).slice(0, 4),
      } satisfies ActorGuideCard;
    });
}

function buildGlossaryTerms(
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  officialLinks: OfficialLink[],
  parallelRecommendations: RankedRecommendation[],
) {
  const recommendationIds = new Set([
    primaryRecommendation.recommendation.id,
    ...parallelRecommendations.map((item) => item.recommendation.id),
  ]);
  const groups = new Set(officialLinks.map((link) => link.group));
  const flags = new Set(evaluation.flags);

  return glossaryCatalog
    .filter((term) => {
      const matchesRecommendation =
        !term.recommendationIds || term.recommendationIds.some((recommendationId) => recommendationIds.has(recommendationId));
      const matchesGroup = !term.groups || term.groups.some((group) => groups.has(group));
      const matchesFlag = !term.flags || term.flags.some((flag) => flags.has(flag));

      return matchesRecommendation && matchesGroup && matchesFlag;
    })
    .slice(0, 8)
    .map(
      (term) =>
        ({
          id: term.id,
          title: term.title,
          description: term.description,
        }) satisfies GlossaryTerm,
    );
}

function buildWhatIfScenarios(
  bundle: GuideContentBundle,
  answers: Record<string, AnswerValue>,
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  acuteItems: MatchedAcuteItem[],
) {
  const currentAcuteTitle = acuteItems[0]?.rule.title;

  return whatIfQuestionIds
    .map((questionId) => evaluation.visibleQuestions.find((question) => question.id === questionId))
    .filter((question): question is Question => question != null && question.selectionMode === "single")
    .slice(0, 5)
    .map((question) => {
      const currentAnswer = answers[question.id];
      if (typeof currentAnswer !== "string") {
        return null;
      }

      const alternativeOption = question.options.find((option) => {
        if (option.id === currentAnswer) {
          return false;
        }

        const nextAnswers = {
          ...answers,
          [question.id]: option.id,
        };
        const nextEvaluation = evaluateWizard(bundle, nextAnswers);
        const nextPrimary = rankRecommendations(bundle, nextEvaluation)[0];
        const nextAcuteTitle = buildAcuteItems(bundle, nextEvaluation)[0]?.rule.title;

        return nextPrimary.recommendation.id !== primaryRecommendation.recommendation.id || nextAcuteTitle !== currentAcuteTitle;
      });

      if (!alternativeOption) {
        return null;
      }

      const nextAnswers = {
        ...answers,
        [question.id]: alternativeOption.id,
      };
      const nextEvaluation = evaluateWizard(bundle, nextAnswers);
      const nextPrimary = rankRecommendations(bundle, nextEvaluation)[0];
      const nextAcuteTitle = buildAcuteItems(bundle, nextEvaluation)[0]?.rule.title;
      const nextOfficialLinks = collectOfficialLinks(bundle, [
        ...nextPrimary.recommendation.officialLinkIds,
        ...buildContextOfficialLinkIds(nextEvaluation),
      ]);
      const currentAnswerLabel = buildAnswerLabel(question, currentAnswer);

      return {
        questionId: question.id,
        questionTitle: question.title,
        currentAnswer: currentAnswerLabel,
        alternativeAnswer: alternativeOption.label,
        resultingRecommendation: nextPrimary.recommendation.title,
        resultingSummary: nextPrimary.recommendation.summary,
        resultingContact:
          nextOfficialLinks[0]?.actionLabel ??
          `Start med ${nextPrimary.recommendation.title.toLowerCase()} og be om konkret veiledning.`,
        summary:
          nextAcuteTitle && nextAcuteTitle !== currentAcuteTitle
            ? `Hvis dette i stedet var «${alternativeOption.label}», ville akuttprioriteten først blitt «${nextAcuteTitle}».`
            : `Hvis dette i stedet var «${alternativeOption.label}», ville hovedsporet blitt «${nextPrimary.recommendation.title}».`,
      } satisfies WhatIfScenario;
    })
    .filter((item): item is WhatIfScenario => Boolean(item))
    .slice(0, 3);
}

function buildHelpModeCards(
  primaryRecommendation: RankedRecommendation,
  parallelRecommendations: RankedRecommendation[],
  supportRecommendations: RankedRecommendation[],
  acuteItems: MatchedAcuteItem[],
) {
  const allRecommendations = [primaryRecommendation, ...parallelRecommendations, ...supportRecommendations];
  const uniqueRecommendations = [...new Map(allRecommendations.map((item) => [item.recommendation.id, item])).values()];
  const cards: HelpModeCard[] = [];

  if (acuteItems.length > 0) {
    cards.push({
      id: "emergency",
      title: "Nødhjelp og hasteforhold",
      description: "Dette er ikke langsiktig rettighetsvurdering. Det handler om hva som må tas først for at situasjonen skal være forsvarlig nå.",
      tone: "warning",
      items: acuteItems.map((item) => item.rule.title).slice(0, 3),
    });
  }

  const rights = uniqueRecommendations.filter((item) => item.recommendation.category === "ytelse").map((item) => item.recommendation.title);
  if (rights.length > 0) {
    cards.push({
      id: "rights",
      title: "Rettigheter og ytelser",
      description: "Dette er ordninger eller økonomiske løp som må vurderes konkret av offentlig instans.",
      tone: "fact",
      items: rights.slice(0, 3),
    });
  }

  const practical = uniqueRecommendations
    .filter((item) => item.recommendation.category === "hjelpetiltak")
    .map((item) => item.recommendation.title);
  if (practical.length > 0) {
    cards.push({
      id: "practical",
      title: "Praktisk hjelp og tilrettelegging",
      description: "Dette er spor der målet er å få hverdagen, boligen, omsorgen eller tilretteleggingen til å fungere bedre i praksis.",
      tone: "neutral",
      items: practical.slice(0, 3),
    });
  }

  const guidance = uniqueRecommendations
    .filter((item) => item.recommendation.category === "tjeneste")
    .map((item) => item.recommendation.title);
  cards.push({
    id: "guidance",
    title: "Veiledning og oppfølging",
    description: "Dette er spor der du kan be om avklaring, koordinering, oppfølging eller hjelp til å forstå hva som bør skje videre.",
    tone: cards.length === 0 ? "fact" : "neutral",
    items: guidance.length ? guidance.slice(0, 3) : [`Start med ${primaryRecommendation.recommendation.title} og bruk første kontaktpunkt for å få konkret veiledning.`],
  });

  return cards;
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
    `Jeg ønsker veiledning om ${primaryRecommendation.recommendation.title.toLowerCase()} og hva som er riktig første kontakt videre.`,
  ];

  if (acuteItems[0]) {
    lines.push(`Det som haster mest for meg nå er: ${acuteItems[0].rule.title.toLowerCase()}.`, "");
  }

  lines.push(
    `Det virker som situasjonen min kan berøre ${primaryRecommendation.recommendation.owner}, og jeg trenger hjelp til å forstå hva som bør avklares først.`,
    "",
  );

  lines.push("Kort oppsummering av situasjonen min:", ...evaluation.answeredFacts.slice(0, 6).map((fact) => `- ${fact}`), "");

  if (phraseTemplate) {
    lines.push(phraseTemplate.content, "");
  }

  lines.push(
    "Kan dere veilede meg om hva jeg bør gjøre først, hvem som er riktig instans videre, og hvilken dokumentasjon dere trenger fra meg?",
    "",
    "Vennlig hilsen",
  );

  return lines.join("\n");
}

function buildAskForList(
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  acuteItems: MatchedAcuteItem[],
  parallelRecommendations: RankedRecommendation[],
) {
  const askForList = [
    "Be om en konkret vurdering av situasjonen din, ikke bare generell informasjon.",
    "Be om å få vite hva som bør gjøres først, og hvilken dokumentasjon som eventuelt mangler.",
  ];

  if (acuteItems.length > 0) {
    askForList.push(`Be om at det som haster mest blir vurdert først: ${acuteItems[0].rule.title.toLowerCase()}.`);
  }

  switch (primaryRecommendation.recommendation.id) {
    case "krise_trygghet_vold":
      askForList.push("Be om at trygghet og beskyttelse blir vurdert først, før andre spørsmål i saken.");
      askForList.push("Be om konkret hjelp til hvem du skal kontakte nå, og hvordan du kan holde barn og voksne trygge de neste dagene.");
      break;
    case "familie_og_foreldrestotte":
      askForList.push("Be om hjelp til å rydde i konflikt, samarbeid eller kommunikasjon, ikke bare en generell samtale om at situasjonen er vanskelig.");
      askForList.push("Be om å få vite hvilket kontaktpunkt som passer best når barn, samlivsbrudd eller foreldresamarbeid er en del av saken.");
      break;
    case "barnevern_hjelpetiltak":
      askForList.push("Be om å få vite hva som kan gjøres nå for å gjøre situasjonen tryggere og mer forutsigbar for barnet.");
      askForList.push("Be om en konkret forklaring på hvilke hjelpetiltak eller videre vurderinger som kan være aktuelle.");
      break;
    case "barn_og_unge_psykisk_helse":
      askForList.push("Be om hjelp til å avklare om fastlege, skolehelsetjeneste, kommune eller BUP bør kobles inn først.");
      askForList.push("Be om at belastning, fungering og endringer hjemme eller på skolen blir beskrevet konkret.");
      break;
    case "karriereveiledning_ungdom":
      askForList.push("Be om hjelp til å sortere hva som er riktig første steg mellom skole, arbeid, NAV og andre hjelpetjenester.");
      askForList.push("Be om en enkel plan for hva du bør gjøre først denne uken, og hvem som har ansvar videre.");
      break;
    case "kommunal_klage_ombud":
      askForList.push("Be om å få vite om ombud, ny henvendelse eller formell klage er det tryggeste neste steget i saken.");
      askForList.push("Be om en tydelig oversikt over frister, hva klagen bør handle om, og hvilke dokumenter som bør legges ved.");
      break;
    case "okonomisk_sosialhjelp":
      askForList.push("Be om vurdering av økonomisk sosialhjelp til nødvendige utgifter og om noe kan behandles raskt.");
      askForList.push("Be om å få vite hvilke utgifter NAV mener er viktigst å dokumentere først.");
      break;
    case "midlertidig_botilbud":
      askForList.push("Be om vurdering av akutt boligbehov og om midlertidig botilbud dersom du ikke har et forsvarlig sted å være.");
      askForList.push("Be om tydelig beskjed om hva kommunen eller NAV trenger for å behandle situasjonen raskt.");
      break;
    case "dagpenger":
      askForList.push("Be om avklaring på om dagpenger ser ut til å være riktig løp, og om det er noe du må gjøre med en gang.");
      askForList.push("Be om en konkret oversikt over hvilke opplysninger om arbeid, permittering eller inntekt som må på plass.");
      break;
    case "aap":
      askForList.push("Be om avklaring på om arbeidsevnen din bør vurderes nærmere og om AAP kan være aktuelt.");
      askForList.push("Be om å få vite hvilken helse- og aktivitetsdokumentasjon NAV trenger videre.");
      break;
    case "kvalifiseringsprogram":
      askForList.push("Be om vurdering av om du har behov for tett og helhetlig oppfølging over tid.");
      askForList.push("Be om å få vite hvilke aktiviteter eller avklaringer som må være på plass for å vurdere kvalifiseringsprogram.");
      break;
    case "arbeid_oppfolging":
      askForList.push("Be om en tydelig forklaring på hvilket oppfølgingsløp eller hvilke tiltak som kan være aktuelle.");
      askForList.push("Be om å få vite om det bør gjøres en arbeidsevnevurdering eller annen kartlegging.");
      break;
    case "okonomi_gjeld":
      askForList.push("Be om økonomi- og gjeldsrådgivning og hjelp til å prioritere hvilke krav som må håndteres først.");
      askForList.push("Be om hjelp til å lage en enkel oversikt over gjeld, frister og nødvendige utgifter.");
      break;
    case "bostotte":
      askForList.push("Be om å få vite om bostøtte bør undersøkes og om boutgiftene dine er dokumentert godt nok.");
      askForList.push("Be om å få vite om kommunen også bør vurdere andre bolighjelp-spor hvis bostøtte alene ikke er nok.");
      break;
    case "hjelpemidler_tilrettelegging":
      askForList.push("Be om å få vite hvem som bør starte saken: kommune, barnehage, skole eller NAV hjelpemiddelsentral.");
      askForList.push("Be om kartlegging av hva som er vanskelig i hverdagen, og hvilke hjelpemidler eller tilretteleggingstiltak som kan prøves.");
      break;
    case "samordnet_barneoppfolging":
      askForList.push("Be om en tydelig forklaring på hvem som skal koordinere videre og hva som bør tas opp først mellom skole, helse, kommune og NAV.");
      askForList.push("Be om at behovene til barnet blir oppsummert i en konkret liste som kan brukes på tvers av instansene.");
      break;
    case "grunnstonad":
      askForList.push("Be om avklaring på om de løpende ekstrautgiftene dine kan være relevante for grunnstønad.");
      askForList.push("Be om å få vite hvilke utgifter som må dokumenteres over tid for at en vurdering skal være mulig.");
      break;
    case "hjelpestonad":
      askForList.push("Be om avklaring på om behovet for tilsyn, pleie eller praktisk oppfølging kan være relevant for hjelpestønad.");
      askForList.push("Be om å få vite hvordan omsorgsbelastningen bør beskrives og dokumenteres.");
      break;
    case "pleiepenger_barn":
      askForList.push("Be om avklaring på om fravær fra arbeid for å ta hånd om sykt barn kan være relevant for pleiepenger.");
      askForList.push("Be om å få vite hvilken medisinsk dokumentasjon og hvilke opplysninger om omsorgsbehov som trengs.");
      break;
    case "opplaeringspenger":
      askForList.push("Be om avklaring på om nødvendig opplæring for å kunne ta vare på barnet eller den du har omsorg for kan gi rett til opplæringspenger.");
      askForList.push("Be om å få vite hvem som må dokumentere opplæringsbehovet og hvordan det bør sendes inn.");
      break;
    case "helsehjelp_oppfolging":
      askForList.push("Be om hjelp til å avklare om fastlege, kommunal helsetjeneste eller annen behandler bør kobles inn først.");
      askForList.push("Be om at helseopplysninger og funksjon blir beskrevet konkret nok til at videre rettigheter kan vurderes.");
      break;
    case "juridisk_veiledning":
      askForList.push("Be om skriftlig begrunnelse, klagefrist og hva som må være med hvis du vil be om ny vurdering.");
      askForList.push("Be om å få vite om det finnes fri rettshjelp eller annen juridisk veiledning som passer i situasjonen din.");
      break;
    default:
      break;
  }

  if (evaluation.flags.includes("has_existing_decision")) {
    askForList.push("Be om kopi av vedtak eller brev du bygger videre på, og noter frister som allerede løper.");
  }

  if (evaluation.flags.includes("deadline_running")) {
    askForList.push("Be om tydelig beskjed om hvilken frist som gjelder, og om du bør sende noe inn med en gang for å sikre deg.");
  }

  if (evaluation.flags.includes("school_absence_concern")) {
    askForList.push("Be om at fravær, skolebelastning og videre oppfølging blir beskrevet konkret av skole eller skolehelsetjeneste.");
  }

  if (evaluation.flags.includes("needs_relief_support")) {
    askForList.push("Be om at kommunen vurderer avlastning eller annen pårørendestøtte hvis omsorgsbelastningen er blitt for stor.");
  }

  if (evaluation.flags.includes("child_welfare_concern")) {
    askForList.push("Be om tydelig beskjed om hvem som følger opp barnets trygghet videre, og hva som skjer først.");
  }

  if (evaluation.flags.includes("home_assistive_need")) {
    askForList.push("Be om konkret kartlegging av hva som ikke fungerer hjemme, og hvilke hjelpemidler eller praktiske tiltak som kan prøves.");
  }

  if (evaluation.flags.includes("first_public_contact") || evaluation.flags.includes("young_first_contact")) {
    askForList.push("Be om en enkel forklaring på hvem som gjør hva, og hva som er riktig første steg før du får mer detaljerte råd.");
  }

  if (evaluation.flags.includes("no_written_decision")) {
    askForList.push("Be om at videre beskjed eller vurdering blir gitt skriftlig hvis det er mulig, slik at det blir lettere å følge opp senere.");
  }

  if (evaluation.flags.includes("needs_health_service_complaint")) {
    askForList.push("Be om å få vite om saken først bør tas opp med tjenesten, ombudet eller riktig klageinstans.");
  }

  if (parallelRecommendations.length > 0) {
    askForList.push("Be også om å få avklart om ett eller flere av de parallelle sporene bør vurderes samtidig.");
  }

  return uniqueStrings(askForList);
}

export function buildConsistencyNotes(evaluation: WizardEvaluation) {
  const flags = new Set(evaluation.flags);
  const notes: ConsistencyNote[] = [];

  if (flags.has("has_existing_decision") && flags.has("nothing_started")) {
    notes.push({
      title: "Svarene peker i to retninger om hva som allerede er i gang",
      description: "Du har både oppgitt at det finnes vedtak eller brev, og at lite eller ingenting er satt i gang. Dobbeltsjekk hva som faktisk allerede er avklart.",
      tone: "warning",
    });
  }

  if (flags.has("housing_stable") && (flags.has("urgent_housing") || flags.has("no_stable_home") || flags.has("housing_notice"))) {
    notes.push({
      title: "Boligsituasjonen virker uavklart",
      description: "Noen svar peker mot stabil bolig, mens andre peker mot akutt eller nær-akutt boligproblem. Det er lurt å presisere dette før du går videre.",
      tone: "warning",
    });
  }

  if (flags.has("no_debt_issue") && (flags.has("severe_debt_pressure") || flags.has("mounting_debt"))) {
    notes.push({
      title: "Gjeldssituasjonen virker motstridende",
      description: "Du har både oppgitt at gjeld ikke er hovedproblemet og at betalingspresset er høyt. Det kan være lurt å rydde i hva som faktisk haster mest.",
      tone: "warning",
    });
  }

  if (flags.has("health_not_main") && (flags.has("health_blocks_work") || flags.has("urgent_health_or_safety"))) {
    notes.push({
      title: "Helse ser ut til å spille en større rolle enn ett av svarene tilsier",
      description: "Noen svar peker mot at helse ikke er hovedtemaet, mens andre peker mot betydelig helsebelastning eller hast. Det er lurt å tydeliggjøre dette.",
      tone: "warning",
    });
  }

  if (flags.has("deadline_running") && !flags.has("has_existing_decision")) {
    notes.push({
      title: "Frist er nevnt, men brevet er ikke tydelig beskrevet",
      description: "Hvis en frist løper, bør du ha klart hvilket brev eller vedtak fristen gjelder og når du mottok det.",
      tone: "missing",
    });
  }

  if (flags.has("partner_income_or_benefits") && flags.has("household_depends_on_me")) {
    notes.push({
      title: "Husholdningens inntekter bør beskrives tydeligere",
      description: "Du har både oppgitt at andre i husholdningen har inntekt eller ytelser, og at husholdningen i stor grad er avhengig av din støtte. Det er lurt å presisere hvordan økonomien faktisk er fordelt.",
      tone: "warning",
    });
  }

  if (flags.has("first_public_contact") && flags.has("has_existing_decision")) {
    notes.push({
      title: "Dette ser ikke lenger ut som en ren førstegangskontakt",
      description: "Svarene peker både mot førstegangskontakt og mot at det allerede finnes brev eller vedtak. Det er lurt å tydeliggjøre om du trenger ny søknad, videre oppfølging eller klagehjelp.",
      tone: "warning",
    });
  }

  if (flags.has("household_with_children") && !flags.has("children_live_with_me") && !flags.has("shared_custody") && !flags.has("child_housing_unclear")) {
    notes.push({
      title: "Barn i husholdningen er ikke fullt ut avklart",
      description: "Hvis barn er en del av situasjonen, er det nyttig å få fram om de bor fast hos deg, om dere har delt omsorg eller om bosituasjonen er uavklart.",
      tone: "missing",
    });
  }

  return notes;
}

function buildActionBuckets(
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  acuteItems: MatchedAcuteItem[],
  officialLinks: OfficialLink[],
  documentSections: ResultDocumentSection[],
  askForList: string[],
  parallelRecommendations: RankedRecommendation[],
  supportRecommendations: RankedRecommendation[],
  consistencyNotes: ConsistencyNote[],
) {
  const documentTitles = documentSections.slice(0, 2).map((section) => section.title.toLowerCase());
  const documentFocus =
    documentTitles.length === 0
      ? "de viktigste opplysningene om situasjonen din"
      : documentTitles.length === 1
        ? documentTitles[0]
        : `${documentTitles[0]} og ${documentTitles[1]}`;

  const firstContact = officialLinks[0];
  const today = uniqueStrings([
    acuteItems[0] ? `Start med det som haster mest: ${acuteItems[0].rule.title}.` : "",
    firstContact ? `${firstContact.actionLabel}.` : `Start med å avklare ${primaryRecommendation.recommendation.title.toLowerCase()} hos riktig instans.`,
    evaluation.flags.includes("first_public_contact") ? "Skriv ned én kort setning om hva du trenger hjelp til, så første kontakt blir enklere å starte." : "",
    evaluation.flags.includes("deadline_running") ? "Les brevet eller vedtaket på nytt i dag og noter hvilken frist som faktisk løper." : "",
    consistencyNotes[0] ? `Dobbeltsjekk først: ${consistencyNotes[0].title.toLowerCase()}.` : "",
  ]).slice(0, 4);

  const thisWeek = uniqueStrings([
    `Samle først ${documentFocus}.`,
    askForList[0] ?? "",
    askForList[1] ?? "",
    parallelRecommendations[0]
      ? `Be om at også ${parallelRecommendations[0].recommendation.title.toLowerCase()} vurderes parallelt hvis hovedsporet alene ikke er nok.`
      : "",
  ]).slice(0, 4);

  const later = uniqueStrings([
    supportRecommendations[0]
      ? `Undersøk om ${supportRecommendations[0].recommendation.title.toLowerCase()} kan være et nyttig støtteløp senere.`
      : "",
    officialLinks[1] ? `Les også ${officialLinks[1].publisher}-lenken for å forstå vilkår og praktiske steg bedre.` : "",
    "Oppdater oversikten din hvis situasjonen endrer seg, slik at neste kontakt blir mer presis.",
  ]).slice(0, 4);

  const buckets: ActionBucket[] = [
    {
      id: "today",
      title: "Gjør dette i dag",
      tone: "warning",
      items: today.length ? today : [`Start med ${primaryRecommendation.recommendation.title.toLowerCase()} og bruk første kontaktpunkt for å få rask avklaring.`],
    },
    {
      id: "this_week",
      title: "Gjør dette denne uken",
      tone: "fact",
      items: thisWeek.length ? thisWeek : ["Samle dokumentasjon og gjør resultatet klarere før du tar videre kontakt."],
    },
    {
      id: "later",
      title: "Dette kan vente litt",
      tone: "neutral",
      items: later.length ? later : ["Les mer i de offisielle lenkene når det viktigste først er avklart."],
    },
  ];

  return buckets;
}

function buildBeforeContact(
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  acuteItems: MatchedAcuteItem[],
  documentSections: ResultDocumentSection[],
  officialLinks: OfficialLink[],
  askForList: string[],
) {
  const firstContact = officialLinks[0];
  const haveReady = uniqueStrings(documentSections.flatMap((section) => section.items).slice(0, 5));
  const whyNow = uniqueStrings([
    ...(acuteItems[0] ? [`Det som haster mest er: ${acuteItems[0].rule.title}.`] : []),
    ...primaryRecommendation.reasons.slice(0, 2),
  ]);
  const sayThisFirst = uniqueStrings([
    `Jeg trenger veiledning om ${primaryRecommendation.recommendation.title.toLowerCase()}.`,
    acuteItems[0] ? `Det som haster mest for meg nå er ${acuteItems[0].rule.title.toLowerCase()}.` : "",
    "Jeg ønsker å få vite hva som bør gjøres først og hvilken dokumentasjon dere trenger.",
  ]);
  const askFor = askForList.slice(0, 4);
  const contactFirst = firstContact
    ? `${firstContact.actionLabel} (${firstContact.publisher})`
    : `Bruk første relevante kontaktspor for ${primaryRecommendation.recommendation.title.toLowerCase()}`;
  const safeWhyNow = whyNow.length ? whyNow : ["Veiviseren mener dette sporet er det tryggeste stedet å starte videre avklaring."];
  const safeSayThisFirst = sayThisFirst.length ? sayThisFirst : [`Jeg trenger veiledning om ${primaryRecommendation.recommendation.title.toLowerCase()}.`];
  const safeHaveReady = haveReady.length ? haveReady : ["En kort oppsummering av situasjonen din og det som haster mest."];
  const safeAskFor = askFor.length ? askFor : ["Be om en konkret vurdering av hva som bør gjøres først."];

  const copyText = [
    "Før kontakt",
    "",
    `Kontakt først: ${contactFirst}`,
    "",
    "Kort hvorfor dette ser relevant ut:",
    ...safeWhyNow.map((item) => `- ${item}`),
    "",
    "Dette kan du si først:",
    ...safeSayThisFirst.map((item) => `- ${item}`),
    "",
    "Ha dette klart:",
    ...safeHaveReady.map((item) => `- ${item}`),
    "",
    "Det kan være lurt å be om:",
    ...safeAskFor.map((item) => `- ${item}`),
  ].join("\n");

  return {
    contactFirst,
    whyNow: safeWhyNow,
    sayThisFirst: safeSayThisFirst,
    haveReady: safeHaveReady,
    askFor: safeAskFor,
    copyText,
  } satisfies BeforeContactCard;
}

function buildPhoneCard(
  primaryRecommendation: RankedRecommendation,
  actionBuckets: ActionBucket[],
  beforeContact: BeforeContactCard,
  acuteItems: MatchedAcuteItem[],
) {
  const items = [
    `Kontakt først: ${beforeContact.contactFirst}`,
    acuteItems[0]
      ? `Haster mest: ${acuteItems[0].rule.title}`
      : `Haster mest: ${actionBuckets[0]?.items[0] ?? `Start med ${primaryRecommendation.recommendation.title.toLowerCase()}.`}`,
    `Si først: ${beforeContact.sayThisFirst[0] ?? `Jeg trenger veiledning om ${primaryRecommendation.recommendation.title.toLowerCase()}.`}`,
    `Ha klart: ${beforeContact.haveReady[0] ?? "En kort oppsummering av situasjonen din."}`,
  ];

  return {
    title: "Telefonkort",
    intro: "Kortversjon for mobil eller telefonsamtale. Fire linjer som gjør det lettere å starte riktig.",
    items,
    copyText: ["Telefonkort", "", ...items.map((item) => `- ${item}`)].join("\n"),
  } satisfies CompactGuideCard;
}

function buildMeetingCard(
  primaryRecommendation: RankedRecommendation,
  beforeContact: BeforeContactCard,
  askForList: string[],
  documentSections: ResultDocumentSection[],
  consistencyNotes: ConsistencyNote[],
) {
  const items = [
    `Hva saken gjelder: ${primaryRecommendation.recommendation.title}.`,
    `Start med å si: ${beforeContact.sayThisFirst[0] ?? `Jeg trenger veiledning om ${primaryRecommendation.recommendation.title.toLowerCase()}.`}`,
    `Be om: ${askForList[0] ?? "en konkret vurdering av hva som bør gjøres først."}`,
    `Ta med: ${documentSections[0]?.items[0] ?? "en kort oversikt over situasjonen din og det som haster."}`,
    consistencyNotes[0] ? `Dobbeltsjekk: ${consistencyNotes[0].title}.` : "Dobbeltsjekk: noter frister, dokumentasjon og hvem du faktisk har snakket med.",
  ];

  return {
    title: "Ta med til møte",
    intro: "Én side som oppsummerer hva saken gjelder, hva du bør be om og hva du bør ha foran deg i møte eller på telefon.",
    items,
    copyText: ["Ta med til møte", "", ...items.map((item) => `- ${item}`)].join("\n"),
  } satisfies CompactGuideCard;
}

function buildMissingItems(
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  documentSections: ResultDocumentSection[],
  consistencyNotes: ConsistencyNote[],
) {
  const items: MissingInformationItem[] = consistencyNotes.map((note) => ({
    title: note.title,
    description: note.description,
    severity: note.tone === "missing" ? "high" : "medium",
  }));

  const dontKnowCount = evaluation.answeredFacts.filter((fact) => fact.includes("Vet ikke")).length;
  if (dontKnowCount > 0) {
    items.push({
      title: "Noen svar er fortsatt uklare",
      description: `Du har ${dontKnowCount} svar med «Vet ikke». Det gjør hovedretningen mindre sikker og gjør det vanskeligere å vite hva som bør prioriteres først.`,
      severity: dontKnowCount >= 2 ? "high" : "medium",
    });
  }

  const needsMedicalDocumentation = [
    "health_blocks_work",
    "partial_work_capacity",
    "assistive_need",
    "extra_expenses_condition",
    "ongoing_care_need",
    "absence_for_care",
    "municipal_low_threshold_health",
  ].some((flag) => evaluation.flags.includes(flag));
  if (needsMedicalDocumentation && !evaluation.flags.includes("has_medical_followup")) {
    items.push({
      title: "Faglig eller medisinsk dokumentasjon",
      description: "Det ser ut som helse, funksjon eller belastning er en viktig del av situasjonen, men det er ikke tydelig at faglig dokumentasjon allerede er på plass.",
      severity: "high",
    });
  }

  if (
    (evaluation.flags.includes("letter_start") || evaluation.flags.includes("needs_legal_guidance")) &&
    !evaluation.flags.includes("has_existing_decision") &&
    !evaluation.flags.includes("no_written_decision")
  ) {
    items.push({
      title: "Selve brevet eller vedtaket",
      description: "For å forstå frist, begrunnelse og neste steg bør du ha klart hvilket brev saken gjelder og når du mottok det.",
      severity: "high",
    });
  }

  if (
    (evaluation.flags.includes("for_child") || evaluation.flags.includes("caregiver_rights")) &&
    !evaluation.flags.includes("has_school_or_municipal_dialogue") &&
    !evaluation.flags.includes("has_medical_followup")
  ) {
    items.push({
      title: "Beskrivelse fra skole, kommune eller annen faginstans",
      description: "Når barn eller omsorgssituasjon er en viktig del av saken, blir retningen ofte tydeligere hvis en skole, kommune eller fagperson allerede har beskrevet behovet.",
      severity: "medium",
    });
  }

  if (documentSections.length === 0) {
    items.push({
      title: "Grunnleggende dokumentasjon",
      description: `Det er foreløpig lite som peker mot hvilken dokumentasjon som styrker ${primaryRecommendation.recommendation.title.toLowerCase()}.`,
      severity: "medium",
    });
  }

  return items
    .filter((item, index, array) => array.findIndex((candidate) => candidate.title === item.title) === index)
    .sort((left, right) => {
      const severityRank = { high: 0, medium: 1, low: 2 } as const;
      return severityRank[left.severity] - severityRank[right.severity];
    })
    .slice(0, 6);
}

function buildLetterSummaryCard(
  evaluation: WizardEvaluation,
  beforeContact: BeforeContactCard,
  askForList: string[],
  doNotAssumeList: string[],
) {
  if (!evaluation.flags.includes("letter_start") && !evaluation.flags.includes("needs_legal_guidance")) {
    return null;
  }

  const letterType =
    evaluation.answeredFacts.find((fact) => fact.startsWith("Hva slags brev, vedtak eller oppfølging handler det om?")) ??
    "Brevet eller vedtaket er ikke fullt avklart ennå.";
  const letterTiming =
    evaluation.answeredFacts.find((fact) => fact.startsWith("Hva passer best om brev, vedtak eller frister akkurat nå?")) ??
    "Frist eller tidsperspektiv er ikke tydelig avklart ennå.";
  const items = [
    letterType,
    letterTiming,
    `Kontakt først: ${beforeContact.contactFirst}`,
    `Be om: ${askForList[0] ?? "en konkret forklaring på hva du bør gjøre først."}`,
    `Pass på: ${doNotAssumeList.find((item) => item.includes("frist")) ?? "noter datoer og hva brevet faktisk gjelder."}`,
  ];

  return {
    title: "Brevoppsummering",
    intro: "Kort handlingskort for brev, vedtak og frister. Bruk dette før du åpner full oversikt.",
    items,
    copyText: ["Brevoppsummering", "", ...items.map((item) => `- ${item}`)].join("\n"),
  } satisfies CompactGuideCard;
}

function buildYouthGuideCard(
  evaluation: WizardEvaluation,
  beforeContact: BeforeContactCard,
  actorGuidance: ActorGuideCard[],
) {
  if (!evaluation.flags.includes("young_first_contact") && !evaluation.flags.includes("young_adult") && !evaluation.flags.includes("first_public_contact")) {
    return null;
  }

  const actors = actorGuidance
    .slice(0, 2)
    .map((card) => `${card.title}: ${card.items[0] ?? card.description}`)
    .filter(Boolean);
  const items = [
    `Start her: ${beforeContact.contactFirst}`,
    `Si kort: ${beforeContact.sayThisFirst[0] ?? "Jeg trenger hjelp til å forstå hvor jeg skal starte."}`,
    `Ha klart: ${beforeContact.haveReady[0] ?? "en kort forklaring på hva som er vanskelig nå."}`,
    actors[0] ?? "Be om en enkel forklaring på hvem som gjør hva.",
    actors[1] ?? "Be om å få vite hva som er neste konkrete steg.",
  ];

  return {
    title: "For unge",
    intro: "Kortversjon med enklere språk og færre steg når du trenger en trygg førstegangskontakt.",
    items,
    copyText: ["For unge", "", ...items.map((item) => `- ${item}`)].join("\n"),
  } satisfies CompactGuideCard;
}

function buildChildSchoolCard(
  evaluation: WizardEvaluation,
  beforeContact: BeforeContactCard,
  officialLinks: OfficialLink[],
) {
  const needsSchoolCard =
    evaluation.flags.includes("school_absence_concern") ||
    evaluation.flags.includes("school_adaptation_need") ||
    evaluation.flags.includes("child_home_school_health") ||
    evaluation.flags.includes("has_school_or_municipal_dialogue");

  if (!needsSchoolCard) {
    return null;
  }

  const schoolLink =
    officialLinks.find((link) => link.group === "skole") ??
    officialLinks.find((link) => link.group === "kommune") ??
    officialLinks[0];
  const items = [
    `Start med: ${schoolLink ? `${schoolLink.actionLabel} (${schoolLink.publisher})` : beforeContact.contactFirst}`,
    "Si kort at barnet trenger tydelig avklaring rundt skole, belastning eller tilrettelegging.",
    "Be om at behov, fravær eller belastning beskrives konkret og skriftlig.",
    "Spør hvem som tar ansvar for neste møte eller neste oppfølging.",
  ];

  return {
    title: "Barn og skole",
    intro: "Kortversjon for foresatte når skole, PPT, skolehelsetjeneste eller kommunen bør inn tidlig.",
    items,
    copyText: ["Barn og skole", "", ...items.map((item) => `- ${item}`)].join("\n"),
  } satisfies CompactGuideCard;
}

function buildNextSteps(
  primaryRecommendation: RankedRecommendation,
  officialLinks: OfficialLink[],
  documentSections: ResultDocumentSection[],
  askForList: string[],
  actionBuckets: ActionBucket[],
) {
  const documentTitles = documentSections.slice(0, 2).map((section) => section.title.toLowerCase());
  const documentFocus =
    documentTitles.length === 0
      ? "identitet, inntekt og andre sentrale opplysninger om situasjonen din"
      : documentTitles.length === 1
        ? documentTitles[0]
        : `${documentTitles[0]} og ${documentTitles[1]}`;
  const officialPublishers = [...new Set(officialLinks.map((link) => link.publisher))];
  const officialSourceText =
    officialPublishers.length === 0
      ? "de offisielle sidene"
      : officialPublishers.length === 1
        ? officialPublishers[0]
        : `${officialPublishers.slice(0, -1).join(", ")} og ${officialPublishers[officialPublishers.length - 1]}`;

  const steps = [
    ...actionBuckets.flatMap((bucket) => bucket.items.slice(0, bucket.id === "this_week" ? 2 : 1)),
    `Samle først ${documentFocus}. Det gjør neste kontakt mer konkret og saklig.`,
    askForList[0] ? `Bruk spørsmålslisten aktivt: ${askForList[0]}` : "",
    `Les gjennom de offisielle lenkene fra ${officialSourceText} før du går videre, slik at du ser hvilke praktiske steg som gjelder.`,
    `Be om en konkret vurdering av ${primaryRecommendation.recommendation.title.toLowerCase()}. Denne veiviseren er bare en støtte for oversikt og forberedelse.`,
  ];

  return uniqueStrings(steps);
}

function buildRiskNotes(
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  alternativeRecommendations: RankedRecommendation[],
  acuteItems: MatchedAcuteItem[],
  documentSections: ResultDocumentSection[],
) {
  const riskNotes: string[] = [];
  const dontKnowAnswers = evaluation.answeredFacts.filter((fact) => fact.includes("Vet ikke")).length;

  if (dontKnowAnswers > 0) {
    riskNotes.push(
      `Du har svart «Vet ikke» på ${dontKnowAnswers} spørsmål. Det kan bety at andre ordninger eller andre vilkår blir viktigere når NAV gjør en konkret vurdering.`,
    );
  }

  if (acuteItems.length > 0) {
    riskNotes.push(
      "Akutte forhold kan flytte prioriteringen. Selv om hovedanbefalingen ser relevant ut, kan riktig instans måtte starte med det som haster mest først.",
    );
  }

  if (evaluation.flags.includes("other_household_income")) {
    riskNotes.push(
      "Andre inntekter eller ressurser i husholdningen kan gjøre at behovet vurderes annerledes enn veiviseren antyder, særlig for behovsprøvde løp.",
    );
  }

  if (evaluation.flags.includes("partner_income_or_benefits")) {
    riskNotes.push(
      "Inntekt eller ytelser hos en partner eller annen voksen i husholdningen kan gjøre at støtte og behovsprøving blir vurdert annerledes enn i veiviseren.",
    );
  }

  if (evaluation.flags.includes("shared_household") || evaluation.flags.includes("shared_household_shortfall")) {
    riskNotes.push(
      "Når dere er flere voksne i husholdningen, vil riktig instans ofte se på husholdningens samlede økonomi, boutgifter og faktiske forsørgelse før de vurderer hvilket løp som passer best.",
    );
  }

  if (evaluation.flags.includes("single_with_children") || evaluation.flags.includes("household_with_children")) {
    riskNotes.push(
      "Barn i husholdningen kan gjøre situasjonen mer alvorlig og løfte enkelte ordninger høyere, men forsørgeransvar, bolig og husholdningens samlede økonomi vurderes fortsatt konkret.",
    );
  }

  if (evaluation.flags.includes("shared_custody")) {
    riskNotes.push(
      "Delt omsorg eller samværsordning kan påvirke både dokumentasjonsbehov og hvordan husholdning og utgifter vurderes i saken din.",
    );
  }

  if (evaluation.flags.includes("child_extra_needs_costs")) {
    riskNotes.push(
      "Når barnets behov gir ekstra kostnader eller større omsorgsbelastning, må dette vanligvis beskrives og dokumenteres mer konkret enn veiviseren kan gjøre alene.",
    );
  }

  if (evaluation.flags.includes("child_housing_unclear")) {
    riskNotes.push(
      "Hvis barnets eller husholdningens bosituasjon er midlertidig eller uavklart, kan det endre både hvilke spor som passer best og hva som må dokumenteres først.",
    );
  }

  if (evaluation.flags.includes("temporary_household")) {
    riskNotes.push(
      "Hvis du bor midlertidig hos andre, kan det være uklart om dette er en kortvarig løsning eller et mer akutt og varig boligproblem.",
    );
  }

  if (documentSections.length > 0) {
    riskNotes.push(
      "Manglende eller svak dokumentasjon kan gjøre at et mulig løp blir vanskeligere å vurdere raskt eller faller svakere ut enn veiviseren antyder.",
    );
  }

  const needsMedicalDocumentation = [
    "health_blocks_work",
    "partial_work_capacity",
    "assistive_need",
    "extra_expenses_condition",
    "ongoing_care_need",
    "absence_for_care",
  ].some((flag) => evaluation.flags.includes(flag));

  if (needsMedicalDocumentation && !evaluation.flags.includes("has_medical_followup")) {
    riskNotes.push(
      "Flere av sporene i resultatet forutsetter medisinsk eller faglig dokumentasjon. Hvis slik dokumentasjon ikke er på plass ennå, kan vurderingen endre seg når saken blir konkretisert.",
    );
  }

  if (evaluation.flags.includes("first_public_contact")) {
    riskNotes.push(
      "Hvis dette er første gang du er i kontakt med NAV, kommunen eller lignende om saken, kan det hende riktig instans først må hjelpe deg å sortere ansvar, språk og prosess før de vurderer konkrete ordninger.",
    );
  }

  switch (primaryRecommendation.recommendation.id) {
    case "krise_trygghet_vold":
      riskNotes.push(
        "Krise- og trygghetsspor handler først om sikkerhet, ikke om fullstendig oversikt. Det kan være riktig å bruke akutt hjelp før du har rukket å samle all dokumentasjon.",
      );
      break;
    case "familie_og_foreldrestotte":
      riskNotes.push(
        "Familie- og foreldrestøtte løser ikke alene spørsmål om akutt trygghet, vold eller alvorlig bekymring for barn. Da kan andre spor måtte løftes først.",
      );
      break;
    case "barnevern_hjelpetiltak":
      riskNotes.push(
        "Barnevern og hjelpetiltak vurderes konkret ut fra barnets situasjon, alvorlighetsgrad og hva som allerede er prøvd. Resultatet her kan derfor se annerledes ut når saken beskrives fullt ut.",
      );
      break;
    case "barn_og_unge_psykisk_helse":
      riskNotes.push(
        "Psykisk helsehjelp for barn og unge vurderes konkret ut fra symptomer, funksjon, varighet og alvorlighetsgrad. Hvilket kontaktpunkt som er riktig først kan derfor variere.",
      );
      break;
    case "karriereveiledning_ungdom":
      riskNotes.push(
        "Karriereveiledning kan være et godt første steg, men erstatter ikke vurdering av akutt økonomi, bolig, helse eller andre forhold som haster mer.",
      );
      break;
    case "kommunal_klage_ombud":
      riskNotes.push(
        "Klage- og ombudsspor hjelper deg å forstå rettigheter og neste steg, men de løser ikke automatisk det praktiske behovet hvis saken også gjelder akutt hjelp, helse eller trygghet.",
      );
      break;
    case "dagpenger":
      riskNotes.push(
        "Dagpenger kan falle ut dersom du ikke oppfyller krav til tidligere arbeid og inntekt, eller dersom NAV vurderer at du ikke står til disposisjon som reell arbeidssøker.",
      );
      break;
    case "okonomisk_sosialhjelp":
      riskNotes.push(
        "Økonomisk sosialhjelp vurderes konkret. Omfanget kan bli mindre eller falle ut dersom NAV mener andre inntekter, midler eller løsninger må brukes først.",
      );
      break;
    case "aap":
      riskNotes.push(
        "AAP kan falle ut dersom helseforhold og nedsatt arbeidsevne ikke er dokumentert tydelig nok, eller dersom NAV vurderer at andre løp må prøves først.",
      );
      break;
    case "kvalifiseringsprogram":
      riskNotes.push(
        "Kvalifiseringsprogram kan falle ut dersom NAV vurderer at du ikke har behov for tett og helhetlig oppfølging over tid, eller at andre tiltak passer bedre.",
      );
      break;
    case "okonomi_gjeld":
      riskNotes.push(
        "Økonomi- og gjeldsrådgivning kan se annerledes ut i praksis dersom betalingsproblemene vurderes som mindre alvorlige eller håndterbare uten tett oppfølging.",
      );
      break;
    case "bostotte":
      riskNotes.push(
        "Bostøtte kan falle ut dersom bolig, husstand, boutgifter eller inntekt ikke passer med vilkårene som Husbanken bruker i sin vurdering.",
      );
      break;
    case "midlertidig_botilbud":
      riskNotes.push(
        "Midlertidig botilbud forutsetter et akutt og reelt boligbehov. Hvis NAV vurderer at du har et forsvarlig alternativ, kan dette løftet falle bort.",
      );
      break;
    case "arbeid_oppfolging":
      riskNotes.push(
        "Hjelp til å komme i arbeid kan bli avgrenset eller se annerledes ut enn veiviseren antyder, fordi behov, arbeidsevne og tilgjengelige tiltak vurderes konkret.",
      );
      break;
    case "hjelpemidler_tilrettelegging":
      riskNotes.push(
        "Ansvarsdelingen mellom kommune, barnehage, skole og NAV kan variere etter hva slags hjelpemiddel eller tilrettelegging du trenger. Derfor kan første kontaktpunkt være et annet enn veiviseren antyder.",
      );
      break;
    case "samordnet_barneoppfolging":
      riskNotes.push(
        "Når barnets behov går på tvers av flere tjenester, er det vanlig at saken blir mer avhengig av god koordinering og tydelig dokumentasjon enn av én enkelt ordning alene.",
      );
      break;
    case "grunnstonad":
      riskNotes.push(
        "Grunnstønad bygger på nødvendige, løpende ekstrautgifter over tid. Hvis utgiftene ikke er store nok, ikke er varige nok eller er svakt dokumentert, kan dette sporet falle ut.",
      );
      break;
    case "hjelpestonad":
      riskNotes.push(
        "Hjelpestønad avhenger av hvor omfattende behovet for tilsyn, pleie eller særskilt omsorg faktisk er. Det holder ikke bare at hverdagen oppleves krevende.",
      );
      break;
    case "pleiepenger_barn":
      riskNotes.push(
        "Pleiepenger vurderes konkret ut fra barnets situasjon, omsorgsbehov og hvordan dette påvirker muligheten din til å være i arbeid. Dette må ofte dokumenteres tydelig.",
      );
      break;
    case "opplaeringspenger":
      riskNotes.push(
        "Opplæringspenger forutsetter at opplæringen er nødvendig for at du skal kunne ta deg av barnet eller den du har omsorg for. Det må vanligvis bekreftes av helsepersonell eller annen faginstans.",
      );
      break;
    case "helsehjelp_oppfolging":
      riskNotes.push(
        "Veiviseren kan ikke vurdere medisinsk hastegrad eller helsefaglig behov. Ved alvorlig forverring må du bruke ordinære helsetjenester, ikke bare veiviseren.",
      );
      break;
    case "juridisk_veiledning":
      riskNotes.push(
        "Juridisk veiledning kan være nyttig, men den endrer ikke frister eller krav i saken din. Du må fortsatt følge opp brev, vedtak og klagefrister konkret.",
      );
      break;
    default:
      break;
  }

  if (alternativeRecommendations.length > 0) {
    riskNotes.push(
      "Det finnes også andre muligheter i resultatet. Det betyr at saken din kan ligge i grenseland mellom flere ordninger eller tjenester.",
    );
  }

  return uniqueStrings(riskNotes);
}

function buildDoNotAssumeList(
  evaluation: WizardEvaluation,
  primaryRecommendation: RankedRecommendation,
  acuteItems: MatchedAcuteItem[],
) {
  const notes = [
    "Ikke anta at veiviseren har avgjort at du har rett på noe. Offentlig instans må fortsatt vurdere saken konkret.",
    acuteItems.length > 0
      ? "Ikke anta at et mer langsiktig spor blir vurdert før det som haster mest er avklart."
      : "",
    evaluation.flags.includes("deadline_running")
      ? "Ikke anta at en frist stopper fordi du ber om hjelp. Noter datoer og følg opp brevet konkret."
      : "",
    evaluation.flags.includes("has_existing_decision")
      ? "Ikke anta at muntlige forklaringer er nok hvis et brev eller vedtak allerede finnes. Du bør forholde deg til hva som står skriftlig."
      : "",
    evaluation.flags.includes("shared_household") ||
    evaluation.flags.includes("shared_household_shortfall") ||
    evaluation.flags.includes("partner_income_or_benefits")
      ? "Ikke anta at saken vurderes bare ut fra din egen økonomi når flere voksne eller flere inntekter er en del av husholdningen."
      : "",
    evaluation.flags.includes("for_child") || evaluation.flags.includes("caregiver_rights")
      ? "Ikke anta at skole, helse, kommune og NAV automatisk deler all informasjon eller avklarer ansvar seg imellom uten at behovet beskrives tydelig."
      : "",
    evaluation.flags.includes("child_welfare_concern") || evaluation.flags.includes("urgent_unsafe_home")
      ? "Ikke anta at en utrygg situasjon bør vente til alt er dokumentert. Trygghet og akutt beskyttelse må vurderes først."
      : "",
    primaryRecommendation.recommendation.id === "hjelpemidler_tilrettelegging" ||
    primaryRecommendation.recommendation.id === "samordnet_barneoppfolging"
      ? "Ikke anta at én instans har ansvar for hele saken. Hjelpemidler, tilrettelegging og koordinering kan ligge hos ulike deler av hjelpeapparatet."
      : "",
    primaryRecommendation.recommendation.id === "kommunal_klage_ombud"
      ? "Ikke anta at ombud eller klageinstans automatisk er første sted å begynne. Noen ganger bør saken først tas opp med tjenesten eller avklares nærmere før du klager."
      : "",
    primaryRecommendation.recommendation.id === "juridisk_veiledning"
      ? "Ikke anta at klage eller juridisk veiledning automatisk endrer vedtaket. Det er fortsatt frister, vilkår og dokumentasjon som styrer videre behandling."
      : "",
  ];

  return uniqueStrings(notes);
}

function buildSummaryText(
  primaryRecommendation: RankedRecommendation,
  alternativeAssessments: AlternativeAssessment[],
  parallelRecommendations: RankedRecommendation[],
  supportRecommendations: RankedRecommendation[],
  acuteItems: MatchedAcuteItem[],
  documentSections: ResultDocumentSection[],
  officialLinks: OfficialLink[],
  helpModeCards: HelpModeCard[],
  actionBuckets: ActionBucket[],
  beforeContact: BeforeContactCard,
  phoneCard: CompactGuideCard,
  meetingCard: CompactGuideCard,
  situationMap: SituationMap,
  actorGuidance: ActorGuideCard[],
  glossaryTerms: GlossaryTerm[],
  whatIfScenarios: WhatIfScenario[],
  missingItems: MissingInformationItem[],
  nextSteps: string[],
  askForList: string[],
  riskNotes: string[],
  doNotAssumeList: string[],
  consistencyNotes: ConsistencyNote[],
  sessionHistory: WizardSession["history"],
  letterSummaryCard: CompactGuideCard | null,
  youthGuideCard: CompactGuideCard | null,
  childSchoolCard: CompactGuideCard | null,
  contactDraft: string,
  disclaimers: GuideContentBundle["disclaimers"],
) {
  const lines = [
    "Hjelpeveiviser",
    "",
    "Dette er en lokal veiviseroppsummering. Det er ikke et juridisk dokument, ikke en søknad og ikke en offisiell tjeneste.",
    "",
    `Anbefalt hovedspor: ${primaryRecommendation.recommendation.title}`,
    primaryRecommendation.recommendation.summary,
    "",
    "Hvorfor dette foreslås:",
    ...(primaryRecommendation.reasons.length ? primaryRecommendation.reasons : ["Trenger mer avklaring i kontakt med riktig hjelpeinstans."]).map(
      (reason) => `- ${reason}`,
    ),
  ];

  if (parallelRecommendations.length) {
    lines.push("", "Parallelle løp som også bør vurderes:");
    parallelRecommendations.forEach((item) => lines.push(`- ${item.recommendation.title}: ${item.recommendation.summary}`));
  }

  if (supportRecommendations.length) {
    lines.push("", "Støtteløp som kan være nyttige senere:");
    supportRecommendations.forEach((item) => lines.push(`- ${item.recommendation.title}: ${item.recommendation.summary}`));
  }

  if (alternativeAssessments.length) {
    lines.push("", "Hvorfor andre spor ikke er løftet høyere nå:");
    alternativeAssessments.forEach((item) => {
      lines.push(`- ${item.recommendation.recommendation.title}`);
      item.whyStillRelevant.forEach((reason) => lines.push(`  * Fortsatt relevant: ${reason}`));
      item.whyNotHigher.forEach((reason) => lines.push(`  * Ikke løftet høyere nå: ${reason}`));
    });
  }

  if (acuteItems.length) {
    lines.push("", "Hva som haster:");
    acuteItems.forEach((item) => lines.push(`- ${item.rule.title}: ${item.rule.summary}`));
  }

  if (helpModeCards.length) {
    lines.push("", "Hva slags hjelp dette handler om:");
    helpModeCards.forEach((card) => {
      lines.push(`- ${card.title}: ${card.description}`);
      card.items.forEach((item) => lines.push(`  * ${item}`));
    });
  }

  lines.push(
    "",
    "Før kontakt:",
    `- Kontakt først: ${beforeContact.contactFirst}`,
    ...beforeContact.whyNow.map((item) => `- Hvorfor nå: ${item}`),
    ...beforeContact.sayThisFirst.map((item) => `- Dette kan du si: ${item}`),
  );

  lines.push("", `${phoneCard.title}:`);
  phoneCard.items.forEach((item) => lines.push(`- ${item}`));

  lines.push("", `${meetingCard.title}:`);
  meetingCard.items.forEach((item) => lines.push(`- ${item}`));

  if (situationMap.keyFacts.length) {
    lines.push("", "Situasjonskart:");
    situationMap.keyFacts.forEach((fact) => lines.push(`- ${fact}`));
    situationMap.scoreLines.forEach((line) => {
      lines.push(`- ${line.title} (score ${line.score}, ${line.strengthLabel})`);
      line.pullsUp.forEach((item) => lines.push(`  * Trekker opp: ${item}`));
      line.pullsDown.forEach((item) => lines.push(`  * Trekker ned: ${item}`));
    });
  }

  if (missingItems.length) {
    lines.push("", "Hva som mangler:");
    missingItems.forEach((item) => lines.push(`- ${item.title}: ${item.description}`));
  }

  if (letterSummaryCard) {
    lines.push("", `${letterSummaryCard.title}:`);
    letterSummaryCard.items.forEach((item) => lines.push(`- ${item}`));
  }

  if (youthGuideCard) {
    lines.push("", `${youthGuideCard.title}:`);
    youthGuideCard.items.forEach((item) => lines.push(`- ${item}`));
  }

  if (childSchoolCard) {
    lines.push("", `${childSchoolCard.title}:`);
    childSchoolCard.items.forEach((item) => lines.push(`- ${item}`));
  }

  lines.push("", "Handlingsplan:");
  actionBuckets.forEach((bucket) => {
    lines.push(`- ${bucket.title}`);
    bucket.items.forEach((item) => lines.push(`  * ${item}`));
  });

  if (documentSections.length) {
    lines.push("", "Vanlig dokumentasjon:");
    documentSections.forEach((section) => {
      lines.push(`- ${section.title}`);
      section.items.forEach((item) => lines.push(`  * ${item}`));
    });
  }

  if (nextSteps.length) {
    lines.push("", "Flere steg videre:");
    nextSteps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  }

  if (askForList.length) {
    lines.push("", "Det kan være lurt å be om dette:");
    askForList.forEach((item) => lines.push(`- ${item}`));
  }

  if (doNotAssumeList.length) {
    lines.push("", "Hva du ikke bør anta:");
    doNotAssumeList.forEach((item) => lines.push(`- ${item}`));
  }

  if (whatIfScenarios.length) {
    lines.push("", "Hvis ett nøkkelsvar blir annerledes:");
    whatIfScenarios.forEach((scenario) => lines.push(`- ${scenario.summary}`));
  }

  if (consistencyNotes.length) {
    lines.push("", "Ting som bør dobbeltsjekkes:");
    consistencyNotes.forEach((note) => lines.push(`- ${note.title}: ${note.description}`));
  }

  if (riskNotes.length) {
    lines.push("", "Risiko og avgrensninger:");
    riskNotes.forEach((risk) => lines.push(`- ${risk}`));
  }

  lines.push("", "Forslag til formulering:", contactDraft);

  if (officialLinks.length) {
    lines.push("", "Hvem som kan hjelpe videre:");
    officialLinks.forEach((link) => lines.push(`- ${link.actionLabel} (${link.publisher}): ${link.url}`));
  }

  if (actorGuidance.length) {
    lines.push("", "Hvem gjør hva:");
    actorGuidance.forEach((card) => {
      lines.push(`- ${card.title}: ${card.description}`);
      card.items.forEach((item) => lines.push(`  * ${item}`));
    });
  }

  if (glossaryTerms.length) {
    lines.push("", "Kort ordliste:");
    glossaryTerms.forEach((term) => lines.push(`- ${term.title}: ${term.description}`));
  }

  if (sessionHistory.length) {
    lines.push("", "Hvordan retningen endret seg i denne økten:");
    sessionHistory.slice(-6).forEach((entry) => lines.push(`- ${entry.answerSummary} -> ${entry.recommendationTitle}`));
  }

  if (disclaimers.length) {
    lines.push("", "Forbehold:");
    disclaimers.forEach((disclaimer) => lines.push(`- ${disclaimer.title}: ${disclaimer.text}`));
  }

  return lines.join("\n");
}

export function buildGuideResult(
  bundle: GuideContentBundle,
  answers: Record<string, AnswerValue>,
  session?: Pick<WizardSession, "history">,
) {
  const evaluation = evaluateWizard(bundle, answers);
  const rankedRecommendations = rankRecommendations(bundle, evaluation);
  const primaryRecommendation = rankedRecommendations[0];
  const acuteItems = buildAcuteItems(bundle, evaluation);
  const { parallelRecommendations, supportRecommendations } = buildRecommendationBuckets(
    primaryRecommendation,
    rankedRecommendations,
    acuteItems,
  );
  const alternativeRecommendations = [...parallelRecommendations, ...supportRecommendations].slice(0, 4);
  const alternativeAssessments = buildAlternativeAssessments(
    primaryRecommendation,
    alternativeRecommendations,
    acuteItems,
    evaluation,
  );

  const documentListIds = [
    ...acuteItems.flatMap((item) => item.rule.documentListIds),
    ...primaryRecommendation.recommendation.documentListIds,
    ...parallelRecommendations.flatMap((item) => item.recommendation.documentListIds),
    ...supportRecommendations.flatMap((item) => item.recommendation.documentListIds),
  ];
  const officialLinkIds = [
    ...acuteItems.flatMap((item) => item.rule.officialLinkIds),
    ...primaryRecommendation.recommendation.officialLinkIds,
    ...parallelRecommendations.flatMap((item) => item.recommendation.officialLinkIds),
    ...supportRecommendations.flatMap((item) => item.recommendation.officialLinkIds),
    ...buildContextOfficialLinkIds(evaluation),
  ];

  const documentSections = collectDocumentSections(bundle, documentListIds);
  const officialLinks = collectOfficialLinks(bundle, officialLinkIds);
  const phraseTemplate = bundle.phraseTemplates.find(
    (template) => template.id === primaryRecommendation.recommendation.phraseTemplateId,
  );
  const contactDraft = buildContactDraft(evaluation, primaryRecommendation, phraseTemplate, acuteItems);
  const askForList = buildAskForList(evaluation, primaryRecommendation, acuteItems, parallelRecommendations);
  const consistencyNotes = buildConsistencyNotes(evaluation);
  const helpModeCards = buildHelpModeCards(primaryRecommendation, parallelRecommendations, supportRecommendations, acuteItems);
  const beforeContact = buildBeforeContact(
    evaluation,
    primaryRecommendation,
    acuteItems,
    documentSections,
    officialLinks,
    askForList,
  );
  const actionBuckets = buildActionBuckets(
    evaluation,
    primaryRecommendation,
    acuteItems,
    officialLinks,
    documentSections,
    askForList,
    parallelRecommendations,
    supportRecommendations,
    consistencyNotes,
  );
  const phoneCard = buildPhoneCard(primaryRecommendation, actionBuckets, beforeContact, acuteItems);
  const meetingCard = buildMeetingCard(primaryRecommendation, beforeContact, askForList, documentSections, consistencyNotes);
  const situationMap = buildSituationMap(evaluation, primaryRecommendation, alternativeAssessments);
  const actorGuidance = buildActorGuidance(officialLinks);
  const glossaryTerms = buildGlossaryTerms(evaluation, primaryRecommendation, officialLinks, parallelRecommendations);
  const whatIfScenarios = buildWhatIfScenarios(bundle, answers, evaluation, primaryRecommendation, acuteItems);
  const missingItems = buildMissingItems(evaluation, primaryRecommendation, documentSections, consistencyNotes);
  const doNotAssumeList = buildDoNotAssumeList(evaluation, primaryRecommendation, acuteItems);
  const letterSummaryCard = buildLetterSummaryCard(evaluation, beforeContact, askForList, doNotAssumeList);
  const youthGuideCard = buildYouthGuideCard(evaluation, beforeContact, actorGuidance);
  const childSchoolCard = buildChildSchoolCard(evaluation, beforeContact, officialLinks);
  const nextSteps = buildNextSteps(primaryRecommendation, officialLinks, documentSections, askForList, actionBuckets);
  const riskNotes = buildRiskNotes(
    evaluation,
    primaryRecommendation,
    alternativeRecommendations,
    acuteItems,
    documentSections,
  );
  const sessionHistory = session?.history ?? [];
  const summaryText = buildSummaryText(
    primaryRecommendation,
    alternativeAssessments,
    parallelRecommendations,
    supportRecommendations,
    acuteItems,
    documentSections,
    officialLinks,
    helpModeCards,
    actionBuckets,
    beforeContact,
    phoneCard,
    meetingCard,
    situationMap,
    actorGuidance,
    glossaryTerms,
    whatIfScenarios,
    missingItems,
    nextSteps,
    askForList,
    riskNotes,
    doNotAssumeList,
    consistencyNotes,
    sessionHistory,
    letterSummaryCard,
    youthGuideCard,
    childSchoolCard,
    contactDraft,
    bundle.disclaimers,
  );

  return {
    evaluation,
    primaryRecommendation,
    alternativeRecommendations,
    alternativeAssessments,
    parallelRecommendations,
    supportRecommendations,
    acuteItems,
    documentSections,
    officialLinks,
    helpModeCards,
    actionBuckets,
    beforeContact,
    phoneCard,
    meetingCard,
    situationMap,
    actorGuidance,
    glossaryTerms,
    whatIfScenarios,
    missingItems,
    consistencyNotes,
    nextSteps,
    askForList,
    riskNotes,
    doNotAssumeList,
    letterSummaryCard,
    youthGuideCard,
    childSchoolCard,
    contactDraft,
    summaryText,
    sessionHistory,
    disclaimers: bundle.disclaimers,
  } satisfies GuideResult;
}
