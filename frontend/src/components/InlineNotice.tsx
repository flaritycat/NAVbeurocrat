import type { ReactNode } from "react";

type InlineNoticeProps = {
  tone?: "warning" | "error";
  children: ReactNode;
};

export function InlineNotice({ tone = "warning", children }: InlineNoticeProps) {
  return <div className={`inline-notice inline-notice--${tone}`}>{children}</div>;
}
