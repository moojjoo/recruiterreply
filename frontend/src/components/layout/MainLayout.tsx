import React from "react";
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
      </div>
    </footer>
  );
};
