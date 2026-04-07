import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { PublicNotice } from "./PublicNotice";

type LayoutProps = {
  children: ReactNode;
};

export function Layout({ children }: LayoutProps) {
  return (
    <div className="shell">
      <header className="shell__header">
        <div className="shell__brand">
          <Link className="brand" to="/">
            nav
          </Link>
          <p className="brand__subtitle">
            Rolig, stegvis veiledning for å finne støtte, rettigheter og riktige første kontaktpunkter hos NAV,
            kommunen, Husbanken, helse eller andre offentlige hjelpespor.
          </p>
          <PublicNotice compact />
        </div>

        <nav className="topnav">
          <NavLink to="/" end>
            Forside
          </NavLink>
          <NavLink to="/guide">Veiviser</NavLink>
          <NavLink to="/letterscan">Brevscanner</NavLink>
          <NavLink to="/result">Resultat</NavLink>
          <NavLink to="/admin">Innhold</NavLink>
        </nav>
      </header>

      <main className="shell__main">{children}</main>
    </div>
  );
}
