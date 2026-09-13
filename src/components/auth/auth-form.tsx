"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { resetPasswordForEmail, signInWithPassword, signUp, updatePassword } from "@/lib/auth/client";
import {
  authRequestSchema,
  emailSchema,
  getFieldErrors,
  loginPasswordSchema,
  securePasswordSchema,
  type AuthFieldErrors,
  type AuthMode,
  type AuthResult,
} from "@/lib/auth/validation";

const CONTENT: Record<AuthMode, { title: string; description: string; button: string; loading: string }> = {
  login: {
    title: "Welcome back.",
    description: "A little clarity for your everyday money. Sign in to pick up where you left off.",
    button: "Sign in",
    loading: "Signing you in...",
  },
  register: {
    title: "Make room for more.",
    description: "Create your account and bring your finances into focus.",
    button: "Create account",
    loading: "Creating your account...",
  },
  forgot: {
    title: "Let's get you back in.",
    description: "Enter your account email and we'll send you a link to reset your password.",
    button: "Send reset link",
    loading: "Sending your link...",
  },
  reset: {
    title: "A fresh start.",
    description: "Choose a strong, unique password to keep your account protected.",
    button: "Update password",
    loading: "Updating your password...",
  },
};

function EyeIcon({ visible }: { visible: boolean }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {!visible && <path d="m3 3 18 18" />}
    </svg>
  );
}

export function AuthForm({ mode = "login", initialError }: { mode?: AuthMode; initialError?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [success, setSuccess] = useState<string | null>(null);
  const content = CONTENT[mode];
  const needsConfirmation = mode === "register" || mode === "reset";

  function validateField(field: "email" | "password") {
    const schema = field === "email" ? emailSchema : needsConfirmation ? securePasswordSchema : loginPasswordSchema;
    const parsed = schema.safeParse(field === "email" ? email : password);
    setFieldErrors((previous) => ({ ...previous, [field]: parsed.success ? undefined : parsed.error.issues[0]?.message }));
    if (field === "email" && parsed.success) setEmail(parsed.data);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError(null);
    const parsed = authRequestSchema.safeParse({ action: mode, email, password });
    const errors = parsed.success ? {} : getFieldErrors(parsed.error);
    if (needsConfirmation && password !== confirmPassword) {
      errors.confirmPassword = "Your passwords don't match.";
    }
    setFieldErrors(errors);
    if (!parsed.success || Object.keys(errors).length > 0) return;

    setLoading(true);
    let result: AuthResult;
    switch (parsed.data.action) {
      case "login": result = await signInWithPassword(parsed.data); break;
      case "register": result = await signUp(parsed.data); break;
      case "forgot": result = await resetPasswordForEmail(parsed.data.email); break;
      case "reset": result = await updatePassword(parsed.data.password); break;
    }

    if (!result.ok) {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
      setLoading(false);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    if (result.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }
    setSuccess(result.message ?? "All done. You can sign in now.");
    setLoading(false);
  }

  const inputClass = "h-13 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm text-[#141414] outline-none transition placeholder:text-[#a0a5a1] focus:border-[#5c7567] focus:ring-4 focus:ring-[#ebf5f0] aria-invalid:border-red-400 aria-invalid:focus:ring-red-50 disabled:opacity-60";

  return (
    <div className="w-full max-w-[390px]">
      {mode === "login" || mode === "register" ? (
        <nav aria-label="Account access" className="mb-9 inline-flex rounded-full bg-[#f0f3f1] p-1">
          <Link href="/login" aria-current={mode === "login" ? "page" : undefined} className={`rounded-full px-6 py-2.5 text-xs font-medium transition ${mode === "login" ? "bg-white text-[#141414] shadow-sm" : "text-[#71717a] hover:text-[#141414]"}`}>Sign in</Link>
          <Link href="/register" aria-current={mode === "register" ? "page" : undefined} className={`rounded-full px-6 py-2.5 text-xs font-medium transition ${mode === "register" ? "bg-white text-[#141414] shadow-sm" : "text-[#71717a] hover:text-[#141414]"}`}>Create account</Link>
        </nav>
      ) : (
        <Link href="/login" className="mb-9 inline-flex items-center gap-2 text-xs font-medium text-[#71717a] hover:text-[#141414]">
          <span aria-hidden="true">&#8592;</span> Back to sign in
        </Link>
      )}

      <h1 className="text-[34px] leading-tight font-semibold tracking-[-1.5px] text-[#141414]">{content.title}</h1>
      <p className="mt-3 mb-8 max-w-[340px] text-sm leading-6 text-[#71717a]">{content.description}</p>

      {success ? (
        <div className="space-y-6">
          <div role="status" className="rounded-2xl border border-emerald-100 bg-[#edf8f0] p-5 text-sm leading-6 text-[#24623c]">
            <span className="mb-2 block text-lg" aria-hidden="true">&#10003;</span>
            {success}
          </div>
          <Link href="/login" className="inline-flex h-13 w-full items-center justify-center rounded-full bg-[#141414] text-sm font-medium text-white hover:bg-[#303a34]">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-busy={loading}>
          <fieldset disabled={loading} className="min-w-0 space-y-5">
            {mode !== "reset" && (
              <div>
                <label htmlFor="email" className="mb-2 block text-xs font-medium text-[#353b37]">Email address</label>
                <input id="email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => validateField("email")} placeholder="you@example.com" aria-invalid={Boolean(fieldErrors.email)} aria-describedby={fieldErrors.email ? "email-error" : undefined} className={inputClass} />
                {fieldErrors.email && <p id="email-error" className="mt-2 text-xs text-red-600">{fieldErrors.email}</p>}
              </div>
            )}

            {mode !== "forgot" && (
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="password" className="text-xs font-medium text-[#353b37]">{mode === "reset" ? "New password" : "Password"}</label>
                  {mode === "login" && <Link href="/forgot-password" className="text-xs text-[#71717a] underline-offset-4 hover:text-[#141414] hover:underline">Forgot password?</Link>}
                </div>
                <div className="relative">
                  <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} onBlur={() => validateField("password")} placeholder={mode === "login" ? "Enter your password" : "Create a strong password"} aria-invalid={Boolean(fieldErrors.password)} aria-describedby={[fieldErrors.password ? "password-error" : "", needsConfirmation ? "password-help" : ""].filter(Boolean).join(" ") || undefined} className={`${inputClass} pr-12`} />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute top-0 right-1 flex h-13 w-11 items-center justify-center rounded-xl text-[#858b87] hover:text-[#141414]"><EyeIcon visible={showPassword} /></button>
                </div>
                {fieldErrors.password && <p id="password-error" className="mt-2 text-xs text-red-600">{fieldErrors.password}</p>}
                {needsConfirmation && <p id="password-help" className="mt-2 text-[11px] leading-5 text-[#858b87]">At least 8 characters, with uppercase, lowercase, a number, and a symbol.</p>}
              </div>
            )}

            {needsConfirmation && (
              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-xs font-medium text-[#353b37]">Confirm password</label>
                <input id="confirm-password" name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" required minLength={8} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" aria-invalid={Boolean(fieldErrors.confirmPassword)} aria-describedby={fieldErrors.confirmPassword ? "confirm-password-error" : undefined} className={inputClass} />
                {fieldErrors.confirmPassword && <p id="confirm-password-error" className="mt-2 text-xs text-red-600">{fieldErrors.confirmPassword}</p>}
              </div>
            )}

            {error && <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">{error}</p>}
            <button type="submit" disabled={loading} className="flex h-13 w-full items-center justify-center gap-3 rounded-full bg-[#141414] px-6 text-sm font-medium text-white transition hover:bg-[#303a34] disabled:cursor-wait disabled:opacity-60">
              {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" aria-hidden="true" />}
              {loading ? content.loading : content.button}
              {!loading && <span aria-hidden="true">&#8599;</span>}
            </button>
          </fieldset>
        </form>
      )}

      <div className="mt-7 flex items-center justify-center gap-2 text-[11px] text-[#929994]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        Your space. Your money. Securely connected.
      </div>
    </div>
  );
}
