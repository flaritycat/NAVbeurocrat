import { useMemo, useState } from "react";
import { CopyBlock } from "../../components/CopyBlock";
import { InlineNotice } from "../../components/InlineNotice";
import { PublicNotice } from "../../components/PublicNotice";
import { defaultContentBundle } from "../../lib/contentBundle";
import { exportContentBundleJson, hasLocalContentDraft, resetContentBundleDraft, saveContentBundleDraft, useContentBundle } from "../../lib/contentDrafts";
import { isGuideContentBundle } from "../../lib/contentBundle";
import type { GuideContentBundle } from "../../lib/types";

const sectionLabels: Record<keyof GuideContentBundle, string> = {
  questions: "Spørsmål",
  recommendations: "Anbefalinger",
  acuteRules: "Akuttregler",
  documentLists: "Dokumentlister",
  phraseTemplates: "Formuleringstekster",
  officialLinks: "Offisielle lenker",
  disclaimers: "Forbehold",
};

export function AdminPage() {
  const bundle = useContentBundle();
  const [draftText, setDraftText] = useState(() => exportContentBundleJson(bundle));
  const [selectedSection, setSelectedSection] = useState<keyof GuideContentBundle>("questions");
  const [sectionDraftText, setSectionDraftText] = useState(() => JSON.stringify(bundle.questions, null, 2));
  const [notice, setNotice] = useState<{ tone: "warning" | "error"; message: string } | null>(null);

  const stats = useMemo(
    () => [
      `${bundle.questions.length} spørsmål`,
      `${bundle.recommendations.length} anbefalinger`,
      `${bundle.acuteRules.length} akuttregler`,
      `${bundle.officialLinks.length} offisielle lenker`,
    ],
    [bundle],
  );
  const sectionStats = useMemo(
    () =>
      (Object.keys(sectionLabels) as Array<keyof GuideContentBundle>).map((key) => ({
        key,
        label: sectionLabels[key],
        size: Array.isArray(bundle[key]) ? bundle[key].length : 1,
      })),
    [bundle],
  );

  function syncSectionDraft(nextSection: keyof GuideContentBundle) {
    setSelectedSection(nextSection);
    setSectionDraftText(JSON.stringify(bundle[nextSection], null, 2));
  }

  function handleSave() {
    setNotice(null);

    try {
      const parsed = JSON.parse(draftText) as unknown;
      if (!isGuideContentBundle(parsed)) {
        setNotice({
          tone: "error",
          message: "Konfigurasjonen mangler forventede seksjoner for spørsmål, regler, anbefalinger eller innhold.",
        });
        return;
      }

      saveContentBundleDraft(parsed);
      setNotice({
        tone: "warning",
        message: "Innholdet er lagret lokalt i denne nettleseren. Bruk eksport hvis du vil ta det videre til drift eller versjonskontroll.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Kunne ikke lese JSON-utkastet.",
      });
    }
  }

  function handleSectionSave() {
    setNotice(null);

    try {
      const parsedSection = JSON.parse(sectionDraftText) as unknown;
      const nextBundle = {
        ...bundle,
        [selectedSection]: parsedSection,
      } as GuideContentBundle;

      if (!isGuideContentBundle(nextBundle)) {
        setNotice({
          tone: "error",
          message: `Seksjonen ${sectionLabels[selectedSection].toLowerCase()} kunne ikke lagres fordi den brøt innholdsstrukturen.`,
        });
        return;
      }

      saveContentBundleDraft(nextBundle);
      setDraftText(exportContentBundleJson(nextBundle));
      setNotice({
        tone: "warning",
        message: `${sectionLabels[selectedSection]} er lagret lokalt. Den aktive konfigurasjonen i denne nettleseren er oppdatert.`,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        message: error instanceof Error ? error.message : "Kunne ikke lese seksjonsutkastet.",
      });
    }
  }

  function handleReset() {
    const confirmed = window.confirm("Vil du fjerne lokal innholdsredigering og gå tilbake til standardinnholdet?");
    if (!confirmed) {
      return;
    }

    resetContentBundleDraft();
    setDraftText(exportContentBundleJson(defaultContentBundle));
    setNotice({
      tone: "warning",
      message: "Lokal innholdsredigering er fjernet fra denne nettleseren.",
    });
  }

  function handleReloadCurrent() {
    setDraftText(exportContentBundleJson(bundle));
    setNotice(null);
  }

  return (
    <div className="page stack">
      <section className="hero-card hero-card--single">
        <div>
          <p className="eyebrow">Lokal innholdsredigering</p>
          <h1>Rediger spørsmål, tekster og lenker uten å lagre brukersvar på server.</h1>
          <p className="lead">
            Denne siden er en enkel forberedelse for innholdsredigering. Endringer lagres bare lokalt i nettleseren til
            du velger å eksportere dem videre.
          </p>
        </div>
      </section>

      <PublicNotice />

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Innholdsmodell</p>
            <h2>Oversikt</h2>
          </div>
        </div>
        <div className="stats-row">
          {stats.map((item) => (
            <div className="signal-card" key={item}>
              <strong>{item}</strong>
            </div>
          ))}
        </div>
        {hasLocalContentDraft() ? (
          <InlineNotice tone="warning">Det finnes en lokal innholdsdraft i denne nettleseren som overstyrer standardinnholdet.</InlineNotice>
        ) : null}
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Seksjonsredigering</p>
            <h2>Rediger en del av innholdet om gangen</h2>
          </div>
        </div>

        <div className="stats-row">
          {sectionStats.map((section) => (
            <button
              className={selectedSection === section.key ? "signal-card signal-card--selected" : "signal-card"}
              key={section.key}
              onClick={() => syncSectionDraft(section.key)}
              type="button"
            >
              <strong>{section.label}</strong>
              <span>{`${section.size} element`}</span>
            </button>
          ))}
        </div>

        <label className="field">
          <span>{`${sectionLabels[selectedSection]} i aktiv konfigurasjon`}</span>
          <textarea className="admin-textarea" rows={18} value={sectionDraftText} onChange={(event) => setSectionDraftText(event.target.value)} />
        </label>

        <div className="action-row">
          <button className="primary-button" onClick={handleSectionSave} type="button">
            Lagre valgt seksjon
          </button>
          <button className="ghost-button" onClick={() => setSectionDraftText(JSON.stringify(bundle[selectedSection], null, 2))} type="button">
            Last inn valgt seksjon på nytt
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Rediger JSON</p>
            <h2>Spørsmål, regler, anbefalinger og lenker</h2>
          </div>
        </div>

        {notice ? <InlineNotice tone={notice.tone}>{notice.message}</InlineNotice> : null}

        <label className="field">
          <span>Konfigurasjon</span>
          <textarea className="admin-textarea" rows={28} value={draftText} onChange={(event) => setDraftText(event.target.value)} />
        </label>

        <div className="action-row">
          <button className="primary-button" onClick={handleSave} type="button">
            Lagre lokalt
          </button>
          <button className="ghost-button" onClick={handleReloadCurrent} type="button">
            Last inn aktiv versjon
          </button>
          <button className="ghost-button" onClick={handleReset} type="button">
            Tilbakestill til standard
          </button>
        </div>
      </section>

      <CopyBlock content={exportContentBundleJson(bundle)} title="Aktiv konfigurasjon akkurat nå" />
    </div>
  );
}
