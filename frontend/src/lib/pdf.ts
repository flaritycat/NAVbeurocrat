import { jsPDF } from "jspdf";
import type { GuideResult } from "./types";

type RgbColor = readonly [number, number, number];
type PdfTone = "accent" | "warning" | "danger" | "neutral";

type PdfState = {
  document: jsPDF;
  margin: number;
  pageWidth: number;
  pageHeight: number;
  contentWidth: number;
  cursorY: number;
};

type TextMeasureOptions = {
  fontSize: number;
  fontStyle?: "normal" | "bold" | "italic";
  font?: "helvetica" | "courier";
};

const COLORS = {
  pageBg: [244, 239, 231] as RgbColor,
  panel: [255, 251, 247] as RgbColor,
  ink: [23, 32, 38] as RgbColor,
  muted: [97, 114, 124] as RgbColor,
  accent: [31, 91, 108] as RgbColor,
  accentSoft: [220, 233, 236] as RgbColor,
  warning: [180, 105, 45] as RgbColor,
  warningSoft: [245, 228, 211] as RgbColor,
  danger: [140, 75, 75] as RgbColor,
  dangerSoft: [243, 222, 222] as RgbColor,
  border: [218, 210, 198] as RgbColor,
  white: [255, 255, 255] as RgbColor,
} as const;

const BOTTOM_MARGIN = 52;

function setFillColor(document: jsPDF, color: RgbColor) {
  document.setFillColor(color[0], color[1], color[2]);
}

function setDrawColor(document: jsPDF, color: RgbColor) {
  document.setDrawColor(color[0], color[1], color[2]);
}

function setTextColor(document: jsPDF, color: RgbColor) {
  document.setTextColor(color[0], color[1], color[2]);
}

function paintPage(document: jsPDF) {
  const width = document.internal.pageSize.getWidth();
  const height = document.internal.pageSize.getHeight();

  setFillColor(document, COLORS.pageBg);
  document.rect(0, 0, width, height, "F");

  setFillColor(document, COLORS.panel);
  setDrawColor(document, COLORS.border);
  document.roundedRect(16, 16, width - 32, height - 32, 18, 18, "FD");
}

function createPdfState() {
  const document = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  paintPage(document);

  const margin = 42;
  const pageWidth = document.internal.pageSize.getWidth();
  const pageHeight = document.internal.pageSize.getHeight();

  return {
    document,
    margin,
    pageWidth,
    pageHeight,
    contentWidth: pageWidth - margin * 2,
    cursorY: margin,
  } satisfies PdfState;
}

function addPage(state: PdfState) {
  state.document.addPage();
  paintPage(state.document);
  state.cursorY = state.margin;
}

function ensureSpace(state: PdfState, requiredHeight: number) {
  if (state.cursorY + requiredHeight <= state.pageHeight - BOTTOM_MARGIN) {
    return;
  }

  addPage(state);
}

function measureLines(document: jsPDF, text: string, width: number, options: TextMeasureOptions) {
  document.setFont(options.font ?? "helvetica", options.fontStyle ?? "normal");
  document.setFontSize(options.fontSize);
  return document.splitTextToSize(text, width) as string[];
}

function drawLines(
  state: PdfState,
  lines: string[],
  x: number,
  y: number,
  options: { fontSize: number; lineHeight: number; color: RgbColor; fontStyle?: "normal" | "bold" | "italic"; font?: "helvetica" | "courier" },
) {
  state.document.setFont(options.font ?? "helvetica", options.fontStyle ?? "normal");
  state.document.setFontSize(options.fontSize);
  setTextColor(state.document, options.color);

  lines.forEach((line, index) => {
    state.document.text(line, x, y + index * options.lineHeight);
  });
}

function drawSectionHeading(state: PdfState, eyebrow: string, title: string) {
  const titleLines = measureLines(state.document, title, state.contentWidth, {
    fontSize: 18,
    fontStyle: "bold",
  });
  const height = 18 + titleLines.length * 20;

  ensureSpace(state, height);

  state.document.setFont("helvetica", "bold");
  state.document.setFontSize(8);
  setTextColor(state.document, COLORS.muted);
  state.document.text(eyebrow.toUpperCase(), state.margin, state.cursorY);

  drawLines(state, titleLines, state.margin, state.cursorY + 18, {
    fontSize: 18,
    lineHeight: 20,
    color: COLORS.ink,
    fontStyle: "bold",
  });

  state.cursorY += height + 4;
}

function drawHero(state: PdfState, result: GuideResult) {
  const generatedAt = new Intl.DateTimeFormat("nb-NO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date());
  const titleLines = measureLines(state.document, result.primaryRecommendation.recommendation.title, state.contentWidth - 40, {
    fontSize: 24,
    fontStyle: "bold",
  });
  const summaryLines = measureLines(state.document, result.primaryRecommendation.recommendation.summary, state.contentWidth - 40, {
    fontSize: 11,
  });
  const cardHeight = 90 + titleLines.length * 28 + summaryLines.length * 15;

  ensureSpace(state, cardHeight);

  setFillColor(state.document, COLORS.accentSoft);
  setDrawColor(state.document, COLORS.border);
  state.document.roundedRect(state.margin, state.cursorY, state.contentWidth, cardHeight, 20, 20, "FD");

  state.document.setFont("helvetica", "bold");
  state.document.setFontSize(9);
  setTextColor(state.document, COLORS.accent);
  state.document.text("Hjelpeveiviser", state.margin + 20, state.cursorY + 22);

  state.document.setFont("helvetica", "bold");
  state.document.setFontSize(24);
  drawLines(state, titleLines, state.margin + 20, state.cursorY + 50, {
    fontSize: 24,
    lineHeight: 28,
    color: COLORS.ink,
    fontStyle: "bold",
  });

  drawLines(state, summaryLines, state.margin + 20, state.cursorY + 50 + titleLines.length * 28 + 2, {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.muted,
  });

  const metaText = `Generert lokalt ${generatedAt}`;
  state.document.setFont("helvetica", "bold");
  state.document.setFontSize(10);
  const metaWidth = state.document.getTextWidth(metaText) + 22;

  setFillColor(state.document, COLORS.white);
  setDrawColor(state.document, COLORS.border);
  state.document.roundedRect(state.margin + state.contentWidth - metaWidth - 20, state.cursorY + 18, metaWidth, 22, 11, 11, "FD");
  setTextColor(state.document, COLORS.accent);
  state.document.text(metaText, state.margin + state.contentWidth - metaWidth - 9, state.cursorY + 32);

  state.document.setFont("helvetica", "bold");
  state.document.setFontSize(10);
  const pillText = result.primaryRecommendation.recommendation.category;
  const pillWidth = state.document.getTextWidth(pillText) + 24;

  setFillColor(state.document, COLORS.white);
  state.document.roundedRect(state.margin + 20, state.cursorY + cardHeight - 34, pillWidth, 22, 11, 11, "F");
  setTextColor(state.document, COLORS.accent);
  state.document.text(pillText, state.margin + 32, state.cursorY + cardHeight - 20);

  state.cursorY += cardHeight + 16;
}

function resolveToneColors(tone: PdfTone) {
  switch (tone) {
    case "accent":
      return {
        fill: COLORS.accentSoft,
        line: COLORS.accent,
        text: COLORS.accent,
      };
    case "warning":
      return {
        fill: COLORS.warningSoft,
        line: COLORS.warning,
        text: COLORS.warning,
      };
    case "danger":
      return {
        fill: COLORS.dangerSoft,
        line: COLORS.danger,
        text: COLORS.danger,
      };
    default:
      return {
        fill: COLORS.panel,
        line: COLORS.border,
        text: COLORS.ink,
      };
  }
}

function drawCallout(state: PdfState, label: string, title: string, body: string, tone: PdfTone) {
  const colors = resolveToneColors(tone);
  const titleLines = measureLines(state.document, title, state.contentWidth - 46, {
    fontSize: 12,
    fontStyle: "bold",
  });
  const bodyLines = measureLines(state.document, body, state.contentWidth - 46, {
    fontSize: 9.5,
  });
  const height = 22 + titleLines.length * 14 + bodyLines.length * 13 + 16;

  ensureSpace(state, height);

  setFillColor(state.document, colors.fill);
  setDrawColor(state.document, COLORS.border);
  state.document.roundedRect(state.margin, state.cursorY, state.contentWidth, height, 16, 16, "FD");

  setFillColor(state.document, colors.line);
  state.document.roundedRect(state.margin + 12, state.cursorY + 11, 5, height - 22, 2.5, 2.5, "F");

  state.document.setFont("helvetica", "bold");
  state.document.setFontSize(7);
  setTextColor(state.document, colors.text);
  state.document.text(label.toUpperCase(), state.margin + 25, state.cursorY + 18);

  drawLines(state, titleLines, state.margin + 25, state.cursorY + 31, {
    fontSize: 12,
    lineHeight: 14,
    color: COLORS.ink,
    fontStyle: "bold",
  });
  drawLines(state, bodyLines, state.margin + 25, state.cursorY + 31 + titleLines.length * 14 + 2, {
    fontSize: 9.5,
    lineHeight: 13,
    color: COLORS.ink,
  });

  state.cursorY += height + 8;
}

function drawBulletList(state: PdfState, items: string[]) {
  items.forEach((item) => {
    const bulletX = state.margin + 2;
    const textX = state.margin + 16;
    const lines = measureLines(state.document, item, state.contentWidth - 28, {
      fontSize: 11,
    });
    const height = lines.length * 15 + 6;
    ensureSpace(state, height);

    state.document.setFont("helvetica", "bold");
    state.document.setFontSize(11);
    setTextColor(state.document, COLORS.accent);
    state.document.text("-", bulletX, state.cursorY);

    drawLines(state, lines, textX, state.cursorY, {
      fontSize: 11,
      lineHeight: 15,
      color: COLORS.ink,
    });

    state.cursorY += lines.length * 15 + 6;
  });
}

function drawStepCard(state: PdfState, stepNumber: number, text: string) {
  const textLines = measureLines(state.document, text, state.contentWidth - 74, {
    fontSize: 11,
  });
  const height = Math.max(62, 28 + textLines.length * 15);

  ensureSpace(state, height);

  setFillColor(state.document, COLORS.accentSoft);
  setDrawColor(state.document, COLORS.border);
  state.document.roundedRect(state.margin, state.cursorY, state.contentWidth, height, 18, 18, "FD");

  setFillColor(state.document, COLORS.accent);
  state.document.circle(state.margin + 22, state.cursorY + 24, 13, "F");

  state.document.setFont("helvetica", "bold");
  state.document.setFontSize(10);
  setTextColor(state.document, COLORS.white);
  state.document.text(String(stepNumber), state.margin + 18.5, state.cursorY + 28);

  drawLines(state, textLines, state.margin + 48, state.cursorY + 22, {
    fontSize: 11,
    lineHeight: 15,
    color: COLORS.ink,
  });

  state.cursorY += height + 10;
}

function drawDocumentCard(state: PdfState, title: string, items: string[]) {
  const titleLines = measureLines(state.document, title, state.contentWidth - 28, {
    fontSize: 12,
    fontStyle: "bold",
  });
  const itemHeights = items.map((item) =>
    measureLines(state.document, item, state.contentWidth - 42, {
      fontSize: 10,
    }),
  );
  const height =
    24 +
    titleLines.length * 16 +
    itemHeights.reduce((total, lines) => total + lines.length * 15 + 4, 0) +
    10;

  ensureSpace(state, height);

  setFillColor(state.document, COLORS.panel);
  setDrawColor(state.document, COLORS.border);
  state.document.roundedRect(state.margin, state.cursorY, state.contentWidth, height, 18, 18, "FD");

  drawLines(state, titleLines, state.margin + 14, state.cursorY + 22, {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.ink,
    fontStyle: "bold",
  });

  let y = state.cursorY + 22 + titleLines.length * 16 + 4;
  itemHeights.forEach((lines) => {
    state.document.setFont("helvetica", "bold");
    state.document.setFontSize(10);
    setTextColor(state.document, COLORS.accent);
    state.document.text("-", state.margin + 14, y);

    drawLines(state, lines, state.margin + 26, y, {
      fontSize: 10,
      lineHeight: 15,
      color: COLORS.ink,
    });
    y += lines.length * 15 + 4;
  });

  state.cursorY += height + 10;
}

function drawTextPanel(state: PdfState, title: string, content: string) {
  const contentLines = measureLines(state.document, content, state.contentWidth - 28, {
    fontSize: 10,
    font: "courier",
  });
  const height = 42 + contentLines.length * 14;

  ensureSpace(state, height);

  setFillColor(state.document, COLORS.panel);
  setDrawColor(state.document, COLORS.border);
  state.document.roundedRect(state.margin, state.cursorY, state.contentWidth, height, 18, 18, "FD");

  drawLines(state, [title], state.margin + 14, state.cursorY + 20, {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.ink,
    fontStyle: "bold",
  });

  drawLines(state, contentLines, state.margin + 14, state.cursorY + 42, {
    font: "courier",
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.ink,
  });

  state.cursorY += height + 14;
}

function drawLinkItem(state: PdfState, title: string, description: string, url: string) {
  const titleLines = measureLines(state.document, title, state.contentWidth - 28, {
    fontSize: 12,
    fontStyle: "bold",
  });
  const descriptionLines = measureLines(state.document, description, state.contentWidth - 28, {
    fontSize: 10,
  });
  const urlLines = measureLines(state.document, url, state.contentWidth - 28, {
    fontSize: 10,
  });
  const height = 24 + titleLines.length * 16 + descriptionLines.length * 14 + urlLines.length * 14 + 14;

  ensureSpace(state, height);
  const startY = state.cursorY;

  setFillColor(state.document, COLORS.panel);
  setDrawColor(state.document, COLORS.border);
  state.document.roundedRect(state.margin, startY, state.contentWidth, height, 18, 18, "FD");

  drawLines(state, titleLines, state.margin + 14, startY + 20, {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.ink,
    fontStyle: "bold",
  });
  drawLines(state, descriptionLines, state.margin + 14, startY + 20 + titleLines.length * 16 + 2, {
    fontSize: 10,
    lineHeight: 14,
    color: COLORS.muted,
  });
  drawLines(
    state,
    urlLines,
    state.margin + 14,
    startY + 20 + titleLines.length * 16 + 2 + descriptionLines.length * 14 + 4,
    {
      fontSize: 10,
      lineHeight: 14,
      color: COLORS.accent,
    },
  );
  state.document.link(state.margin, startY, state.contentWidth, height, { url });

  state.cursorY += height + 10;
}

function drawPageFooters(document: jsPDF) {
  const pageCount = document.getNumberOfPages();
  const width = document.internal.pageSize.getWidth();
  const height = document.internal.pageSize.getHeight();

  for (let page = 1; page <= pageCount; page += 1) {
    document.setPage(page);
    setDrawColor(document, COLORS.border);
    document.line(42, height - 34, width - 42, height - 34);

    document.setFont("helvetica", "normal");
    document.setFontSize(9);
    setTextColor(document, COLORS.muted);
    document.text("Hjelpeveiviser · generert lokalt i nettleseren", 42, height - 18);

    const pageLabel = `Side ${page} av ${pageCount}`;
    const pageLabelWidth = document.getTextWidth(pageLabel);
    document.text(pageLabel, width - 42 - pageLabelWidth, height - 18);
  }
}

export function exportGuideResultToPdf(result: GuideResult) {
  const state = createPdfState();

  drawHero(state, result);
  drawCallout(
    state,
    "Viktig forbehold",
    "Dette er en veiviseroppsummering, ikke et juridisk dokument eller en offisiell tjeneste.",
    "Bruk dokumentet som støtte til å forberede kontakt, spørsmål og dokumentasjon. NAV, kommunen, Husbanken eller andre offentlige instanser må fortsatt gjøre en konkret vurdering av situasjonen din.",
    "warning",
  );

  if (result.acuteItems.length) {
    result.acuteItems.forEach((item) => {
      drawCallout(state, "Hva haster", item.rule.title, item.rule.summary, "warning");
    });
  }

  drawSectionHeading(state, "Anbefalt hovedspor", result.primaryRecommendation.recommendation.title);
  const primaryReasons = result.primaryRecommendation.reasons.length
    ? result.primaryRecommendation.reasons
    : ["Veiviseren har for lite informasjon til en mer presis prioritering, og foreslår derfor en trygg start med generell offentlig veiledning."];
  drawBulletList(state, primaryReasons);

  if (result.alternativeRecommendations.length) {
    state.cursorY += 6;
    drawSectionHeading(state, "Andre spor", "Dette kan også være relevant");
    result.alternativeRecommendations.forEach((item) => {
      drawCallout(state, item.recommendation.category, item.recommendation.title, item.recommendation.summary, "neutral");
    });
  }

  drawSectionHeading(state, "Forslag til videre steg", "Hva som kan være lurt å gjøre videre");
  result.nextSteps.forEach((step, index) => drawStepCard(state, index + 1, step));

  if (result.askForList.length) {
    drawSectionHeading(state, "Det kan være lurt å be om dette", "Gjør samtalen mer konkret");
    drawBulletList(state, result.askForList);
  }

  if (result.riskNotes.length) {
    drawSectionHeading(state, "Risiko og avgrensninger", "Forhold som kan endre vurderingen");
    drawCallout(
      state,
      "Viktig å vite",
      "Dette resultatet kan endre seg når riktig instans ser hele saken.",
      "Bruk punktene nedenfor som en påminnelse om hva som kan gjøre at et annet spor blir riktigere eller at hovedanbefalingen faller svakere ut.",
      "danger",
    );
    drawBulletList(state, result.riskNotes);
  }

  if (result.documentSections.length) {
    drawSectionHeading(state, "Dokumentasjon", "Samle dette først");
    result.documentSections.forEach((section) => {
      drawDocumentCard(state, section.title, section.items);
    });
  }

  drawSectionHeading(state, "Formulering", "Forslag til tekst ved kontakt eller videre oppfølging");
  drawTextPanel(state, "Utkast", result.contactDraft);

  if (result.officialLinks.length) {
    drawSectionHeading(state, "Hvem som kan hjelpe", "Kontaktpunkter videre");
    result.officialLinks.forEach((link) => {
      drawLinkItem(
        state,
        `${link.actionLabel} · ${link.publisher}`,
        link.whenRelevant ? `${link.description} ${link.whenRelevant}` : link.description,
        link.url,
      );
    });
  }

  drawSectionHeading(state, "Forbehold", "Bruk dokumentet med riktig forventning");
  result.disclaimers.forEach((disclaimer) => {
    drawCallout(state, "Forbehold", disclaimer.title, disclaimer.text, "danger");
  });

  drawPageFooters(state.document);
  state.document.save("hjelpeveiviser.pdf");
}
