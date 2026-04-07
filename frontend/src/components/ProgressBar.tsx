type ProgressBarProps = {
  current: number;
  total: number;
};

export function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.round((Math.min(current, safeTotal) / safeTotal) * 100);

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Fremdrift</p>
          <h3>
            Steg {Math.min(current, safeTotal)} av {safeTotal}
          </h3>
        </div>
        <strong>{percent}%</strong>
      </div>
      <div aria-label="Fremdrift" aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="progress" role="progressbar">
        <div className="progress__bar" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
