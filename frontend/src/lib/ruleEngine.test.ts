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
});
