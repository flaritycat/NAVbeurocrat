import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { PublicNotice } from "./PublicNotice";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isFocusedFlow = location.pathname === "/guide" || location.pathname === "/letterscan";
  const isWorkSurface =
    isFocusedFlow ||
    location.pathname === "/result" ||
    location.pathname === "/brief" ||
    location.pathname === "/call";
  const navClassName = isFocusedFlow
    ? "topnav topnav--focused topnav--question-flow"
    : isWorkSurface
      ? "topnav topnav--focused"
      : "topnav";
  const navItemClass = (variant: string) =>
    ({ isActive }: { isActive: boolean }) => `${variant}${isActive ? " active" : ""}`;

  return (
    <div className="shell">
      <header className={isWorkSurface ? "shell__header shell__header--focused" : "shell__header"}>
        <div className={isWorkSurface ? "shell__brand shell__brand--focused" : "shell__brand"}>
          <div className="shell__brand-row">
            <Link className="brand" to="/">
              nav
            </Link>
            {isWorkSurface ? <span className="work-badge">Lokal økt · ikke vedtak</span> : null}
          </div>
          {!isWorkSurface ? (
            <p className="brand__subtitle">
              Rolig, stegvis veiledning for å finne støtte, rettigheter og riktige første kontaktpunkter hos NAV,
              kommunen, Husbanken, helse eller andre offentlige hjelpespor.
            </p>
          ) : null}
          {!isWorkSurface ? <PublicNotice compact /> : null}
        </div>

        <nav className={navClassName}>
          <NavLink className={navItemClass("topnav__item topnav__item--secondary")} to="/" end>
            Forside
          </NavLink>
          <NavLink className={navItemClass("topnav__item topnav__item--primary")} to="/guide">
            Veiviser
          </NavLink>
          <NavLink className={navItemClass("topnav__item topnav__item--primary")} to="/letterscan">
            Brevscanner
          </NavLink>
          <NavLink className={navItemClass("topnav__item topnav__item--primary")} to="/result">
            Resultat
          </NavLink>
          <NavLink className={navItemClass("topnav__item topnav__item--secondary")} to="/call">
            Ringekort
          </NavLink>
          <NavLink className={navItemClass("topnav__item topnav__item--utility")} to="/admin">
            Innhold
          </NavLink>
        </nav>
      </header>

      <main className="shell__main">{children}</main>
    </div>
  );
}
