import React, { useCallback, useEffect, useState } from "react";
import { MainLayout } from "../components/layout/MainLayout";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { gmailService } from "../services/api/gmailService";
import { billingService } from "../services/api/billingService";
import { GmailStatus, UsageStatus } from "../types/index";

const TIER_LABELS: Record<string, string> = {
  free: "Free",
  professional: "Professional",
  recruiter_pro: "Recruiter Pro",
};

const FEATURE_LABELS: Record<string, string> = {
  analyze: "Message analyses",
  reply: "Replies generated",
  compare: "Offer comparisons",
};

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [isLoadingUsage, setIsLoadingUsage] = useState(true);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const loadGmailStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    try {
      const response = await gmailService.getStatus();
      setGmailStatus(response.data);
    } catch {
      showToast("Failed to load Gmail connection status.", "error");
    } finally {
      setIsLoadingStatus(false);
    }
  }, [showToast]);

  useEffect(() => {
    // loadGmailStatus is shared with handleDisconnect's refresh call, so it can't be
    // inlined here; its synchronous setIsLoadingStatus(true) is an intentional
    // fetch-on-mount pattern.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadGmailStatus();
  }, [loadGmailStatus]);

  useEffect(() => {
    const loadUsage = async () => {
      setIsLoadingUsage(true);
      try {
        const response = await billingService.getUsage();
        setUsageStatus(response.data);
      } catch {
        showToast("Failed to load billing status.", "error");
      } finally {
        setIsLoadingUsage(false);
      }
    };

    loadUsage();
  }, [showToast]);

  const handleManageBilling = async () => {
    setIsOpeningPortal(true);
    try {
      const response = await billingService.createPortalSession();
      window.location.href = response.data.url;
    } catch {
      showToast(
        "No billing account yet — upgrade to a paid plan first.",
        "error",
      );
      setIsOpeningPortal(false);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await gmailService.connect();
      window.location.href = response.data.authorizationUrl;
    } catch {
      showToast("Failed to start Gmail connection.", "error");
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await gmailService.disconnect();
      showToast("Gmail disconnected.", "success");
      await loadGmailStatus();
    } catch {
      showToast("Failed to disconnect Gmail.", "error");
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <MainLayout>
      <Card elevated>
        <h1 className="text-3xl font-bold mb-6">Profile</h1>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Email</label>
            <p className="text-lg text-gray-900">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">Name</label>
            <p className="text-lg text-gray-900">{user?.name}</p>
          </div>
          <div>
            <label className="text-sm font-semibold text-gray-700">
              Member Since
            </label>
            <p className="text-lg text-gray-900">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
        </div>
      </Card>

      <Card elevated className="mt-6">
        <h2 className="text-2xl font-bold mb-4">Billing</h2>

        {isLoadingUsage ? (
          <LoadingSpinner size="md" />
        ) : usageStatus ? (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Current Plan
              </label>
              <p className="text-lg text-gray-900">
                {TIER_LABELS[usageStatus.subscriptionTier] ??
                  usageStatus.subscriptionTier}
              </p>
              {usageStatus.subscriptionStatus === "trialing" &&
                usageStatus.subscriptionCurrentPeriodEnd && (
                  <p className="text-sm text-primary-600 mt-1">
                    Free trial — first charge on{" "}
                    {new Date(
                      usageStatus.subscriptionCurrentPeriodEnd,
                    ).toLocaleDateString()}
                  </p>
                )}
            </div>

            <div className="space-y-2">
              {usageStatus.usage.map((item) => (
                <div key={item.feature} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {FEATURE_LABELS[item.feature] ?? item.feature}
                  </span>
                  <span className="font-semibold text-gray-900">
                    {item.used} / {item.limit ?? "Unlimited"}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              {usageStatus.subscriptionTier === "free" ? (
                <Button onClick={() => (window.location.href = "/pricing")}>
                  Upgrade Plan
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={handleManageBilling}
                  isLoading={isOpeningPortal}
                >
                  Manage Billing
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-600">Unable to load billing status.</p>
        )}
      </Card>

      <Card elevated className="mt-6">
        <h2 className="text-2xl font-bold mb-4">Gmail Recruiting Agent</h2>

        {isLoadingStatus ? (
          <LoadingSpinner size="md" />
        ) : gmailStatus?.isConnected ? (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Connected account
              </label>
              <p className="text-lg text-gray-900">
                {gmailStatus.googleAccountEmail}
              </p>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">
                Last synced
              </label>
              <p className="text-lg text-gray-900">
                {gmailStatus.lastSyncedAt
                  ? new Date(gmailStatus.lastSyncedAt).toLocaleString()
                  : "Not yet synced"}
              </p>
            </div>
            {gmailStatus.lastSyncStatus === "error" && (
              <p className="text-sm text-red-600">
                Last sync failed: {gmailStatus.lastSyncError}
              </p>
            )}
            {gmailStatus.status === "error" && (
              <p className="text-sm text-red-600">
                Connection needs to be re-authorized — disconnect and reconnect Gmail.
              </p>
            )}
            <Button
              variant="danger"
              onClick={handleDisconnect}
              isLoading={isDisconnecting}
            >
              Disconnect Gmail
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-700">
              Connect your Gmail inbox so RecruiterReply can detect recruiter
              messages, evaluate them against your requirements, and prepare
              draft replies for you to review before sending.
            </p>
            <Button onClick={handleConnect} isLoading={isConnecting}>
              Connect Gmail
            </Button>
          </div>
        )}
      </Card>
    </MainLayout>
  );
};
