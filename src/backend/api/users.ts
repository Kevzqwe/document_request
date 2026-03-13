// Users API endpoints
// Connect this to your external SQL database

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  role: 'student' | 'admin';
}

// TODO: Replace with actual API calls to your SQL backend
export const usersApi = {
  getAll: async (): Promise<User[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getById: async (id: string): Promise<User | null> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  create: async (data: CreateUserRequest): Promise<User> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  update: async (id: string, data: Partial<User>): Promise<User> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  delete: async (id: string): Promise<void> => {
    throw new Error('Not implemented - connect to your SQL database');
  },
};
