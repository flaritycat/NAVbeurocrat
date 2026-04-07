import { useMemo, useState } from "react";
import { CopyBlock } from "../../components/CopyBlock";
import { InlineNotice } from "../../components/InlineNotice";
import { PublicNotice } from "../../components/PublicNotice";
import { defaultContentBundle } from "../../lib/contentBundle";
import { exportContentBundleJson, hasLocalContentDraft, resetContentBundleDraft, saveContentBundleDraft, useContentBundle } from "../../lib/contentDrafts";
import { isGuideContentBundle } from "../../lib/contentBundle";

export function AdminPage() {
  const bundle = useContentBundle();
  const [draftText, setDraftText] = useState(() => exportContentBundleJson(bundle));
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
