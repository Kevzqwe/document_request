// Feedback API endpoints
// Connect this to your external SQL database

export interface Feedback {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  category: 'general' | 'service' | 'website' | 'other';
  created_at: string;
}

export interface CreateFeedbackRequest {
  user_id: string;
  rating: number;
  comment?: string;
  category: Feedback['category'];
}

// TODO: Replace with actual API calls to your SQL backend
export const feedbackApi = {
  getAll: async (): Promise<Feedback[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getByUserId: async (userId: string): Promise<Feedback[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  create: async (data: CreateFeedbackRequest): Promise<Feedback> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  delete: async (id: string): Promise<void> => {
    throw new Error('Not implemented - connect to your SQL database');
  },
};
