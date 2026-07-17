import { Badge } from '@/components/ui/badge';
import { VisaStage } from '@/lib/enums';
import {
  getCustomerStageName,
  getStageIntent,
  getStageLabel,
  INTENT_CLASSES,
  type StageDisplayContext,
} from '@/lib/status';
import { cn } from '@/lib/utils';

/** Renders a visa application stage as a semantic status badge. */
export function StageBadge({
  stage,
  className,
  customerView = false,
  context,
}: {
  stage: VisaStage;
  className?: string;
  customerView?: boolean;
  context?: StageDisplayContext;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-md font-medium',
        INTENT_CLASSES[getStageIntent(stage, context)],
        className,
      )}
    >
      {customerView
        ? getCustomerStageName(stage, context)
        : getStageLabel(stage, context)}
    </Badge>
  );
}
