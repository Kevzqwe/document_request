// Tracking step definitions and utilities

export interface TrackingStep {
  id: string;
  label: string;
  icon: string;
}

export const TRACKING_STEPS: TrackingStep[] = [
  { id: 'submitted', label: 'Request Submitted', icon: 'FileText' },
  { id: 'processing', label: 'Processing', icon: 'Settings' },
  { id: 'approved', label: 'Approved', icon: 'CheckCircle' },
  { id: 'ready', label: 'Ready for Pickup', icon: 'Package' },
  { id: 'completed', label: 'Completed', icon: 'Home' },
];

export const STATUS_TO_STEP: Record<string, number> = {
  'Pending': 0,
  'Submitted': 0,
  'Processing': 1,
  'Approved': 2,
  'Ready': 3,
  'Completed': 4,
};

export const trackingUtils = {
  getStepIndex: (status: string): number => {
    return STATUS_TO_STEP[status] ?? 0;
  },

  isStepCompleted: (status: string, stepIndex: number): boolean => {
    const currentStep = STATUS_TO_STEP[status] ?? 0;
    return stepIndex < currentStep;
  },

  isStepActive: (status: string, stepIndex: number): boolean => {
    const currentStep = STATUS_TO_STEP[status] ?? 0;
    return stepIndex === currentStep;
  },

  getExpectedDate: (requestDate: string, status: string): string => {
    const date = new Date(requestDate);
    // Add 5 business days for processing
    let daysToAdd = 5;
    if (status === 'Approved' || status === 'Ready') {
      daysToAdd = 2;
    } else if (status === 'Completed') {
      daysToAdd = 0;
    }
    
    while (daysToAdd > 0) {
      date.setDate(date.getDate() + 1);
      // Skip weekends
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        daysToAdd--;
      }
    }
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  },
};