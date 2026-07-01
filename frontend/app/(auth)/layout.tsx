import Link from "next/link";
import { ShieldCheck } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          <span className="text-sm font-semibold tracking-tight">Alsasvize</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
