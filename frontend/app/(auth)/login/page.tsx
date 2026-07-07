import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Giriş yap</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Vize operasyon çalışma alanınıza erişin.
      </p>

      <div className="mt-6">
        <LoginForm next={next} />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Yeni müşteri misiniz?{" "}
        <Link
          href="/onboard"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Kayıt sürecini başlat
        </Link>
      </p>
    </div>
  );
}
