type StatusBadgeProps = {
  tone?: "neutral" | "fact" | "warning" | "missing";
  children: string;
};

export function StatusBadge({ tone = "neutral", children }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
