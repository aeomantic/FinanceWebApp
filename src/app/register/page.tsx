import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Create account | folio" };

export default function RegisterPage() {
  return <AuthShell><AuthForm mode="register" /></AuthShell>;
}
