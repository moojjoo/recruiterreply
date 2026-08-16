import React, { useState } from "react";
import { AnalyzeMessageResponse } from "../types/index";

interface AnalysisResultProps {
  result: AnalyzeMessageResponse | null;
  loading: boolean;
  error: string | null;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({
  result,
  loading,
  error,
}) => {
  const [copied, setCopied] = useState(false);

  if (!result && !loading && !error) {
    return null;
  }

  if (loading) {
    return (
      <div className="card-elevated">
        <div className="flex items-center justify-center py-12">
          <span className="spinner mr-3" aria-hidden="true"></span>
          <span className="text-lg text-gray-700">
            Analyzing your message...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error" role="alert">
        <span>⚠️</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!result) {
    return null;
  }

  const getScoreBadge = (score: number) => {
    if (score >= 75)
      return {
        color: "success",
        label: "⭐ Excellent",
        description: "Strong opportunity",
      };
    if (score >= 50)
      return {
        color: "info",
        label: "👍 Good",
        description: "Worth exploring",
      };
    if (score >= 25)
      return {
        color: "warning",
        label: "🤔 Moderate",
        description: "Some concerns",
      };
    return {
      color: "danger",
      label: "⚠️ Poor",
      description: "Multiple red flags",
    };
  };

  const scoreBadge = getScoreBadge(result.opportunityScore);

  return (
    <div className="space-y-6">
      {/* Opportunity Score Card */}
      <div className="card-elevated bg-gradient-to-br from-primary-50 to-accent-50">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">
          📊 Analysis Results
        </h2>

        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-gray-600 mb-2">Opportunity Score</p>
            <div className="flex items-baseline gap-3">
              <span className="text-6xl font-bold bg-gradient-to-r from-primary-600 to-accent-600 bg-clip-text text-transparent">
                {result.opportunityScore}
              </span>
              <span className="text-xl text-gray-700">/ 100</span>
            </div>
          </div>
          <div className={`px-6 py-4 rounded-xl text-center`}>
            <p className="text-2xl font-bold mb-1">{scoreBadge.label}</p>
            <p className="text-gray-700 font-medium">
              {scoreBadge.description}
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              result.opportunityScore >= 75
                ? "bg-success-600"
                : result.opportunityScore >= 50
                  ? "bg-primary-600"
                  : result.opportunityScore >= 25
                    ? "bg-amber-600"
                    : "bg-red-600"
            }`}
            style={{ width: `${result.opportunityScore}%` }}
            role="progressbar"
            aria-valuenow={result.opportunityScore}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
      </div>

      {/* Key Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-bold text-gray-900 mb-3">💰 Compensation</h3>
          <p className="text-lg text-gray-700">
            {result.compensationMentioned}
          </p>
        </div>

        <div className="card">
          <h3 className="font-bold text-gray-900 mb-3">💼 Job Type</h3>
          <div className="flex flex-wrap gap-2">
            {result.jobType.split(",").map((type: string, idx: number) => (
              <span key={idx} className="badge badge-info">
                {type.trim()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Red Flags */}
      {result.redFlags && result.redFlags.length > 0 && (
        <div className="card border-l-4 border-red-600 bg-red-50">
          <h3 className="font-bold text-red-900 mb-4 flex items-center gap-2">
            <span>🚩</span> Red Flags
          </h3>
          <ul className="space-y-3">
            {result.redFlags.map((flag: string, index: number) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-red-600 font-bold flex-shrink-0">●</span>
                <span className="text-red-900">{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Questions to Ask */}
      {result.questionsToAsk && result.questionsToAsk.length > 0 && (
        <div className="card border-l-4 border-primary-600 bg-primary-50">
          <h3 className="font-bold text-primary-900 mb-4 flex items-center gap-2">
            <span>❓</span> Questions to Ask
          </h3>
          <ul className="space-y-3">
            {result.questionsToAsk.map((question: string, index: number) => (
              <li key={index} className="flex items-start gap-3">
                <span className="text-primary-600 font-bold flex-shrink-0">
                  {index + 1}.
                </span>
                <span className="text-primary-900">{question}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Response */}
      {result.suggestedResponse && (
        <div className="card-elevated bg-gradient-to-br from-success-50 to-accent-50 border-l-4 border-success-600">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
            <span>✨</span> Suggested Response
          </h3>
          <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
            <p className="text-gray-800 whitespace-pre-wrap leading-relaxed font-mono text-sm">
              {result.suggestedResponse}
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              navigator.clipboard.writeText(result.suggestedResponse);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            aria-label="Copy suggested response to clipboard"
          >
            {copied ? "✓ Copied!" : "📋 Copy Response"}
          </button>
        </div>
      )}
    </div>
  );
};
