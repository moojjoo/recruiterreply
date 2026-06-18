import React, { useState, useCallback } from "react";
import { MessageAnalyzer } from "../components/MessageAnalyzer";
import { AnalysisResult } from "../components/AnalysisResult";
import { AnalyzeMessageResponse } from "../types/index";
import { MainLayout } from "../components/layout/MainLayout";

export const AnalysisPage: React.FC = () => {
  const [result, setResult] = useState<AnalyzeMessageResponse | null>(null);

  const handleResult = useCallback((res: AnalyzeMessageResponse) => {
    setResult(res);
  }, []);

  return (
    <MainLayout>
      <main>
        {/* Page Header */}
        <section className="bg-gradient-to-r from-primary-50 to-accent-50 py-12 -mx-4 -mt-8 mb-8 px-4">
          <div className="container">
            <h1 className="section-title">📊 Message Analyzer</h1>
            <p className="section-subtitle text-lg">
              Decode recruiter messages with AI-powered intelligence
            </p>
          </div>
        </section>

        {/* Content */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <MessageAnalyzer onResult={handleResult} />
            </div>

            {/* Info Sidebar */}
            <div className="space-y-6">
              <div className="card bg-primary-50 border-2 border-primary-200">
                <h3 className="font-bold text-primary-900 mb-3">💡 Pro Tips</h3>
                <ul className="space-y-2 text-sm text-primary-800">
                  <li>• Include full context for better analysis</li>
                  <li>• Add company name for enhanced insights</li>
                  <li>• Paste recent recruiter emails directly</li>
                  <li>• Watch for common red flag indicators</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Results */}
          {result && (
            <div className="mt-12">
              <AnalysisResult result={result} loading={false} error={null} />
            </div>
          )}
        </section>
      </main>
    </MainLayout>
  );
};
