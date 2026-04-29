import { FileText, Settings, CheckCircle, Package, Home, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TRACKING_STEPS, trackingUtils } from '@/lib/tracking';

interface TrackingStepperProps {
  status: string;
  paymentStatus?: string;  // ← NEW: 'paid' | 'pending'
}

const iconMap: Record<string, React.ElementType> = {
  FileText,
  Settings,
  CheckCircle,
  Package,
  Home,
  CreditCard,
};

const TrackingStepper = ({ status, paymentStatus = 'pending' }: TrackingStepperProps) => {
  return (
    <div className="flex items-start justify-between w-full px-2">
      {TRACKING_STEPS.map((step, index) => {
        const isCompleted = trackingUtils.isStepCompleted(status, index, paymentStatus);
        const isActive    = trackingUtils.isStepActive(status, index, paymentStatus);
        const IconComponent = iconMap[step.icon];
        const isLast = index === TRACKING_STEPS.length - 1;

        // Payment step gets special color when active (unpaid = amber warning)
        const isPaymentStep = step.id === 'payment';
        const isUnpaid = isPaymentStep && isActive && paymentStatus?.toLowerCase() !== 'paid';

        return (
          <div key={step.id} className="flex items-start flex-1 last:flex-none">
            <div className="flex flex-col items-center min-w-[48px] md:min-w-[60px]">
              <div
                className={cn(
                  'w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-300 shrink-0',
                  isCompleted && 'bg-primary border-primary text-primary-foreground',
                  isActive && !isUnpaid && 'bg-primary border-primary text-primary-foreground ring-4 ring-primary/30',
                  isUnpaid && 'bg-amber-500 border-amber-500 text-white ring-4 ring-amber-300',
                  !isCompleted && !isActive && 'bg-muted border-muted-foreground/30 text-muted-foreground'
                )}
              >
                <IconComponent className="w-4 h-4 md:w-5 md:h-5" />
              </div>
              <span
                className={cn(
                  'text-[10px] md:text-xs mt-1.5 text-center font-medium leading-tight',
                  isCompleted || isActive ? 'text-foreground' : 'text-muted-foreground',
                  isUnpaid && 'text-amber-600',
                )}
              >
                {/* Show Paid/Unpaid label on payment step */}
                {isPaymentStep
                  ? paymentStatus?.toLowerCase() === 'paid' ? 'Paid' : 'Unpaid'
                  : step.label}
              </span>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={cn(
                  'flex-1 h-0.5 mt-5 md:mt-6 mx-1 md:mx-2 transition-all duration-300',
                  isCompleted ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TrackingStepper;