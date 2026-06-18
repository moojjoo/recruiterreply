import React, { useState } from "react";
import { ComparisonTool } from "../components/ComparisonTool";
import { ComparisonResult } from "../components/ComparisonResult";
import { CompareOffersResponse } from "../types/index";
import { MainLayout } from "../components/layout/MainLayout";

export const ComparisonPage: React.FC = () => {
  const [result, setResult] = useState<CompareOffersResponse | null>(null);

  return (
    <MainLayout>
      <main>
        {/* Page Header */}
        <section className="bg-gradient-to-r from-success-50 to-primary-50 py-12">
          <div className="container">
            <h1 className="section-title">⚖️ Offer Comparison</h1>
            <p className="section-subtitle text-lg">
              Make data-driven decisions with AI-powered offer analysis
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="container py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <ComparisonTool onResult={(res) => setResult(res)} />
            </div>

            {/* Info Sidebar */}
            <div className="space-y-6">
              <div className="card bg-success-50 border-2 border-success-200">
                <h3 className="font-bold text-success-900 mb-3">
                  📋 What We Compare
                </h3>
                <ul className="space-y-2 text-sm text-success-800">
                  <li>✓ Base salary & equity</li>
                  <li>✓ Benefits & perks</li>
                  <li>✓ Work arrangement</li>
                  <li>✓ Company stability</li>
                  <li>✓ Growth potential</li>
                  <li>✓ Work-life balance</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="mt-12">
              <ComparisonResult result={result} />
            </div>
          )}
        </section>
      </main>
    </MainLayout>
  );
};
