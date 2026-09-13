import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Reset your password | folio" };

export default function ForgotPasswordPage() {
  return <AuthShell><AuthForm mode="forgot" /></AuthShell>;
}
