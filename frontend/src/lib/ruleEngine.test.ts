import { describe, expect, it } from "vitest";
import { defaultContentBundle } from "./contentBundle";
import { buildConsistencyNotes, buildGuideResult, evaluateWizard } from "./ruleEngine";

function nextVisibleQuestionIds(answers: Record<string, string | string[]>) {
  return evaluateWizard(defaultContentBundle, answers).visibleQuestions.map((question) => question.id);
}

describe("ruleEngine flows", () => {
  it("forces thematic clarification before urgency in 'jeg vet ikke'-sporet", () => {
    const questionIds = nextVisibleQuestionIds({
      start_situation: "dont_know",
    });

    expect(questionIds[0]).toBe("start_situation");
    expect(questionIds[1]).toBe("unclear_focus");
    expect(questionIds).not.toContain("acute_now");
  });

  it("keeps support flow away from the generic urgency question until support needs are known", () => {
    const questionIds = nextVisibleQuestionIds({
      start_situation: "disability_support",
      help_applies_to: "for_child",
    });

    expect(questionIds).toContain("support_needs");
    expect(questionIds).toContain("child_household_detail");
    expect(questionIds).not.toContain("acute_now");
  });

  it("asks about housing context early in the direct housing track", () => {
    const questionIds = nextVisibleQuestionIds({
      start_situation: "housing_risk",
      acute_now: "nothing_acute",
    });

    expect(questionIds).toContain("housing_context_first");
    expect(questionIds).not.toContain("debt_context_first");
  });

  it("builds action buckets and before-contact summary for a finance-heavy flow", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "no_money",
      acute_now: "food_or_power",
      income_level: "no_income",
      household_situation: "single_with_children",
      child_household_detail: "children_live_mostly_with_me",
      household_finances: "household_depends_on_me",
      housing_now: "hard_to_pay_housing",
      debt_pressure: "overdue_bills",
      follow_up_need: "money_first",
    });

    expect(result.actionBuckets).toHaveLength(3);
    expect(result.beforeContact.contactFirst.length).toBeGreaterThan(0);
    expect(result.beforeContact.haveReady.length).toBeGreaterThan(0);
    expect(result.summaryText).toContain("Før kontakt");
  });

  it("finds contradictions that should be shown back to the user", () => {
    const evaluation = evaluateWizard(defaultContentBundle, {
      start_situation: "housing_risk",
      acute_now: "no_place_tonight",
      housing_context_first: "housing_stable",
      income_level: "low_income",
    });

    const notes = buildConsistencyNotes(evaluation);
    expect(notes.some((note) => note.title.includes("Boligsituasjonen"))).toBe(true);
  });

  it("routes direct letter and decision cases into a legal clarification flow before anything else", () => {
    const questionIds = nextVisibleQuestionIds({
      start_situation: "letter_or_decision",
    });

    expect(questionIds).toContain("letter_decision_context");
    expect(questionIds).toContain("decision_timeline");
    expect(questionIds).not.toContain("acute_now");
  });

  it("asks young or first-contact users to clarify the type of first contact before urgency", () => {
    const questionIds = nextVisibleQuestionIds({
      start_situation: "young_or_first_contact",
    });

    expect(questionIds[1]).toBe("young_first_contact_context");
    expect(questionIds).not.toContain("acute_now");
  });

  it("brings urgency into the flow after a first-contact answer that points to money or housing pressure", () => {
    const questionIds = nextVisibleQuestionIds({
      start_situation: "young_or_first_contact",
      young_first_contact_context: "first_contact_money_housing",
    });

    expect(questionIds).toContain("acute_now");
    expect(questionIds).toContain("income_level");
  });

  it("routes municipal support users into a dedicated municipal clarification before other broad questions", () => {
    const questionIds = nextVisibleQuestionIds({
      start_situation: "municipal_support",
    });

    expect(questionIds).toContain("municipal_support_focus");
    expect(questionIds).not.toContain("acute_now");
  });

  it("captures additional household factors for child and caregiver related flows", () => {
    const questionIds = nextVisibleQuestionIds({
      start_situation: "caregiver_rights",
      help_applies_to: "for_child",
      support_needs: ["extra_expenses_due_to_condition"],
      support_acute_now: "support_not_acute",
      household_situation: "single_with_children",
      child_household_detail: "shared_custody",
      income_level: "low_income",
      household_finances: "shared_finances_not_enough",
    });

    expect(questionIds).toContain("household_extra_factors");
  });

  it("builds compact phone and meeting cards plus alternative explanations", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "letter_or_decision",
      letter_decision_context: "rejection_or_stop",
      decision_timeline: "deadline_soon",
      existing_followup: "have_decision_or_rejection",
      follow_up_need: "understand_decision_or_complaint",
    });

    expect(result.phoneCard.items).toHaveLength(4);
    expect(result.meetingCard.items.length).toBeGreaterThanOrEqual(4);
    expect(result.helpModeCards.length).toBeGreaterThan(0);
    expect(result.alternativeAssessments.every((item) => item.whyNotHigher.length > 0)).toBe(true);
  });

  it("builds a dedicated letter summary card and caution list for letter flows", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "letter_or_decision",
      letter_decision_context: "dont_understand_letter",
      decision_timeline: "deadline_soon",
      existing_followup: "have_decision_or_rejection",
      follow_up_need: "understand_decision_or_complaint",
    });

    expect(result.letterSummaryCard).not.toBeNull();
    expect(result.doNotAssumeList.length).toBeGreaterThan(0);
  });

  it("flags missing information when a letter flow still lacks the written decision context", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "letter_or_decision",
      letter_decision_context: "dont_know",
      decision_timeline: "dont_know",
      existing_followup: "not_started_anything",
      follow_up_need: "understand_decision_or_complaint",
    });

    expect(result.missingItems.some((item) => item.title.includes("Selve brevet") || item.title.includes("Noen svar"))).toBe(true);
  });

  it("builds a youth card when the user is young or in first contact", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "young_or_first_contact",
      young_first_contact_context: "under_25_and_unsure",
      follow_up_need: "guidance_to_contact_services",
    });

    expect(result.youthGuideCard).not.toBeNull();
  });

  it("lifts coordinated child follow-up when several services and unclear ownership are involved", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "caregiver_rights",
      help_applies_to: "for_child",
      support_needs: ["school_kindergarten_adaptation", "coordination_between_services"],
      child_complex_needs_context: ["child_many_services", "child_no_clear_owner"],
      support_acute_now: "support_not_acute",
      follow_up_need: "guidance_to_contact_services",
    });

    expect(result.primaryRecommendation.recommendation.id).toBe("samordnet_barneoppfolging");
  });

  it("builds do-not-assume guidance for legal flows with deadlines", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "letter_or_decision",
      letter_decision_context: "rejection_or_stop",
      decision_timeline: "deadline_soon",
      existing_followup: "have_decision_or_rejection",
      follow_up_need: "understand_decision_or_complaint",
    });

    expect(result.doNotAssumeList.some((item) => item.includes("frist"))).toBe(true);
  });

  it("includes local session history when provided", () => {
    const result = buildGuideResult(
      defaultContentBundle,
      {
        start_situation: "young_or_first_contact",
        young_first_contact_context: "need_help_understanding_roles",
        follow_up_need: "guidance_to_contact_services",
      },
      {
        history: [
          {
            id: "x1",
            questionId: "young_first_contact_context",
            questionTitle: "Hva passer best om hvorfor du trenger en første avklaring?",
            answerSummary: "Hva passer best om hvorfor du trenger en første avklaring?: Jeg trenger mest å forstå hvem som gjør hva og hva jeg bør be om først",
            recommendationTitle: "Hjelp til å komme i arbeid",
            recordedAt: "2026-04-07T10:00:00.000Z",
          },
        ],
      },
    );

    expect(result.sessionHistory).toHaveLength(1);
    expect(result.summaryText).toContain("Hvordan retningen endret seg i denne økten");
  });

  it("shows the dedicated child support follow-up question in child and caregiver flows", () => {
    const questionIds = nextVisibleQuestionIds({
      start_situation: "caregiver_rights",
      help_applies_to: "for_child",
      support_needs: ["assistive_devices_daily_life"],
      support_acute_now: "support_not_acute",
      household_situation: "single_with_children",
      child_household_detail: "children_live_mostly_with_me",
    });

    expect(questionIds).toContain("child_support_focus");
  });

  it("adds school-related guidance when school absence is part of the child flow", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "caregiver_rights",
      help_applies_to: "for_child",
      support_needs: ["school_kindergarten_adaptation", "coordination_between_services"],
      child_support_focus: ["school_absence_or_dropoff"],
      child_complex_needs_context: ["child_many_services", "child_no_clear_owner"],
      support_acute_now: "support_not_acute",
      follow_up_need: "guidance_to_contact_services",
    });

    expect(result.actorGuidance.some((card) => card.group === "skole")).toBe(true);
    expect(result.officialLinks.some((link) => link.id === "skolefravar")).toBe(true);
  });

  it("builds a child and school compact card when school coordination is part of the case", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "municipal_support",
      municipal_support_focus: "child_school_coordination",
      help_applies_to: "for_child",
      child_support_focus: ["school_absence_or_dropoff"],
      follow_up_need: "guidance_to_contact_services",
    });

    expect(result.childSchoolCard).not.toBeNull();
  });

  it("adds avlastning context when family needs relief around child care", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "caregiver_rights",
      help_applies_to: "for_child",
      support_needs: ["care_supervision_over_time"],
      child_support_focus: ["needs_relief_for_family", "long_term_care_child"],
      support_acute_now: "support_not_acute",
      follow_up_need: "guidance_to_contact_services",
    });

    expect(result.officialLinks.some((link) => link.id === "avlastning")).toBe(true);
    expect(result.glossaryTerms.some((term) => term.id === "avlastning")).toBe(true);
  });

  it("builds a situation map and what-if scenarios for housing-heavy flows", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "housing_risk",
      acute_now: "nothing_acute",
      housing_context_first: "can_lose_home",
      income_level: "low_income",
      household_situation: "single_with_children",
      child_household_detail: "children_live_mostly_with_me",
      household_finances: "household_depends_on_me",
      housing_now: "hard_to_pay_housing",
      follow_up_need: "money_first",
    });

    expect(result.situationMap.keyFacts.length).toBeGreaterThan(0);
    expect(result.whatIfScenarios.length).toBeGreaterThan(0);
  });

  it("adds legal actor guidance and glossary when a letter flow is active", () => {
    const result = buildGuideResult(defaultContentBundle, {
      start_situation: "letter_or_decision",
      letter_decision_context: "rejection_or_stop",
      decision_timeline: "deadline_soon",
      existing_followup: "have_decision_or_rejection",
      follow_up_need: "understand_decision_or_complaint",
    });

    expect(result.actorGuidance.some((card) => card.group === "rettshjelp")).toBe(true);
    expect(result.glossaryTerms.some((term) => term.id === "vedtak")).toBe(true);
  });
});
