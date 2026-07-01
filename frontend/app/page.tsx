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
  { icon: CheckCircle2, intent: "success", label: "Document approved", meta: "DOC · verified" },
  { icon: Loader2, intent: "info", label: "In process", meta: "Assigned · SLA 02:00" },
  { icon: Clock, intent: "warning", label: "Awaiting approval", meta: "Passport · OCR pending" },
  { icon: AlertTriangle, intent: "danger", label: "SLA breached", meta: "Auto-reverted to pool" },
  { icon: Inbox, intent: "neutral", label: "Queued", meta: "Unclaimed in pool" },
];

const SWATCHES = [
  { name: "background", className: "bg-background" },
  { name: "card", className: "bg-card" },
  { name: "muted", className: "bg-muted" },
  { name: "secondary", className: "bg-secondary" },
  { name: "accent", className: "bg-accent" },
  { name: "primary", className: "bg-primary" },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border/40">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold tracking-tight">Alsasvize</span>
            <span className="text-xs text-muted-foreground">Operations</span>
          </div>
          <Badge
            variant="outline"
            className="rounded-md font-mono text-[11px] tracking-tight"
          >
            Design preview
          </Badge>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12 md:py-16">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Design system
        </p>
        <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          Monochrome by default. Color only for meaning.
        </h1>
        <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
          The Alsasvize surface is neutral end to end. Depth comes from a single
          hairline border, radii stay restrained, and accent hues are reserved
          strictly for workflow status — never decoration.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button size="sm">Claim application</Button>
          <Button size="sm" variant="outline">
            Pause
          </Button>
          <Button size="sm" variant="ghost">
            View audit trail
          </Button>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <section className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
            <h2 className="text-sm font-medium">Application pipeline</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Seven-stage flow across three department pools.
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
                Terminal
              </span>
              <StageBadge stage={VisaStage.PAUSED} />
              <StageBadge stage={VisaStage.CANCELLED} />
            </div>
          </section>

          <section className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
            <h2 className="text-sm font-medium">Semantic status</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              The five intents that may introduce color.
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
          <h2 className="text-sm font-medium">Neutral palette</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every surface is drawn from these tokens — no gradients, no heavy shadows.
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
