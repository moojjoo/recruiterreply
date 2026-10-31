import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { billingService } from "../services/api/billingService";
import { BillingInterval } from "../services/api/billingService";
import { SubscriptionTier } from "../types/index";
import { trackProductEvent } from "../utils/productAnalytics";

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

interface CatalogPlan {
  tier: SubscriptionTier;
  interval: BillingInterval;
  unitAmount: number | null;
  currency: string;
  intervalCount?: number | null;
  trialPeriodDays: number;
}

export const Pricing: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [loadingTier, setLoadingTier] = useState<SubscriptionTier | null>(null);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [catalog, setCatalog] = useState<CatalogPlan[]>([]);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("month");

  useEffect(() => {
    let active = true;
    billingService.getPlans().then((response) => {
      if (!active) return;
      setCatalog(response.data.plans);
    }).catch(() => {
      // Pricing remains usable if the public catalog is temporarily unavailable.
    });

    if (isAuthenticated) {
      billingService.getUsage().then((response) => {
        if (active) setCurrentTier(response.data.subscriptionTier);
      }).catch(() => {
        if (active) setCurrentTier(null);
      });
    }

    return () => { active = false; };
  }, [isAuthenticated]);

  useEffect(() => {
    trackProductEvent("pricing_viewed");
  }, []);

  const getCatalogPlan = (tier: SubscriptionTier): CatalogPlan | undefined =>
    catalog.find((item) => item.tier === tier && item.interval === billingInterval);

  const annualAvailable =
    catalog.some((item) => item.tier === "professional" && item.interval === "year") &&
    catalog.some((item) => item.tier === "recruiter_pro" && item.interval === "year");

  const formatPrice = (tier: SubscriptionTier): string => {
    if (tier === "free") return "$0";
    const plan = getCatalogPlan(tier);
    if (!plan?.unitAmount) {
      if (tier === "professional") return billingInterval === "year" ? "$229" : "$24";
      return billingInterval === "year" ? "$469" : "$49";
    }
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: plan.currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(plan.unitAmount / 100);
  };

  const handleSelectPlan = async (tier: SubscriptionTier) => {
    if (tier === "free") {
      navigate(isAuthenticated ? "/dashboard" : "/register");
      return;
    }

    if (!isAuthenticated) {
      navigate("/register");
      return;
    }

    if (tier === currentTier) return;

    setLoadingTier(tier);
    try {
      if (tier === "recruiter_pro" && currentTier === "professional") {
        const response = await billingService.upgradeToRecruiterPro(billingInterval);
        if (response.data.url) {
          trackProductEvent("begin_checkout", { plan_tier: "recruiter_pro", billing_interval: billingInterval });
          redirectTo(response.data.url);
          return;
        }

        trackProductEvent("subscription_upgrade_started", {
          from_tier: "professional",
          to_tier: "recruiter_pro",
        });
        showToast("Upgrade started. Your plan will update after Stripe confirms the change.", "success");
        navigate("/profile");
        return;
      }

      const response = await billingService.createCheckoutSession(tier, billingInterval);
      trackProductEvent("begin_checkout", {
        plan_tier: tier === "recruiter_pro" ? "recruiter_pro" : "professional",
        billing_interval: billingInterval,
      });
      redirectTo(response.data.url);
    } catch {
      showToast("Failed to start billing. Please try again.", "error");
      setLoadingTier(null);
    }
  };

  const plans: Plan[] = [
    {
      tier: "free",
      name: "Free",
      price: formatPrice("free"),
      description: "Try out the core tools before you commit.",
      features: [
        "3 message analyses / month",
        "3 AI-generated replies / month",
        "1 offer comparison / month",
      ],
      cta: currentTier === "free" ? "Current plan" : "Get Started",
    },
    {
      tier: "professional",
      name: "Professional",
      price: formatPrice("professional"),
      cadence: billingInterval === "year" ? "/year" : "/month",
      description: "For active job seekers negotiating offers.",
      features: [
        "7-day free trial — no charge today",
        "200 message analyses / month",
        "200 AI-generated replies / month",
        "50 offer comparisons / month",
        "Gmail recruiter inbox sync",
      ],
      cta: currentTier === "professional" ? "Current plan" : "Upgrade to Professional",
      highlighted: true,
    },
    {
      tier: "recruiter_pro",
      name: "Recruiter Pro",
      price: formatPrice("recruiter_pro"),
      cadence: billingInterval === "year" ? "/year" : "/month",
      description: "For candidates who want their recruiter inbox organized and ready for action.",
      features: [
        "500 message analyses / month",
        "500 AI-generated replies / month",
        "100 offer comparisons / month",
        "5,000 recruiter emails triaged / month",
        "Gmail sync, labels, and suggested drafts",
        "Review every draft before sending",
      ],
      cta: currentTier === "recruiter_pro" ? "Current plan" : "Upgrade to Recruiter Pro",
    },
  ];

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

        <div className="flex justify-center gap-2 mb-8" role="group" aria-label="Billing interval">
          <Button
            variant={billingInterval === "month" ? "primary" : "secondary"}
            onClick={() => setBillingInterval("month")}
          >
            Monthly
          </Button>
          {annualAvailable && (
            <Button
              variant={billingInterval === "year" ? "primary" : "secondary"}
              onClick={() => setBillingInterval("year")}
            >
              Annual — save 20%
            </Button>
          )}
        </div>

        <section className="pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
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
                  disabled={plan.tier === currentTier}
                  onClick={() => handleSelectPlan(plan.tier)}
                >
                  {plan.cta}
                </Button>
              </Card>
            ))}
          </div>
          <p className="text-center text-sm text-gray-600 mt-6">
            Annual plans are charged upfront. All paid plans include a 7-day trial; your first charge occurs after the trial ends.
          </p>
        </section>
      </main>
    </MainLayout>
  );
};
