import acuteRules from "../content/acuteLogic.json";
import disclaimers from "../content/disclaimers.json";
import documentLists from "../content/documentLists.json";
import officialLinks from "../content/officialLinks.json";
import phraseTemplates from "../content/phraseTemplates.json";
import questions from "../content/questions.json";
import recommendations from "../content/recommendations.json";
import type { GuideContentBundle } from "./types";

export const defaultContentBundle: GuideContentBundle = {
  questions: questions as unknown as GuideContentBundle["questions"],
  recommendations: recommendations as unknown as GuideContentBundle["recommendations"],
  acuteRules: acuteRules as unknown as GuideContentBundle["acuteRules"],
  documentLists: documentLists as unknown as GuideContentBundle["documentLists"],
  phraseTemplates: phraseTemplates as unknown as GuideContentBundle["phraseTemplates"],
  officialLinks: officialLinks as unknown as GuideContentBundle["officialLinks"],
  disclaimers: disclaimers as unknown as GuideContentBundle["disclaimers"],
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isArrayOfObjects(value: unknown) {
  return Array.isArray(value) && value.every((item) => isObject(item));
}

export function isGuideContentBundle(value: unknown): value is GuideContentBundle {
  if (!isObject(value)) {
    return false;
  }

  return (
    isArrayOfObjects(value.questions) &&
    isArrayOfObjects(value.recommendations) &&
    isArrayOfObjects(value.acuteRules) &&
    isArrayOfObjects(value.documentLists) &&
    isArrayOfObjects(value.phraseTemplates) &&
    isArrayOfObjects(value.officialLinks) &&
    isArrayOfObjects(value.disclaimers)
  );
}
