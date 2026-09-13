import { MagicLinkForm } from "@/components/auth/magic-link-form";

const ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "This account is not authorized to use this app.",
  auth_failed: "Sign-in failed. Please try again.",
  missing_code: "Sign-in failed. Please try again.",
  profile_setup_failed: "Could not set up your profile. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-gray-900">Personal Finance</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to continue</p>
        </div>
        {errorMessage ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
        <MagicLinkForm />
      </div>
    </div>
  );
}
