// Tracking step definitions and utilities

export interface TrackingStep {
  id: string;
  label: string;
  icon: string;
}

export const TRACKING_STEPS: TrackingStep[] = [
  { id: 'submitted',  label: 'Request Submitted', icon: 'FileText'     },
  { id: 'payment',    label: 'Payment',            icon: 'CreditCard'   },
  { id: 'processing', label: 'Processing',         icon: 'Settings'     },
  { id: 'approved',   label: 'Approved',           icon: 'CheckCircle'  },
  { id: 'ready',      label: 'Ready for Pickup',   icon: 'Package'      },
  { id: 'completed',  label: 'Completed',          icon: 'Home'         },
];

// Maps request status → stepper index (starts at step 2 = Processing)
// Payment step (index 1) is handled separately via paymentStatus
export const STATUS_TO_STEP: Record<string, number> = {
  'Pending':    1,   // submitted, waiting for payment
  'Submitted':  1,
  'Processing': 2,
  'Approved':   3,
  'Ready':      4,
  'Completed':  5,
};

export const trackingUtils = {
  getStepIndex: (status: string): number => {
    return STATUS_TO_STEP[status] ?? 1;
  },

  isStepCompleted: (status: string, stepIndex: number, paymentStatus?: string): boolean => {
    const currentStep = STATUS_TO_STEP[status] ?? 1;
    // Payment step (index 1) is complete when paymentStatus === 'paid'
    if (stepIndex === 1) {
      return paymentStatus?.toLowerCase() === 'paid';
    }
    return stepIndex < currentStep;
  },

  isStepActive: (status: string, stepIndex: number, paymentStatus?: string): boolean => {
    const currentStep = STATUS_TO_STEP[status] ?? 1;
    // Payment step is active when submitted but not yet paid
    if (stepIndex === 1) {
      const isPaid = paymentStatus?.toLowerCase() === 'paid';
      return !isPaid && currentStep <= 1;
    }
    return stepIndex === currentStep;
  },

  getExpectedDate: (requestDate: string, status: string): string => {
    const date = new Date(requestDate);
    let daysToAdd = 5;
    if (status === 'Approved' || status === 'Ready') {
      daysToAdd = 2;
    } else if (status === 'Completed') {
      daysToAdd = 0;
    }
    while (daysToAdd > 0) {
      date.setDate(date.getDate() + 1);
      if (date.getDay() !== 0 && date.getDay() !== 6) daysToAdd--;
    }
    return date.toLocaleDateString('en-US', {
      month: 'short', day: '2-digit', year: 'numeric',
    });
  },
};