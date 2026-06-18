import React, { useState, memo } from "react";
import { analysisService } from "../services/api";
import { AnalyzeMessageResponse } from "../types/index";

interface AnalyzerProps {
  onResult: (result: AnalyzeMessageResponse) => void;
}

export const MessageAnalyzer: React.FC<AnalyzerProps> = memo(({ onResult }) => {
  const [message, setMessage] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!message.trim()) {
      setError("Please paste a recruiter message");
      return;
    }

    setLoading(true);
    try {
      const result = await analysisService.analyzeMessage({
        recruiterMessage: message,
        companyName: company || undefined,
        jobTitle: jobTitle || undefined,
      });
      onResult(result);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to analyze message. Check your OpenAI API key.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-elevated">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        Paste Your Message
      </h2>

      <div className="form-group">
        <label className="form-label">Recruiter Message *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="textarea-field h-40"
          placeholder="Paste the full recruiter email or message here..."
          disabled={loading}
          aria-label="Recruiter message input"
          required
        />
        <p className="text-xs text-gray-500 mt-2">
          Include all context for best results
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="form-group">
          <label className="form-label">Company (Optional)</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="input-field"
            placeholder="e.g., TechCorp Inc"
            disabled={loading}
            aria-label="Company name"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Job Title (Optional)</label>
          <input
            type="text"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            className="input-field"
            placeholder="e.g., Senior Engineer"
            disabled={loading}
            aria-label="Job title"
          />
        </div>
      </div>

      {error && (
        <div className="alert alert-error mb-6" role="alert">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={loading}
        aria-busy={loading}
      >
        {loading ? (
          <>
            <span className="spinner mr-2" aria-hidden="true"></span>
            <span>Analyzing...</span>
          </>
        ) : (
          "✨ Analyze Message"
        )}
      </button>
    </form>
  );
});

MessageAnalyzer.displayName = "MessageAnalyzer";
