import React, { useState } from "react";
import { ReplyGenerator } from "../components/ReplyGenerator";
import { ReplyResult } from "../components/ReplyResult";
import { GenerateReplyResponse } from "../types/index";
import { MainLayout } from "../components/layout/MainLayout";

export const ReplyPage: React.FC = () => {
  const [result, setResult] = useState<GenerateReplyResponse | null>(null);

  return (
    <MainLayout>
      <main>
        {/* Page Header */}
        <section className="bg-gradient-to-r from-accent-50 to-primary-50 py-12">
          <div className="container">
            <h1 className="section-title">✉️ Reply Generator</h1>
            <p className="section-subtitle text-lg">
              Craft compelling responses that showcase your professionalism
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="container py-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <ReplyGenerator onResult={(res) => setResult(res)} />
            </div>

            {/* Info Sidebar */}
            <div className="space-y-6">
              <div className="card bg-accent-50 border-2 border-accent-200">
                <h3 className="font-bold text-accent-900 mb-3">
                  💬 Reply Types
                </h3>
                <ul className="space-y-2 text-sm text-accent-800">
                  <li>
                    • <strong>Interested</strong> - Express enthusiasm
                  </li>
                  <li>
                    • <strong>Ask Details</strong> - Get more info
                  </li>
                  <li>
                    • <strong>Counteroffer</strong> - Negotiate terms
                  </li>
                  <li>
                    • <strong>Decline</strong> - Polite rejection
                  </li>
                  <li>
                    • <strong>Followup</strong> - Re-engage recruiters
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="mt-12">
              <ReplyResult result={result} />
            </div>
          )}
        </section>
      </main>
    </MainLayout>
  );
};
