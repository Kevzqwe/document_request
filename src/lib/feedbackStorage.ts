// Feedback storage utilities using localStorage

export interface StoredFeedback {
  id: string;
  userId: string;
  email: string;
  messageType: 'inquiry' | 'complaint' | 'suggestion' | 'feedback';
  message: string;
  status: 'pending' | 'read' | 'resolved';
  createdAt: string;
  studentName?: string;
}

const FEEDBACK_KEY = 'feedback';

// Generate unique feedback ID
const generateFeedbackId = (): string => {
  return `feedback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get all feedback from localStorage
export const getAllFeedback = (): StoredFeedback[] => {
  try {
    const stored = localStorage.getItem(FEEDBACK_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Get feedback by ID
export const getFeedbackById = (id: string): StoredFeedback | undefined => {
  const allFeedback = getAllFeedback();
  return allFeedback.find(f => f.id === id);
};

// Add new feedback
export const addFeedback = (
  feedback: Omit<StoredFeedback, 'id' | 'createdAt' | 'status'>
): StoredFeedback => {
  const allFeedback = getAllFeedback();
  const newFeedback: StoredFeedback = {
    ...feedback,
    id: generateFeedbackId(),
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  allFeedback.unshift(newFeedback);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(allFeedback));
  return newFeedback;
};

// Update feedback status
export const updateFeedbackStatus = (id: string, status: StoredFeedback['status']): void => {
  const allFeedback = getAllFeedback();
  const index = allFeedback.findIndex(f => f.id === id);
  if (index !== -1) {
    allFeedback[index].status = status;
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(allFeedback));
  }
};

// Delete feedback
export const deleteFeedback = (id: string): void => {
  const allFeedback = getAllFeedback();
  const filtered = allFeedback.filter(f => f.id !== id);
  localStorage.setItem(FEEDBACK_KEY, JSON.stringify(filtered));
};

// Format message type label
export const getMessageTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    inquiry: 'Inquiry',
    complaint: 'Complaint',
    suggestion: 'Suggestion',
    feedback: 'Feedback',
  };
  return labels[type] || type;
};

export const feedbackStorage = {
  getAll: getAllFeedback,
  getById: getFeedbackById,
  add: addFeedback,
  updateStatus: updateFeedbackStatus,
  delete: deleteFeedback,
  getMessageTypeLabel,
};
