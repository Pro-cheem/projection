import { redirect } from "next/navigation";

export default async function LoginRedirect({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const sp = await searchParams;
  const role = sp?.role;
  const callbackUrl = role === "manager" ? "/admin" : role === "representative" ? "/invoice" : "/";
  redirect(`/api/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
}
