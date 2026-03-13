// Status utilities for requests and messages

export type RequestStatus = 'Pending' | 'Ongoing' | 'Processing' | 'Approved' | 'Ready for Pick up' | 'Complete' | 'Completed';
export type MessageStatus = 'New' | 'Read';
export type MessageType = 'Inquiry' | 'Complaint' | 'Suggestion' | 'Feedback';

// Status color utilities
export const statusUtils = {
  // Get status color class for requests
  getRequestStatusColor: (status: string): string => {
    switch (status) {
      case 'Complete':
      case 'Completed':
        return 'bg-success text-success-foreground';
      case 'Approved':
      case 'Ready for Pick up':
        return 'bg-primary text-primary-foreground';
      case 'Ongoing':
      case 'Processing':
        return 'bg-warning text-warning-foreground';
      case 'Pending':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  },

  // Get status color class for messages
  getMessageStatusColor: (status: string): string => {
    switch (status) {
      case 'New':
        return 'bg-primary text-primary-foreground';
      case 'Read':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  },

  // Get message type color class
  getMessageTypeColor: (type: string): string => {
    switch (type) {
      case 'Inquiry':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'Complaint':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      case 'Suggestion':
        return 'bg-success/10 text-success border-success/20';
      case 'Feedback':
        return 'bg-accent/10 text-accent border-accent/20';
      default:
        return 'bg-muted text-muted-foreground border-muted/20';
    }
  },
};
