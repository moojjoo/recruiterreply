import React from "react";

interface SidebarProps {
  children: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  return (
    <aside className="w-64 bg-gray-50 border-r border-gray-200 p-6">
      {children}
    </aside>
  );
};
