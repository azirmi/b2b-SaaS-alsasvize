import Link from "next/link";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token || token.trim().length === 0) {
    return (
      <div className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight">Geçersiz bağlantı</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Şifre yenileme bağlantısı eksik veya geçersiz görünüyor. Lütfen tekrar
          bağlantı isteyin.
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Yeni bağlantı istemek için{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            şifremi unuttum
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Yeni şifre belirle</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Hesabınız için yeni şifrenizi iki alana da aynı şekilde girin.
      </p>

      <div className="mt-6">
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
