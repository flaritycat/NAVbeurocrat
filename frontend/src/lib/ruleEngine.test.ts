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
});
