import ResetPasswordForm from "@/app/components/auth/reset-password-form";

export const instant = false;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  return <ResetPasswordForm token={token ?? ""} />;
}
