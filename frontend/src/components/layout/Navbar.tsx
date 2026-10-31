import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../common/Button";
import { ThemeToggle } from "../common/ThemeToggle";

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const brandDestination = isAuthenticated ? "/dashboard" : "/";

  return (
    <nav aria-label="Primary navigation" className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200">
      <div className="container flex items-center justify-between gap-2 py-3">
        <Link to={brandDestination} aria-label="RecruiterReply" className="flex min-w-0 shrink-0 items-center gap-2">
          <img src="/recruiterreply-mark.svg" alt="" aria-hidden="true" className="h-8 w-8 sm:h-9 sm:w-9" />
          <span className="brand-wordmark font-bold">
            <span>Recruiter</span>
            <span>Reply</span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <button type="button" className="mobile-menu-toggle md:hidden" aria-expanded={menuOpen}
            aria-controls="primary-navigation-links" aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={() => setMenuOpen((open) => !open)} onKeyDown={(event) => { if (event.key === "Escape") setMenuOpen(false); }}>
            <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {menuOpen ? <path d="M5 5l14 14M19 5L5 19" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <div id="primary-navigation-links" className={`nav-actions ${menuOpen ? "nav-actions-open" : ""}`}>
            <a href="/pricing" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 hover:text-primary-600">Pricing</a>
            {isAuthenticated && user ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setMenuOpen(false)}
                  className="text-sm font-medium text-gray-700 hover:text-primary-600"
                >
                  Profile & billing
                </Link>
                <span className="text-sm text-gray-600">Welcome, {user.name}</span>
                <Button variant="secondary" size="sm" onClick={() => { setMenuOpen(false); logout(); }}>Logout</Button>
              </>
            ) : (
              <>
                <a href="/login" onClick={() => setMenuOpen(false)} className="text-sm font-medium text-gray-700 hover:text-primary-600">Login</a>
                <a href="/register" className="btn-primary px-3 py-1.5 text-sm">Sign Up</a>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};
