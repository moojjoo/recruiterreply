import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Card } from "../components/common/Card";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { useToast } from "../hooks/useToast";
import { recruiterInboxService } from "../services/api/recruiterInboxService";
import {
  FactField,
  RecruiterFacts,
  RecruiterThread,
  TriageState,
} from "../types/index";

const TABS: { state: TriageState; label: string; description: string }[] = [
  {
    state: "qualified",
    label: "Qualified",
    description: "Meets your bar with every must-know detail provided.",
  },
  {
    state: "needs_info",
    label: "Needs info",
    description: "Could fit, but the recruiter left out details you require.",
  },
  {
    state: "below_bar",
    label: "Below bar",
    description: "Ruled out by your compensation, arrangement or deal-breakers.",
  },
];

const FIELD_LABELS: Record<FactField, string> = {
  rate: "Rate",
  employment_type: "Employment type",
  work_mode: "Remote / onsite",
  location: "Location",
  end_client: "End client",
  duration: "Contract length",
};

const formatRate = (facts: RecruiterFacts) => {
  const { rateMin, rateMax, rateUnit } = facts;
  if (rateMin == null && rateMax == null) return null;
  const range =
    rateMin != null && rateMax != null && rateMin !== rateMax
      ? `$${rateMin.toLocaleString()}–${rateMax.toLocaleString()}`
      : `$${(rateMax ?? rateMin)!.toLocaleString()}`;
  return rateUnit === "year" ? `${range}/yr` : `${range}/hr`;
};

const summarize = (facts?: RecruiterFacts | null) => {
  if (!facts) return [];
  return [
    facts.employmentType?.toUpperCase(),
    formatRate(facts),
    facts.workMode,
    facts.location,
    facts.durationMonths != null ? `${facts.durationMonths} mo` : null,
    facts.endClient ? `Client: ${facts.endClient}` : null,
  ].filter((item): item is string => Boolean(item));
};

export const RecruiterInbox: React.FC = () => {
  const { showToast } = useToast();
  const [activeState, setActiveState] = useState<TriageState>("qualified");
  const [threads, setThreads] = useState<RecruiterThread[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await recruiterInboxService.listThreads(activeState);
        if (!cancelled) setThreads(response.data);
      } catch {
        if (!cancelled) {
          setThreads([]);
          showToast("Failed to load recruiter inbox.", "error");
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [activeState, showToast]);

  const selectTab = (state: TriageState) => {
    if (state === activeState) return;
    setThreads(null);
    setActiveState(state);
  };

  const activeTab = TABS.find((tab) => tab.state === activeState)!;

  return (
    <MainLayout>
      <Card elevated>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-3xl font-bold">Recruiter inbox</h1>
          <Link
            to="/career-profile"
            className="text-sm font-semibold text-primary-700 hover:underline"
          >
            Edit what I'm looking for →
          </Link>
        </div>
        <p className="text-gray-600 mb-6">
          Recruiter emails from your connected Gmail, sorted against your
          career profile. New mail is checked every few minutes.
        </p>

        <div role="tablist" aria-label="Triage state" className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.state}
              role="tab"
              type="button"
              aria-selected={tab.state === activeState}
              onClick={() => selectTab(tab.state)}
              className={
                tab.state === activeState
                  ? "rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:border-primary-600 hover:text-primary-700"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-500 mt-3">{activeTab.description}</p>

        <div role="tabpanel" className="mt-6">
          {threads === null ? (
            <LoadingSpinner size="md" />
          ) : threads.length === 0 ? (
            <p className="text-gray-600">Nothing here yet.</p>
          ) : (
            <ul className="space-y-4">
              {threads.map((thread) => (
                <ThreadItem key={thread.id} thread={thread} />
              ))}
            </ul>
          )}
        </div>
      </Card>
    </MainLayout>
  );
};

const ThreadItem: React.FC<{ thread: RecruiterThread }> = ({ thread }) => {
  const facts = thread.facts;
  const heading = facts?.title || thread.subject || "(no subject)";
  const from = [facts?.recruiterName, facts?.agency || facts?.company]
    .filter(Boolean)
    .join(" · ");
  const details = summarize(facts);

  return (
    <li className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{heading}</h2>
          <p className="text-sm text-gray-600">
            {from || thread.recruiterEmail}
            {from && thread.recruiterEmail ? ` <${thread.recruiterEmail}>` : ""}
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <p>{new Date(thread.lastMessageAt).toLocaleString()}</p>
          <a
            href={`https://mail.google.com/mail/u/0/#all/${thread.gmailThreadId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary-700 hover:underline"
          >
            Open in Gmail
          </a>
        </div>
      </div>

      {details.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {details.map((detail) => (
            <li
              key={detail}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
            >
              {detail}
            </li>
          ))}
        </ul>
      )}

      {thread.missingFields.length > 0 && (
        <p className="mt-3 text-sm text-amber-700">
          Missing:{" "}
          {thread.missingFields.map((f) => FIELD_LABELS[f] ?? f).join(", ")}
        </p>
      )}

      {thread.reasons.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-sm text-red-700">
          {thread.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </li>
  );
};
