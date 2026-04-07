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
  alternativeRecommendations: RankedRecommendation[],
) {
  const askForList = [
    "Be om en konkret vurdering av situasjonen din, ikke bare generell informasjon.",
    "Be om å få vite hva som bør gjøres først, og hvilken dokumentasjon som eventuelt mangler.",
  ];

  if (acuteItems.length > 0) {
    askForList.push(`Be om at det som haster mest blir vurdert først: ${acuteItems[0].rule.title.toLowerCase()}.`);
  }

  switch (primaryRecommendation.recommendation.id) {
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

  if (alternativeRecommendations.length > 0) {
    askForList.push("Be også om å få avklart om ett eller flere av de alternative sporene bør vurderes parallelt.");
  }

  return [...new Set(askForList)];
}

function buildNextSteps(
  primaryRecommendation: RankedRecommendation,
  acuteItems: MatchedAcuteItem[],
  documentSections: ResultDocumentSection[],
  officialLinks: OfficialLink[],
  askForList: string[],
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
      ? "de offisielle NAV-sidene"
      : officialPublishers.length === 1
        ? officialPublishers[0]
        : `${officialPublishers.slice(0, -1).join(", ")} og ${officialPublishers[officialPublishers.length - 1]}`;
  const firstAction = officialLinks[0]?.actionLabel ?? `ta første kontakt om ${primaryRecommendation.recommendation.title.toLowerCase()}`;

  const steps = acuteItems.length
    ? [
        `Start med det som haster mest: ${acuteItems[0].rule.title}. Hvis situasjonen er akutt, kan det være lurt å bruke første kontaktspor med en gang.`,
      ]
    : [
        `Start med hovedanbefalingen om ${primaryRecommendation.recommendation.title.toLowerCase()} og vurder om den beskriver situasjonen din godt nok til at du kan gå videre med kontakt eller søknad.`,
      ];

  steps.push(`Bruk første kontaktspor til å ${firstAction.toLowerCase()}. Da får du raskere avklart hvilken instans som bør ta saken videre.`);
  steps.push(`Samle først ${documentFocus}. Det gjør det lettere å forklare situasjonen kort og saklig når du tar kontakt.`);
  steps.push(`Bruk listen over hva du kan be om. Den hjelper deg å få en mer konkret samtale enn bare generell veiledning.`);
  steps.push(`Bruk forslag til formulering som et utkast. Tilpass teksten til din egen situasjon før du sender melding eller møter hjelpeapparatet.`);
  steps.push(`Les gjennom de offisielle lenkene fra ${officialSourceText} før du går videre, slik at du ser hvilke vilkår og praktiske steg som gjelder.`);
  if (askForList.length > 0) {
    steps.push(`Hvis du blir usikker i møtet med hjelpeapparatet, ta fram de to første punktene i «Det kan være lurt å be om dette».`);
  }
  steps.push("Be om en konkret vurdering av situasjonen din. Denne veiviseren er bare en støtte for oversikt og forberedelse, og erstatter ikke den offisielle vurderingen.");

  return steps;
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
      "Akutte forhold kan flytte prioriteringen. Selv om hovedanbefalingen ser relevant ut, kan NAV måtte starte med det som haster mest først.",
    );
  }

  if (evaluation.flags.includes("other_household_income")) {
    riskNotes.push(
      "Andre inntekter eller ressurser i husholdningen kan gjøre at behovet vurderes annerledes enn veiviseren antyder, særlig for behovsprøvde løp.",
    );
  }

  if (evaluation.flags.includes("shared_household") || evaluation.flags.includes("shared_household_shortfall")) {
    riskNotes.push(
      "Når dere er flere voksne i husholdningen, vil NAV ofte se på husholdningens samlede økonomi, boutgifter og faktiske forsørgelse før de vurderer hvilket løp som passer best.",
    );
  }

  if (evaluation.flags.includes("single_with_children") || evaluation.flags.includes("household_with_children")) {
    riskNotes.push(
      "Barn i husholdningen kan gjøre situasjonen mer alvorlig og løfte enkelte ordninger høyere, men NAV vil fortsatt vurdere forsørgeransvar, bolig og husholdningens samlede økonomi konkret.",
    );
  }

  if (evaluation.flags.includes("temporary_household")) {
    riskNotes.push(
      "Hvis du bor midlertidig hos andre, kan NAV vurdere om dette er en kortvarig løsning eller om det foreligger et akutt og varig boligproblem som må håndteres annerledes.",
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

  switch (primaryRecommendation.recommendation.id) {
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
        "Hjelp til å komme i arbeid kan bli avgrenset eller se annerledes ut enn veiviseren antyder, fordi NAV vurderer behov, arbeidsevne og tilgjengelige tiltak konkret.",
      );
      break;
    case "hjelpemidler_tilrettelegging":
      riskNotes.push(
        "Ansvarsdelingen mellom kommune, barnehage, skole og NAV kan variere etter hva slags hjelpemiddel eller tilrettelegging du trenger. Derfor kan første kontaktpunkt være et annet enn veiviseren antyder.",
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
        "Veiviseren kan ikke vurdere medisinsk hastegrad eller helsefaglig behov. Ved alvorlig forverring må du bruke ordinære helsetjenester, ikke bare støtteveiviseren.",
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

  return [...new Set(riskNotes)];
}

function buildSummaryText(
  primaryRecommendation: RankedRecommendation,
  alternatives: RankedRecommendation[],
  acuteItems: MatchedAcuteItem[],
  documentSections: ResultDocumentSection[],
  officialLinks: OfficialLink[],
  nextSteps: string[],
  askForList: string[],
  riskNotes: string[],
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
    ...(primaryRecommendation.reasons.length ? primaryRecommendation.reasons : ["- Trenger mer avklaring i kontakt med riktig hjelpeinstans."]).map(
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

  if (nextSteps.length) {
    lines.push("", "Forslag til videre steg:");
    nextSteps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
  }

  if (askForList.length) {
    lines.push("", "Det kan være lurt å be om dette:");
    askForList.forEach((item) => lines.push(`- ${item}`));
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

  if (disclaimers.length) {
    lines.push("", "Forbehold:");
    disclaimers.forEach((disclaimer) => lines.push(`- ${disclaimer.title}: ${disclaimer.text}`));
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
  const askForList = buildAskForList(evaluation, primaryRecommendation, acuteItems, alternativeRecommendations);
  const nextSteps = buildNextSteps(primaryRecommendation, acuteItems, documentSections, officialLinks, askForList);
  const riskNotes = buildRiskNotes(
    evaluation,
    primaryRecommendation,
    alternativeRecommendations,
    acuteItems,
    documentSections,
  );
  const summaryText = buildSummaryText(
    primaryRecommendation,
    alternativeRecommendations,
    acuteItems,
    documentSections,
    officialLinks,
    nextSteps,
    askForList,
    riskNotes,
    contactDraft,
    bundle.disclaimers,
  );

  return {
    evaluation,
    primaryRecommendation,
    alternativeRecommendations,
    acuteItems,
    documentSections,
    officialLinks,
    nextSteps,
    askForList,
    riskNotes,
    contactDraft,
    summaryText,
    disclaimers: bundle.disclaimers,
  } satisfies GuideResult;
}
