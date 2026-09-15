import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { billingService } from "../services/api/billingService";
import { SubscriptionTier } from "../types/index";

function redirectTo(url: string) {
  window.location.href = url;
}

interface Plan {
  tier: SubscriptionTier;
  name: string;
  price: string;
  cadence?: string;
  description: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

const plans: Plan[] = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    description: "Try out the core tools before you commit.",
    features: [
      "5 message analyses / month",
      "5 AI-generated replies / month",
      "2 offer comparisons / month",
    ],
    cta: "Get Started",
  },
  {
    tier: "professional",
    name: "Professional",
    price: "$19",
    cadence: "/month",
    description: "For active job seekers negotiating offers.",
    features: [
      "7-day free trial",
      "200 message analyses / month",
      "200 AI-generated replies / month",
      "50 offer comparisons / month",
      "Gmail recruiter inbox sync",
    ],
    cta: "Upgrade to Professional",
    highlighted: true,
  },
];

export const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (tier === "free") {
      navigate(isAuthenticated ? "/dashboard" : "/register");
      return;
    }

    if (!isAuthenticated) {
      navigate("/register");
      return;
    }

    setLoadingTier(tier);
    try {
      const response = await billingService.createCheckoutSession(tier);
      redirectTo(response.data.url);
    } catch {
      showToast("Failed to start checkout. Please try again.", "error");
      setLoadingTier(null);
    }
  };

  return (
    <MainLayout>
      <main>
        <section className="py-12 text-center">
          <h1 className="section-title">Simple, Transparent Pricing</h1>
          <p className="section-subtitle max-w-2xl mx-auto">
            Start free, upgrade when you need more AI-powered analyses,
            replies, and comparisons.
          </p>
        </section>

        <section className="pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-3xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.tier}
                elevated
                className={`flex flex-col ${
                  plan.highlighted ? "border-2 border-primary-500" : ""
                }`}
              >
                {plan.highlighted && (
                  <div className="text-xs font-bold text-primary-600 uppercase tracking-wide mb-2">
                    Most Popular
                  </div>
                )}
                <h2 className="text-2xl font-bold text-gray-900">
                  {plan.name}
                </h2>
                <p className="text-gray-600 mb-4">{plan.description}</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price}
                  </span>
                  {plan.cadence && (
                    <span className="text-gray-600">{plan.cadence}</span>
                  )}
                </div>
                <ul className="space-y-2 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-gray-700">
                      <span className="text-success-600">✓</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlighted ? "primary" : "secondary"}
                  className="w-full"
                  isLoading={loadingTier === plan.tier}
                  onClick={() => handleSelectPlan(plan.tier)}
                >
                  {plan.cta}
                </Button>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </MainLayout>
  );
};
