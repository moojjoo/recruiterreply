import React from "react";
import { Link } from "react-router-dom";

type ToolPath = "/analyze" | "/reply" | "/compare";

interface ToolNavigationProps {
  currentTool: ToolPath;
}

const tools: { label: string; path: ToolPath }[] = [
  { label: "Analyze Messages", path: "/analyze" },
  { label: "Generate Replies", path: "/reply" },
  { label: "Compare Offers", path: "/compare" },
];

export const ToolNavigation: React.FC<ToolNavigationProps> = ({
  currentTool,
}) => (
  <nav aria-label="Tools" className="mt-6">
    <ul className="flex flex-wrap gap-2">
      {tools.map((tool) => (
        <li key={tool.path}>
          {tool.path === currentTool ? (
            <span
              aria-current="page"
              aria-disabled="true"
              className="tool-nav-tab tool-nav-tab-active inline-flex rounded-md border px-4 py-2 text-sm font-semibold"
            >
              {tool.label}
            </span>
          ) : (
            <Link
              to={tool.path}
              className="tool-nav-tab inline-flex rounded-md border px-4 py-2 text-sm font-medium transition-colors"
            >
              {tool.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  </nav>
);