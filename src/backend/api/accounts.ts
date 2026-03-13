// Accounts/Profiles API endpoints
// Connect this to your external SQL database

export interface Account {
  id: string;
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  contact_number: string | null;
  grade_level: string | null;
  section: string | null;
  avatar_url: string | null;
  role: 'student' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface CreateAccountRequest {
  user_id: string;
  username: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  contact_number?: string;
  grade_level?: string;
  section?: string;
  role: 'student' | 'admin';
}

// TODO: Replace with actual API calls to your SQL backend
export const accountsApi = {
  getAll: async (): Promise<Account[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getByUserId: async (userId: string): Promise<Account | null> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  create: async (data: CreateAccountRequest): Promise<Account> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  update: async (id: string, data: Partial<Account>): Promise<Account> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  delete: async (id: string): Promise<void> => {
    throw new Error('Not implemented - connect to your SQL database');
  },
};
