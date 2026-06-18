import React from "react";
import { CompareOffersResponse } from "../types/index";

interface ComparisonResultProps {
  result: CompareOffersResponse | null;
}

export const ComparisonResult: React.FC<ComparisonResultProps> = ({
  result,
}) => {
  if (!result) return null;

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getRiskColor = (risk: string | undefined) => {
    if (!risk) return "badge-info";
    switch (risk.toLowerCase()) {
      case "low":
        return "badge-success";
      case "medium":
        return "badge-warning";
      case "high":
        return "badge-danger";
      default:
        return "badge-info";
    }
  };

  return (
    <div className="card mt-6">
      <h2 className="text-2xl font-bold mb-6">Comparison Results</h2>

      {result.bestOffer && (
        <div className="bg-blue-50 border-2 border-blue-500 rounded-lg p-4 mb-6">
          <p className="text-center text-lg font-bold text-blue-900">
            🏆 Recommended: <span className="text-2xl">{result.bestOffer}</span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-xl font-bold mb-4">Offer 1 - Analysis</h3>

          <div className="mb-4">
            <p className="text-sm text-gray-600">Estimated Annual Value</p>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(result.estimatedAnnualValueOne)}
            </p>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Risk Level</p>
            <span className={`badge ${getRiskColor(result.riskLevelOne)}`}>
              {result.riskLevelOne}
            </span>
          </div>

          {result.prosOne && result.prosOne.length > 0 && (
            <div className="mb-4">
              <p className="font-semibold text-green-700 mb-2">✓ Pros</p>
              <ul className="space-y-1">
                {result.prosOne.map((pro, index) => (
                  <li key={index} className="text-sm text-gray-700">
                    • {pro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.consOne && result.consOne.length > 0 && (
            <div>
              <p className="font-semibold text-red-700 mb-2">✗ Cons</p>
              <ul className="space-y-1">
                {result.consOne.map((con, index) => (
                  <li key={index} className="text-sm text-gray-700">
                    • {con}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-xl font-bold mb-4">Offer 2 - Analysis</h3>

          <div className="mb-4">
            <p className="text-sm text-gray-600">Estimated Annual Value</p>
            <p className="text-3xl font-bold text-green-600">
              {formatCurrency(result.estimatedAnnualValueTwo)}
            </p>
          </div>

          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">Risk Level</p>
            <span className={`badge ${getRiskColor(result.riskLevelTwo)}`}>
              {result.riskLevelTwo}
            </span>
          </div>

          {result.prosTwo && result.prosTwo.length > 0 && (
            <div className="mb-4">
              <p className="font-semibold text-green-700 mb-2">✓ Pros</p>
              <ul className="space-y-1">
                {result.prosTwo.map((pro, index) => (
                  <li key={index} className="text-sm text-gray-700">
                    • {pro}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.consTwo && result.consTwo.length > 0 && (
            <div>
              <p className="font-semibold text-red-700 mb-2">✗ Cons</p>
              <ul className="space-y-1">
                {result.consTwo.map((con, index) => (
                  <li key={index} className="text-sm text-gray-700">
                    • {con}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {result.recommendation && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-bold text-yellow-900 mb-2">💡 Recommendation</h3>
          <p className="text-gray-700 whitespace-pre-wrap">
            {result.recommendation}
          </p>
        </div>
      )}
    </div>
  );
};
