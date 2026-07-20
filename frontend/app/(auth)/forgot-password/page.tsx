import Link from "next/link";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Şifremi unuttum</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Kayıtlı e-posta adresinizi girin, size şifre yenileme bağlantısı gönderelim.
      </p>

      <div className="mt-6">
        <ForgotPasswordForm />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Giriş ekranına dönmek için{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          buraya tıklayın
        </Link>
        .
      </p>
    </div>
  );
}
