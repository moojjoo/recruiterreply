import React from "react";
import { useAuth } from "../../hooks/useAuth";
import { Button } from "../common/Button";

export const Navbar: React.FC = () => {
  const { user, logout, isAuthenticated } = useAuth();

  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-40 border-b border-gray-200">
      <div className="container flex items-center justify-between py-4">
        <a href="/" className="flex items-center gap-2">
          <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
            RecruiterReply
          </span>
        </a>

        <div className="flex items-center gap-4">
          {isAuthenticated && user && (
            <>
              <span className="text-sm text-gray-600">
                Welcome, {user.name}
              </span>
              <Button variant="secondary" size="sm" onClick={logout}>
                Logout
              </Button>
            </>
          )}
          {!isAuthenticated && (
            <>
              <a
                href="/login"
                className="text-sm font-medium text-gray-700 hover:text-primary-600"
              >
                Login
              </a>
              <Button
                size="sm"
                onClick={() => (window.location.href = "/register")}
              >
                Sign Up
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};
