import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Inbox,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { StageBadge } from "@/components/stage-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { VisaStage } from "@/lib/enums";
import { INTENT_CLASSES, STAGE_FLOW, type Intent } from "@/lib/status";
import { cn } from "@/lib/utils";

const SEMANTIC_ROWS: {
  icon: typeof CheckCircle2;
  intent: Intent;
  label: string;
  meta: string;
}[] = [
  { icon: CheckCircle2, intent: "success", label: "Belge onaylandı", meta: "Evrak · doğrulandı" },
  { icon: Loader2, intent: "info", label: "İşlemde", meta: "Atandı · SLA 02:00" },
  { icon: Clock, intent: "warning", label: "Onay bekliyor", meta: "Pasaport · OCR beklemede" },
  { icon: AlertTriangle, intent: "danger", label: "SLA aşıldı", meta: "Otomatik olarak havuza döndü" },
  { icon: Inbox, intent: "neutral", label: "Beklemede", meta: "Havuzda alınmayı bekliyor" },
];

const SWATCHES = [
  { name: "arkaplan", className: "bg-background" },
  { name: "kart", className: "bg-card" },
  { name: "soluk", className: "bg-muted" },
  { name: "ikincil", className: "bg-secondary" },
  { name: "vurgu", className: "bg-accent" },
  { name: "ana", className: "bg-primary" },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">Alsasvize</span>
            <span className="text-xs text-muted-foreground">Operasyon</span>
          </div>
          <Badge
            variant="outline"
            className="rounded-md font-mono text-[11px] tracking-tight"
          >
            Tasarım önizlemesi
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Tasarım sistemi
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          Varsayılan monokrom. Renk sadece anlam için.
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          Alsasvize arayüzü uçtan uca nötrdür. Derinlik ince sınır çizgileriyle
          verilir, köşe yarıçapları kontrollüdür ve vurgu renkleri yalnızca
          iş akışı durumu için kullanılır.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm">Başvuru al</Button>
          <Button size="sm" variant="outline">
            Duraklat
          </Button>
          <Button size="sm" variant="ghost">
            Denetim kaydını görüntüle
          </Button>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
            <h2 className="text-sm font-medium">Başvuru akışı</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Üç departman havuzunda yedi aşamalı süreç.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {STAGE_FLOW.map((stage, i) => (
                <div key={stage} className="flex items-center gap-2">
                  {i > 0 ? (
                    <ArrowRight
                      className="h-3.5 w-3.5 text-muted-foreground/60"
                      aria-hidden
                    />
                  ) : null}
                  <StageBadge stage={stage} />
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Son durumlar
              </span>
              <StageBadge stage={VisaStage.PAUSED} />
              <StageBadge stage={VisaStage.CANCELLED} />
            </div>
          </section>

          <section className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
            <h2 className="text-sm font-medium">Anlamsal durumlar</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Renk kullanabilen beş durum niyeti.
            </p>
            <div className="mt-3 divide-y divide-border/40">
              {SEMANTIC_ROWS.map((row) => {
                const Icon = row.icon;
                return (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-md border",
                          INTENT_CLASSES[row.intent],
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="text-sm font-medium">{row.label}</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {row.meta}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-lg border border-border/40 bg-card p-6 shadow-sm">
          <h2 className="text-sm font-medium">Nötr palet</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tüm yüzeyler bu token'larla çizilir: gradyan yok, ağır gölge yok.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {SWATCHES.map((swatch) => (
              <div key={swatch.name} className="flex flex-col gap-1.5">
                <div
                  className={cn(
                    "h-12 rounded-md border border-border/60",
                    swatch.className,
                  )}
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {swatch.name}
                </span>
              </div>
            ))}
          </div>
        </section>

        <p className="mt-10 text-xs text-muted-foreground">
          Next.js 16 · React 19 · Tailwind v4 · shadcn/ui (Radix) · Lucide
        </p>
      </main>
    </div>
  );
}
