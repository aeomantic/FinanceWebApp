import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email address is too long.")
  .pipe(z.email("Enter a valid email address."));

// Never trim passwords: whitespace can be an intentional part of a password.
export const loginPasswordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(128, "Use no more than 128 characters.");

export const securePasswordSchema = loginPasswordSchema
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a number.")
  .regex(/[^a-zA-Z0-9\s]/, "Add a symbol, such as !, @, or #.");

export const loginSchema = z.object({
  email: emailSchema,
  password: loginPasswordSchema,
});

export const registerSchema = z.object({
  email: emailSchema,
  password: securePasswordSchema,
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({ password: securePasswordSchema });

export const authRequestSchema = z.discriminatedUnion("action", [
  loginSchema.extend({ action: z.literal("login") }),
  registerSchema.extend({ action: z.literal("register") }),
  forgotPasswordSchema.extend({ action: z.literal("forgot") }),
  resetPasswordSchema.extend({ action: z.literal("reset") }),
]);

export type AuthRequest = z.infer<typeof authRequestSchema>;
export type AuthMode = AuthRequest["action"];
export type Credentials = z.infer<typeof loginSchema>;
export type AuthFieldErrors = Partial<Record<"email" | "password" | "confirmPassword", string>>;

export type AuthResult =
  | {
      ok: true;
      message?: string;
      session?: { access_token: string; refresh_token: string };
    }
  | { ok: false; error: string; fieldErrors?: AuthFieldErrors };

export function getFieldErrors(error: z.ZodError): AuthFieldErrors {
  const fields: AuthFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if ((key === "email" || key === "password") && !fields[key]) {
      fields[key] = issue.message;
    }
  }
  return fields;
}

export function getAuthErrorMessage(error: { code?: string; message: string }): string {
  const messages: Record<string, string> = {
    invalid_credentials: "Invalid login credentials. Check your email and password.",
    email_not_confirmed: "Confirm your email before signing in. Check your inbox for the confirmation link.",
    user_already_exists: "User already registered. Sign in or reset your password.",
    email_exists: "User already registered. Sign in or reset your password.",
    weak_password: "Choose a stronger password with uppercase, lowercase, a number, and a symbol.",
    same_password: "Choose a password different from your current password.",
    over_email_send_rate_limit: "Too many emails requested. Wait a minute, then try again.",
    over_request_rate_limit: "Too many attempts. Wait a moment, then try again.",
    signup_disabled: "Registration is currently unavailable. Contact the account owner.",
    session_not_found: "Your session has expired. Request a new password reset link.",
    otp_expired: "This link has expired. Request a new password reset link.",
  };

  if (error.code && messages[error.code]) return messages[error.code];
  if (/invalid login credentials/i.test(error.message)) return messages.invalid_credentials;
  if (/already registered/i.test(error.message)) return messages.user_already_exists;
  return "We couldn't complete that request. Please try again.";
}
