---
name: frontend-design-system
description: 'Anti-AI-slop design system for the Alsasvize frontend. Use when building or styling UI in frontend/ — pages, dashboards, tables, dialogs, forms, status badges, or any shadcn/ui component. Enforces the Claude/Vercel/Linear aesthetic: monochrome dominance, semantic-only accent color, subtle borders over shadows, restrained radii, and tight typography. Covers design tokens, the VisaStage/SLA status→color map, and copy-paste shadcn component recipes.'
argument-hint: 'the screen or component you are building'
---

# Alsasvize Design System (anti-AI-slop)

The look is **enterprise-grade, minimalist, information-dense** — think Claude, Vercel, and Linear. Every screen should read like a serious operations tool, not a template. When in doubt, remove ornament and let type + spacing + a single border do the work.

## When to Use

Building or restyling anything under `frontend/`: dashboards, work pools, application detail views, tables, dialogs, forms, navigation, or individual shadcn/ui components. Pair with the always-on rules in [frontend.instructions.md](../../instructions/frontend.instructions.md).

## The Five Laws

1. **Depth = borders, not shadows.** Define surfaces with `border border-border/40` and at most `shadow-sm`. Never stack heavy `shadow-lg`/`shadow-xl` for "pop".
2. **Restrained radii.** `rounded-md` (controls, badges) and `rounded-lg` (cards, dialogs). Never `rounded-full` except avatars and icon-only status dots.
3. **Typography carries hierarchy.** `tracking-tight` on headings, `leading-relaxed` on paragraphs. Secondary/meta text is always `text-muted-foreground`. Size is the last lever, not the first.
4. **Monochrome dominance.** The canvas is neutral (`background`, `foreground`, `muted`, `border`). Accent hues appear **only** as semantic status.
5. **Primitives over hand-rolled HTML.** Reach for shadcn/ui + Radix for every standard control. Icons: `lucide-react`, sized `h-4 w-4` inline / `h-5 w-5` standalone.

## Design Tokens

Use the shadcn CSS-variable tokens — never raw hex or arbitrary `text-[#…]`.

| Token | Use |
|-------|-----|
| `bg-background` / `text-foreground` | Page canvas + primary text |
| `bg-card` / `bg-popover` | Raised surfaces, menus, dialogs |
| `text-muted-foreground` | Labels, timestamps, secondary meta, empty states |
| `bg-muted` | Subtle fills: table header, skeletons, inert chips |
| `border-border` (`/40` for hairlines) | All separators and surface edges |
| `bg-primary` / `text-primary-foreground` | The single primary action per view |
| `ring-ring` | Focus rings — never remove focus visibility |

Spacing rhythm: `gap-2` intra-group, `gap-4`/`gap-6` between groups, section padding `p-4`/`p-6`. Prefer `flex`/`grid` with `gap-*` over margin stacking.

## Typography Scale

| Role | Classes |
|------|---------|
| Page title | `text-2xl font-semibold tracking-tight` |
| Section heading | `text-lg font-semibold tracking-tight` |
| Card title | `text-sm font-medium` |
| Body | `text-sm leading-relaxed` |
| Meta / caption | `text-xs text-muted-foreground` |
| Numeric / IDs | `font-mono text-xs tabular-nums` |

## Status → Color Map (the ONLY place color is allowed)

Accent color is semantic, not decorative. Centralize this map in `frontend/lib/status.ts` and render it through a shadcn `Badge`. Base everything on the server enums in [enums.ts](../../../backend/src/generated/prisma/enums.ts).

| Domain state | Intent | Tailwind (light · dark) |
|--------------|--------|--------------------------|
| `COMPLETED`, document approved | Success | `text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900` |
| `SLA breach`, `CANCELLED` | Danger | `text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-900` |
| `PAUSED`, awaiting approval | Warning | `text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900` |
| `*_PROCESS` (actively worked) | Info | `text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-900` |
| `*_POOL` (queued, unclaimed) | Neutral | `text-muted-foreground bg-muted border-border` |

```tsx
// frontend/lib/status.ts
import { VisaStage } from './enums';

export type Intent = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

export const INTENT_CLASSES: Record<Intent, string> = {
  success: 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/50 dark:border-emerald-900',
  danger: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/50 dark:border-red-900',
  warning: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950/50 dark:border-amber-900',
  info: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/50 dark:border-blue-900',
  neutral: 'text-muted-foreground bg-muted border-border',
};

export const STAGE_INTENT: Record<VisaStage, Intent> = {
  SALES_POOL: 'neutral', DOC_POOL: 'neutral', SEC_POOL: 'neutral',
  SALES_PROCESS: 'info', DOC_PROCESS: 'info', SEC_PROCESS: 'info',
  COMPLETED: 'success', PAUSED: 'warning', CANCELLED: 'danger',
};

export const STAGE_LABEL: Record<VisaStage, string> = {
  SALES_POOL: 'Sales · Queue', SALES_PROCESS: 'Sales · Working',
  DOC_POOL: 'Docs · Queue', DOC_PROCESS: 'Docs · Working',
  SEC_POOL: 'Secretary · Queue', SEC_PROCESS: 'Secretary · Working',
  COMPLETED: 'Completed', PAUSED: 'Paused', CANCELLED: 'Cancelled',
};
```

## Component Recipes

### Status Badge

```tsx
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STAGE_INTENT, STAGE_LABEL, INTENT_CLASSES } from '@/lib/status';
import { VisaStage } from '@/lib/enums';

export function StageBadge({ stage }: { stage: VisaStage }) {
  return (
    <Badge variant="outline" className={cn('rounded-md font-medium', INTENT_CLASSES[STAGE_INTENT[stage]])}>
      {STAGE_LABEL[stage]}
    </Badge>
  );
}
```

### Surface / Card

```tsx
<section className="rounded-lg border border-border/40 bg-card p-6 shadow-sm">
  <h2 className="text-lg font-semibold tracking-tight">Work Pool</h2>
  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
    Unclaimed applications waiting in your department queue.
  </p>
</section>
```

### Data Table

Dense rows, hairline separators, muted header, `tabular-nums` for aligned figures. Use the shadcn `Table` primitive; do not build `<table>` by hand.

```tsx
<Table>
  <TableHeader>
    <TableRow className="border-border/40 hover:bg-transparent">
      <TableHead className="text-xs font-medium text-muted-foreground">Applicant</TableHead>
      <TableHead className="text-xs font-medium text-muted-foreground">Stage</TableHead>
      <TableHead className="text-right text-xs font-medium text-muted-foreground">Age</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="border-border/40">
      <TableCell className="font-medium">{app.customerName}</TableCell>
      <TableCell><StageBadge stage={app.currentStage} /></TableCell>
      <TableCell className="text-right font-mono text-xs tabular-nums text-muted-foreground">{age}</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Primary Action + Dialog

One primary button per view; everything else is `variant="outline"`/`"ghost"`. Confirm destructive/God-Mode actions (force-cancel, reassign) with `AlertDialog`.

```tsx
<Button size="sm">Claim</Button>
<Button size="sm" variant="outline">Pause</Button>
```

### Empty / Loading

- Empty state: centered, `text-sm text-muted-foreground`, one clear primary action. No illustrations-as-filler.
- Loading: shadcn `Skeleton` on `bg-muted` matching final layout — never a spinner-only screen for content regions.

## shadcn/ui Setup

Add primitives on demand (do not vendor the whole library upfront):

```bash
npx shadcn@latest init
npx shadcn@latest add button badge table dialog alert-dialog input select dropdown-menu tooltip skeleton sonner
```

Keep `cn()` from `@/lib/utils` for class merging. Extend a component by wrapping it, not by forking generated files.

## Checklist

- [ ] No shadow heavier than `shadow-sm`; depth comes from `border-border/40`.
- [ ] Radii limited to `rounded-md` / `rounded-lg`.
- [ ] Headings `tracking-tight`; secondary text `text-muted-foreground`.
- [ ] Color appears only via the semantic status map — canvas stays monochrome.
- [ ] Every standard control is a shadcn/Radix primitive; icons are `lucide-react`.
- [ ] Layout is responsive (mobile-first → `md:`/`lg:`) and keyboard-focusable.

## Anti-Patterns (AI slop to reject)

- Gradient hero blobs, glassmorphism, and `shadow-2xl` cards.
- Emoji as UI icons, rainbow badges, color used for hierarchy instead of meaning.
- `rounded-full` cards/buttons and oversized `rounded-3xl` corners.
- Hand-rolled dropdowns/modals/tables instead of Radix primitives.
- Arbitrary values (`text-[#3b82f6]`, `p-[13px]`) instead of tokens and the spacing scale.
- Centered marketing-style layouts for dense operational data.
