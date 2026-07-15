import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Link href="/" className="inline-flex items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="Alsasvize"
              width={260}
              height={88}
              priority
              className="h-auto w-[180px] object-contain sm:w-[230px]"
            />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
