type ChecklistPanelProps = {
  title: string;
  intro: string;
  items: Array<{
    id: string;
    label: string;
    checked: boolean;
  }>;
  onToggle: (id: string, checked: boolean) => void;
  onReset: () => void;
};

export function ChecklistPanel({ title, intro, items, onToggle, onReset }: ChecklistPanelProps) {
  const completed = items.filter((item) => item.checked).length;

  return (
    <section className="card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Lokal sjekkliste</p>
          <h2>{title}</h2>
        </div>
        <button className="ghost-button" onClick={onReset} type="button">
          Nullstill
        </button>
      </div>
      <p>{intro}</p>
      <p className="checklist-progress">{`${completed} av ${items.length} punkt markert`}</p>
      <div className="stack stack--tight">
        {items.map((item) => (
          <label className={item.checked ? "choice-card is-selected" : "choice-card"} key={item.id}>
            <input checked={item.checked} onChange={(event) => onToggle(item.id, event.target.checked)} type="checkbox" />
            <div>
              <strong>{item.label}</strong>
            </div>
          </label>
        ))}
      </div>
    </section>
  );
}
