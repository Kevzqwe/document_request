// Notifications API endpoints
// Connect this to your external SQL database

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export interface CreateNotificationRequest {
  user_id: string;
  title: string;
  message: string;
  type: Notification['type'];
}

// TODO: Replace with actual API calls to your SQL backend
export const notificationsApi = {
  getAll: async (): Promise<Notification[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getByUserId: async (userId: string): Promise<Notification[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getUnreadCount: async (userId: string): Promise<number> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  create: async (data: CreateNotificationRequest): Promise<Notification> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  markAsRead: async (id: string): Promise<void> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  markAllAsRead: async (userId: string): Promise<void> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  delete: async (id: string): Promise<void> => {
    throw new Error('Not implemented - connect to your SQL database');
  },
};
