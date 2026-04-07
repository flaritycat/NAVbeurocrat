import type { ReactNode } from "react";
import { sanitizeHttpUrl } from "../lib/urls";

type SafeExternalLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

export function SafeExternalLink({ href, className, children }: SafeExternalLinkProps) {
  const safeHref = sanitizeHttpUrl(href);
  if (!safeHref) {
    return null;
  }

  return (
    <a className={className} href={safeHref} rel="noreferrer noopener" target="_blank">
      {children}
    </a>
  );
}
