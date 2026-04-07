type PublicNoticeProps = {
  compact?: boolean;
};

export function PublicNotice({ compact = false }: PublicNoticeProps) {
  return (
    <section className={compact ? "public-notice public-notice--compact" : "public-notice"}>
      <p className="public-notice__eyebrow">Personvernvennlig veiviser</p>
      <h3>Svarene dine blir bare brukt lokalt i nettleseren.</h3>
      <p>Veiviseren holder svarene midlertidig i nettlesersesjonen på denne enheten og bruker dem bare til å bygge anbefalinger, tekst og eksport lokalt.</p>
      <p>Verktøyet fatter ikke vedtak og erstatter ikke NAVs, kommunens, Husbankens eller helsetjenestens offisielle vurdering.</p>
    </section>
  );
}
