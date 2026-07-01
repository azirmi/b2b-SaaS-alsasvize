import { Badge } from '@/components/ui/badge';
import { VisaStage } from '@/lib/enums';
import { INTENT_CLASSES, STAGE_INTENT, STAGE_LABEL } from '@/lib/status';
import { cn } from '@/lib/utils';

/** Renders a visa application stage as a semantic status badge. */
export function StageBadge({
  stage,
  className,
}: {
  stage: VisaStage;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'rounded-md font-medium',
        INTENT_CLASSES[STAGE_INTENT[stage]],
        className,
      )}
    >
      {STAGE_LABEL[stage]}
    </Badge>
  );
}
