import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign in | folio" };

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "This account is not authorized to use this app.",
  auth_failed: "This link is invalid or has expired. Sign in or request a new password reset link.",
  missing_code: "This link is incomplete. Sign in or request a new password reset link.",
};

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <AuthShell><AuthForm initialError={error ? ERROR_MESSAGES[error] : undefined} /></AuthShell>;
}
