import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { MainLayout } from "../components/layout/MainLayout";
import { authService } from "../services/api/authService";

export function PasswordRecovery() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [token] = useState(params.get("token") ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [requested, setRequested] = useState(Boolean(token));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const request = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await authService.requestPasswordRecovery(email);
      setRequested(true);
      setMessage("If an account exists, recovery instructions will be sent. Check your email.");
    } catch { setMessage("If an account exists, recovery instructions will be sent."); }
    finally { setBusy(false); }
  };
  const finish = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await authService.completePasswordRecovery(email, password, token ? undefined : code, token || undefined);
      setMessage("Password updated. You can now sign in.");
    } catch { setMessage("Invalid or expired code or link. Please request a new one."); }
    finally { setBusy(false); }
  };
  return <MainLayout><main className="max-w-md mx-auto p-6 space-y-4">
    <h1 className="text-2xl font-bold">Recover your password</h1>
    <p>Use your account email to receive a one-time code or secure recovery link.</p>
    <form onSubmit={request} className="space-y-3">
      <label className="block">Email
        <input className="w-full border rounded p-2 text-gray-900" type="email" autoComplete="email"
          value={email} onChange={e => setEmail(e.target.value)} required />
      </label>
      <button type="submit" disabled={busy} className="rounded bg-blue-700 text-white px-4 py-2">
        Send recovery code
      </button>
    </form>
    {requested && <form onSubmit={finish} className="space-y-3">
      {!token && <label className="block">Six-digit code from email
        <input className="w-full border rounded p-2 text-gray-900" type="text" inputMode="numeric"
          autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code}
          onChange={e => setCode(e.target.value.replace(/\\D/g, "").slice(0, 6))} required />
      </label>}
      <label className="block">New password (12 characters minimum)
        <input className="w-full border rounded p-2 text-gray-900" type="password" minLength={12}
          autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} required />
      </label>
      <button type="submit" disabled={busy} className="rounded bg-blue-700 text-white px-4 py-2">
        Set new password
      </button>
    </form>}
    {message && <p role="status">{message}</p>}
    <a href="/login" className="underline">Back to sign in</a>
  </main></MainLayout>;
}
