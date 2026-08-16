import React, { useCallback, useEffect, useState } from "react";
import { MainLayout } from "../components/layout/MainLayout";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../hooks/useToast";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { gmailService } from "../services/api/gmailService";
import { GmailStatus } from "../types/index";

export const Profile: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [gmailStatus, setGmailStatus] = useState<GmailStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

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
