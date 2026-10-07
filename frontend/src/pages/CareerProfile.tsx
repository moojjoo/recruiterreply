import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { LoadingSpinner } from "../components/common/LoadingSpinner";
import { useToast } from "../hooks/useToast";
import { recruiterInboxService } from "../services/api/recruiterInboxService";
import {
  CareerProfile as CareerProfileModel,
  EmploymentType,
  FactField,
  WorkMode,
} from "../types/index";

const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "w2", label: "W2" },
  { value: "c2c", label: "C2C" },
  { value: "1099", label: "1099" },
  { value: "fte", label: "Full-time" },
];

const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "Onsite" },
];

const FACT_FIELDS: { value: FactField; label: string }[] = [
  { value: "rate", label: "Rate / salary" },
  { value: "employment_type", label: "Employment type" },
  { value: "work_mode", label: "Remote / hybrid / onsite" },
  { value: "location", label: "Location" },
  { value: "end_client", label: "End client" },
  { value: "duration", label: "Contract length" },
];

interface FormState {
  targetTitles: string;
  skills: string;
  minW2HourlyRate: string;
  minC2CHourlyRate: string;
  minSalary: string;
  employmentTypes: EmploymentType[];
  workModes: WorkMode[];
  allowedLocations: string;
  minContractMonths: string;
  dealBreakerKeywords: string;
  blockedCompanies: string;
  mustKnowFields: FactField[];
}

const toList = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const toNumber = (value: string) =>
  value.trim() === "" ? null : Number(value);

const toForm = (profile: CareerProfileModel): FormState => ({
  targetTitles: profile.targetTitles.join(", "),
  skills: profile.skills.join(", "),
  minW2HourlyRate: profile.minW2HourlyRate?.toString() ?? "",
  minC2CHourlyRate: profile.minC2CHourlyRate?.toString() ?? "",
  minSalary: profile.minSalary?.toString() ?? "",
  employmentTypes: profile.employmentTypes,
  workModes: profile.workModes,
  allowedLocations: profile.allowedLocations.join(", "),
  minContractMonths: profile.minContractMonths?.toString() ?? "",
  dealBreakerKeywords: profile.dealBreakerKeywords.join(", "),
  blockedCompanies: profile.blockedCompanies.join(", "),
  mustKnowFields: profile.mustKnowFields,
});

const toggle = <T,>(values: T[], value: T) =>
  values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];

export const CareerProfile: React.FC = () => {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<CareerProfileModel | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await recruiterInboxService.getProfile();
        setProfile(response.data);
        setForm(toForm(response.data));
      } catch {
        showToast("Failed to load your career profile.", "error");
      }
    };

    load();
  }, [showToast]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => (current ? { ...current, [key]: value } : current));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile || !form) return;

    setIsSaving(true);
    try {
      const response = await recruiterInboxService.saveProfile({
        // Keep reply/auto-send settings that this form doesn't edit yet.
        ...profile,
        targetTitles: toList(form.targetTitles),
        skills: toList(form.skills),
        minW2HourlyRate: toNumber(form.minW2HourlyRate),
        minC2CHourlyRate: toNumber(form.minC2CHourlyRate),
        minSalary: toNumber(form.minSalary),
        employmentTypes: form.employmentTypes,
        workModes: form.workModes,
        allowedLocations: toList(form.allowedLocations),
        minContractMonths: toNumber(form.minContractMonths),
        dealBreakerKeywords: toList(form.dealBreakerKeywords),
        blockedCompanies: toList(form.blockedCompanies),
        mustKnowFields: form.mustKnowFields,
      });
      setProfile(response.data);
      setForm(toForm(response.data));
      showToast("Career profile saved.", "success");
    } catch {
      showToast("Failed to save your career profile.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (!form) {
    return (
      <MainLayout>
        <LoadingSpinner size="md" />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Card elevated>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
          <h1 className="text-3xl font-bold">What I'm looking for</h1>
          <Link
            to="/recruiter-inbox"
            className="text-sm font-semibold text-primary-700 hover:underline"
          >
            View recruiter inbox →
          </Link>
        </div>
        <p className="text-gray-600 mb-6">
          Recruiter emails in your connected Gmail are checked against these
          rules. Leave a field blank to skip that check. Lists are
          comma-separated.
        </p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Role</h2>
            <Input
              id="targetTitles"
              label="Target titles"
              placeholder="Senior .NET Engineer, Solutions Architect"
              value={form.targetTitles}
              onChange={(e) => update("targetTitles", e.target.value)}
            />
            <Input
              id="skills"
              label="Skills"
              placeholder="C#, AWS, React"
              value={form.skills}
              onChange={(e) => update("skills", e.target.value)}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Compensation floor</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                id="minW2HourlyRate"
                label="Min W2 / 1099 ($/hr)"
                type="number"
                min="0"
                value={form.minW2HourlyRate}
                onChange={(e) => update("minW2HourlyRate", e.target.value)}
              />
              <Input
                id="minC2CHourlyRate"
                label="Min C2C ($/hr)"
                type="number"
                min="0"
                value={form.minC2CHourlyRate}
                onChange={(e) => update("minC2CHourlyRate", e.target.value)}
              />
              <Input
                id="minSalary"
                label="Min salary ($/yr)"
                type="number"
                min="0"
                value={form.minSalary}
                onChange={(e) => update("minSalary", e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Arrangement</h2>
            <CheckboxGroup
              legend="Employment types I accept"
              helper="Select none to accept any."
              options={EMPLOYMENT_TYPES}
              selected={form.employmentTypes}
              onToggle={(value) =>
                update("employmentTypes", toggle(form.employmentTypes, value))
              }
            />
            <CheckboxGroup
              legend="Work modes I accept"
              helper="Select none to accept any."
              options={WORK_MODES}
              selected={form.workModes}
              onToggle={(value) =>
                update("workModes", toggle(form.workModes, value))
              }
            />
            <Input
              id="allowedLocations"
              label="Locations for hybrid / onsite roles"
              placeholder="Charlotte, Raleigh"
              helper="Leave blank to accept any location."
              value={form.allowedLocations}
              onChange={(e) => update("allowedLocations", e.target.value)}
            />
            <Input
              id="minContractMonths"
              label="Minimum contract length (months)"
              type="number"
              min="0"
              value={form.minContractMonths}
              onChange={(e) => update("minContractMonths", e.target.value)}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Deal-breakers</h2>
            <Input
              id="dealBreakerKeywords"
              label="Keywords"
              placeholder="security clearance, 100% travel"
              value={form.dealBreakerKeywords}
              onChange={(e) => update("dealBreakerKeywords", e.target.value)}
            />
            <Input
              id="blockedCompanies"
              label="Companies or agencies"
              value={form.blockedCompanies}
              onChange={(e) => update("blockedCompanies", e.target.value)}
            />
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Must know before I engage</h2>
            <CheckboxGroup
              legend="Details a recruiter must provide"
              helper="Opportunities missing any of these are marked “Needs info”."
              options={FACT_FIELDS}
              selected={form.mustKnowFields}
              onToggle={(value) =>
                update("mustKnowFields", toggle(form.mustKnowFields, value))
              }
            />
          </section>

          <Button type="submit" isLoading={isSaving}>
            Save profile
          </Button>
        </form>
      </Card>
    </MainLayout>
  );
};

interface CheckboxGroupProps<T extends string> {
  legend: string;
  helper?: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
}

const CheckboxGroup = <T extends string>({
  legend,
  helper,
  options,
  selected,
  onToggle,
}: CheckboxGroupProps<T>) => (
  <fieldset>
    <legend className="form-label">{legend}</legend>
    <div className="flex flex-wrap gap-4 mt-1">
      {options.map((option) => (
        <label
          key={option.value}
          className="inline-flex items-center gap-2 text-gray-800"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
    {helper && <p className="text-xs text-gray-500 mt-1">{helper}</p>}
  </fieldset>
);
