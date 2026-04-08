type ProgressBarProps = {
  current: number;
  total: number;
};

export function ProgressBar({ current, total }: ProgressBarProps) {
  const safeTotal = Math.max(total, 1);
  const percent = Math.round((Math.min(current, safeTotal) / safeTotal) * 100);

  return (
    <section className="card progress-card">
      <div className="progress-card__meta">
        <span className="progress-card__label">Fremdrift</span>
        <strong className="progress-card__count">
          {Math.min(current, safeTotal)}/{safeTotal}
        </strong>
      </div>
      <div aria-label="Fremdrift" aria-valuemax={100} aria-valuemin={0} aria-valuenow={percent} className="progress" role="progressbar">
        <div className="progress__bar" style={{ width: `${percent}%` }} />
      </div>
    </section>
  );
}
