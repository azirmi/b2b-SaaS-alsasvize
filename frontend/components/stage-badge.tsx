import { Badge } from '@/components/ui/badge';
import { VisaStage } from '@/lib/enums';
import {
  INTENT_CLASSES,
  STAGE_INTENT,
  STAGE_LABEL,
  STAGE_LABEL_CUSTOMER,
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
      {customerView ? STAGE_LABEL_CUSTOMER[stage] : STAGE_LABEL[stage]}
    </Badge>
  );
}
