import React, { useState } from "react";
import { AxiosError } from "axios";
import { replyService } from "../services/api";
import { GenerateReplyResponse } from "../types/index";

interface ReplyGeneratorProps {
  onResult: (result: GenerateReplyResponse) => void;
}

const replyTypes = [
  {
    value: "interested",
    label: "Interested",
    description: "Express interest in the opportunity",
  },
  {
    value: "request_pay_range",
    label: "Request Pay Range",
    description: "Ask about compensation",
  },
  {
    value: "counteroffer",
    label: "Counteroffer",
    description: "Make a counteroffer on salary/terms",
  },
  {
    value: "decline",
    label: "Decline Politely",
    description: "Politely decline the opportunity",
  },
  {
    value: "followup",
    label: "Follow-up",
    description: "Follow up on a previous conversation",
  },
];

export const ReplyGenerator: React.FC<ReplyGeneratorProps> = ({ onResult }) => {
  const [replyType, setReplyType] = useState("interested");
  const [message, setMessage] = useState("");
  const [minimumPay, setMinimumPay] = useState("");
  const [workArrangement, setWorkArrangement] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!message.trim()) {
      setError("Please paste the recruiter message");
      return;
    }

    setLoading(true);
    try {
      const result = await replyService.generateReply({
        replyType,
        recruiterMessage: message,
        candidateMinimumPay: minimumPay ? parseFloat(minimumPay) : undefined,
        preferredWorkArrangement: workArrangement || undefined,
        notes: notes || undefined,
      });
      onResult(result);
    } catch (err) {
      const message =
        err instanceof AxiosError ? err.response?.data?.error : undefined;
      setError(message || "Failed to generate reply. Check your OpenAI API key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card-elevated">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">
        Generate Your Reply
      </h2>

      <div className="form-group">
        <label className="form-label">Reply Type *</label>
        <div className="space-y-2">
          {replyTypes.map((type) => (
            <label
              key={type.value}
              className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-accent-300 hover:bg-accent-50 transition-all"
            >
              <input
                type="radio"
                name="replyType"
                value={type.value}
                checked={replyType === type.value}
                onChange={(e) => setReplyType(e.target.value)}
                className="mt-1 w-4 h-4 accent-accent-600"
                disabled={loading}
                aria-label={type.label}
              />
              <div className="flex-1">
                <div className="font-semibold text-gray-900">{type.label}</div>
                <div className="text-sm text-gray-600">{type.description}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Recruiter Message *</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="textarea-field h-32"
          placeholder="Paste the recruiter's email or message..."
          disabled={loading}
          aria-label="Recruiter message"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="form-group">
          <label className="form-label">Minimum Pay (Optional)</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-semibold">$</span>
            <input
              type="number"
              value={minimumPay}
              onChange={(e) => setMinimumPay(e.target.value)}
              className="input-field flex-1"
              placeholder="e.g., 120000"
              disabled={loading}
              aria-label="Minimum pay"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Work Arrangement (Optional)</label>
          <select
            value={workArrangement}
            onChange={(e) => setWorkArrangement(e.target.value)}
            className="input-field"
            disabled={loading}
            aria-label="Work arrangement preference"
          >
            <option value="">Select arrangement</option>
            <option value="remote">🏠 Remote</option>
            <option value="hybrid">🔄 Hybrid</option>
            <option value="onsite">🏢 On-site</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Additional Notes (Optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="textarea-field h-20"
          placeholder="Any additional context or preferences..."
          disabled={loading}
          aria-label="Additional notes"
        />
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
            <span>Generating...</span>
          </>
        ) : (
          "✍️ Generate Reply"
        )}
      </button>
    </form>
  );
};
