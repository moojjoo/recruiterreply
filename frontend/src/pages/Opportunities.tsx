import React from "react";
import { MainLayout } from "../components/layout/MainLayout";
import { Card } from "../components/common/Card";

export const Opportunities: React.FC = () => {
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Opportunities</h1>
          <p className="text-gray-600">
            Track and manage your job opportunities
          </p>
        </div>

        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500">
              No opportunities yet. Start by analyzing recruiter messages!
            </p>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};
