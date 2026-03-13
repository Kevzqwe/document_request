// Announcements API endpoints
// Connect this to your external SQL database

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'success' | 'warning';
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAnnouncementRequest {
  title: string;
  content: string;
  type: Announcement['type'];
  created_by: string;
}

// TODO: Replace with actual API calls to your SQL backend
export const announcementsApi = {
  getAll: async (): Promise<Announcement[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getActive: async (): Promise<Announcement[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getById: async (id: string): Promise<Announcement | null> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  create: async (data: CreateAnnouncementRequest): Promise<Announcement> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  update: async (id: string, data: Partial<Announcement>): Promise<Announcement> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  toggleActive: async (id: string, isActive: boolean): Promise<void> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  delete: async (id: string): Promise<void> => {
    throw new Error('Not implemented - connect to your SQL database');
  },
};
