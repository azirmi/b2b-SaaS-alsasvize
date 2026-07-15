import { Badge } from '@/components/ui/badge';
import { VisaStage } from '@/lib/enums';
import {
  getCustomerStageName,
  INTENT_CLASSES,
  STAGE_INTENT,
  STAGE_LABEL,
} from '@/lib/status';
import { cn } from '@/lib/utils';

/** Renders a visa application stage as a semantic status badge. */
export function StageBadge({
  stage,
  className,
  customerView = false,
}: {
  stage: VisaStage;
  className?: string;
  customerView?: boolean;
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
      {customerView ? getCustomerStageName(stage) : STAGE_LABEL[stage]}
    </Badge>
  );
}
