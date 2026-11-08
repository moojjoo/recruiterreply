import React from "react";
import { Link } from "react-router-dom";
import { Navbar } from "./Navbar";

interface MainLayoutProps {
  children: React.ReactNode;
  withSidebar?: boolean;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  withSidebar = false,
}) => {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />
      <main className="flex-1 container py-8">
        {withSidebar ? <div className="flex gap-8">{children}</div> : children}
      </main>
      <Footer />
    </div>
  );
};

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-12">
      <div className="container text-center text-sm text-gray-600">
        <p>&copy; 2026 RecruiterReply. All rights reserved.</p>
        <Link to="/policy" className="inline-block mt-2 text-primary-800 hover:underline">
          Privacy Policy
        </Link>
        <span className="mx-2 text-gray-400">|</span>
        <Link to="/cookies" className="text-primary-800 hover:underline">Cookie Policy</Link>
        <span className="mx-2 text-gray-400">|</span>
        <button type="button" className="text-primary-800 hover:underline" onClick={() => window.dispatchEvent(new Event("rr-open-cookie-settings"))}>Cookie Settings</button>
        <span className="mx-2 text-gray-400">|</span>
        <Link to="/terms" className="text-primary-800 hover:underline">
          Terms and Conditions
        </Link>
        <span className="mx-2 text-gray-400">|</span>
        <Link to="/guides/how-to-reply-to-a-recruiter" className="text-primary-800 hover:underline">Recruiter reply guide</Link>
        <span className="mx-2 text-gray-400">|</span>
        <Link to="/guides/compare-job-offers" className="text-primary-800 hover:underline">Compare offers</Link>
        <span className="mx-2 text-gray-400">|</span>
        <Link to="/guides/salary-negotiation-email" className="text-primary-800 hover:underline">Salary negotiation</Link>
        <span className="mx-2 text-gray-400">|</span>
        <Link to="/#why-recruiterreply" className="text-primary-800 hover:underline">Why RecruiterReply</Link>
        <span className="mx-2 text-gray-400">|</span>
        <Link to="#top" className="text-primary-800 hover:underline">Back to top</Link>
      </div>
    </footer>
  );
};
