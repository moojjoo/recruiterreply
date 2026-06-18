import React, { useState } from "react";
import { comparisonService } from "../services/api";
import { CompareOffersResponse, JobOffer } from "../types/index";

interface ComparisonToolProps {
  onResult: (result: CompareOffersResponse) => void;
}

const defaultOffer: JobOffer = {
  company: "",
  jobTitle: "",
  salary: 0,
  compensationType: "W2",
  contractLengthMonths: 12,
  benefitsEstimate: 0,
  commuteTimeMinutes: 0,
  workArrangement: "onsite",
};

export const ComparisonTool: React.FC<ComparisonToolProps> = ({ onResult }) => {
  const [offerOne, setOfferOne] = useState<JobOffer>({ ...defaultOffer });
  const [offerTwo, setOfferTwo] = useState<JobOffer>({ ...defaultOffer });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOfferOneChange = (field: keyof JobOffer, value: any) => {
    setOfferOne({ ...offerOne, [field]: value });
  };

  const handleOfferTwoChange = (field: keyof JobOffer, value: any) => {
    setOfferTwo({ ...offerTwo, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!offerOne.company.trim() || !offerTwo.company.trim()) {
      setError("Please enter company names for both offers");
      return;
    }

    if (
      !offerOne.salary ||
      !offerTwo.salary ||
      offerOne.salary <= 0 ||
      offerTwo.salary <= 0
    ) {
      setError("Please enter salary for both offers");
      return;
    }

    setLoading(true);
    try {
      const result = await comparisonService.compareOffers({
        offerOne,
        offerTwo,
      });
      onResult(result);
    } catch (err: any) {
      setError(
        err.response?.data?.error ||
          "Failed to compare offers. Check your OpenAI API key.",
      );
    } finally {
      setLoading(false);
    }
  };

  const OfferForm = ({ title, offer, onChange }: any) => (
    <div className="card">
      <h3 className="text-xl font-bold mb-4">{title}</h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-1">Company *</label>
          <input
            type="text"
            value={offer.company}
            onChange={(e) => onChange("company", e.target.value)}
            className="input-field"
            placeholder="Company name"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">
            Job Title *
          </label>
          <input
            type="text"
            value={offer.jobTitle}
            onChange={(e) => onChange("jobTitle", e.target.value)}
            className="input-field"
            placeholder="Job title"
            disabled={loading}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-semibold mb-1">Salary *</label>
            <div className="flex items-center gap-2">
              <span>$</span>
              <input
                type="number"
                value={offer.salary}
                onChange={(e) =>
                  onChange("salary", parseFloat(e.target.value) || 0)
                }
                className="input-field"
                placeholder="150000"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Type</label>
            <select
              value={offer.compensationType}
              onChange={(e) => onChange("compensationType", e.target.value)}
              className="input-field"
              disabled={loading}
            >
              <option>W2</option>
              <option>C2C</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-semibold mb-1">
              Contract Length (months)
            </label>
            <input
              type="number"
              value={offer.contractLengthMonths}
              onChange={(e) =>
                onChange("contractLengthMonths", parseInt(e.target.value) || 12)
              }
              className="input-field"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Benefits Estimate ($)
            </label>
            <input
              type="number"
              value={offer.benefitsEstimate}
              onChange={(e) =>
                onChange("benefitsEstimate", parseFloat(e.target.value) || 0)
              }
              className="input-field"
              placeholder="15000"
              disabled={loading}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm font-semibold mb-1">
              Commute (minutes)
            </label>
            <input
              type="number"
              value={offer.commuteTimeMinutes}
              onChange={(e) =>
                onChange("commuteTimeMinutes", parseInt(e.target.value) || 0)
              }
              className="input-field"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Work Arrangement
            </label>
            <select
              value={offer.workArrangement}
              onChange={(e) => onChange("workArrangement", e.target.value)}
              className="input-field"
              disabled={loading}
            >
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-1">Notes</label>
          <textarea
            value={offer.notes || ""}
            onChange={(e) => onChange("notes", e.target.value)}
            className="textarea-field h-20"
            placeholder="Any additional notes..."
            disabled={loading}
          />
        </div>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <OfferForm
          title="Offer 1"
          offer={offerOne}
          onChange={handleOfferOneChange}
        />
        <OfferForm
          title="Offer 2"
          offer={offerTwo}
          onChange={handleOfferTwoChange}
        />
      </div>

      {error && <p className="error-text mb-4">{error}</p>}

      <button type="submit" className="btn-primary w-full" disabled={loading}>
        {loading ? (
          <>
            <span className="loading mr-2"></span>
            Comparing...
          </>
        ) : (
          "Compare Offers"
        )}
      </button>
    </form>
  );
};
