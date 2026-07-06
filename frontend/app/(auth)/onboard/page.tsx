import Link from "next/link";

import { OnboardForm } from "@/components/auth/onboard-form";

export default function OnboardPage() {
  return (
    <div className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
      <h1 className="text-xl font-semibold tracking-tight">Hesabınızı oluşturun</h1>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Kayıt olun ve ilk vize başvurunuzu açmak için pasaportlarınızı yükleyin.
      </p>

      <div className="mt-6">
        <OnboardForm />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Zaten kayıtlı mısınız?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Giriş yapın
        </Link>
      </p>
    </div>
  );
}
