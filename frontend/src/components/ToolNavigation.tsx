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
              className="inline-flex rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
            >
              {tool.label}
            </span>
          ) : (
            <Link
              to={tool.path}
              className="inline-flex rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-primary-600 hover:text-primary-700"
            >
              {tool.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  </nav>
);