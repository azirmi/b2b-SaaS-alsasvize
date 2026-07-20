import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;

  return (
    <div className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Giriş yap</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Vize operasyon çalışma alanınıza erişin.
      </p>

      {reset === "1" ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-400">
          Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.
        </p>
      ) : null}

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
