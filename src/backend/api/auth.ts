// Authentication API endpoints
// Connect this to your external SQL database

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
  };
  profile?: {
    id: string;
    user_id: string;
    username: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    contactNumber: string | null;
    gradeLevel: string | null;
    section: string | null;
    avatarUrl: string | null;
    role: 'student' | 'admin';
  };
  error?: string;
}

// TODO: Replace with actual API calls to your SQL backend
export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    // Replace this with your actual API endpoint
    // Example: const response = await fetch('YOUR_API_URL/auth/login', { ... })
    throw new Error('Not implemented - connect to your SQL database');
  },

  logout: async (): Promise<void> => {
    // Replace this with your actual API endpoint
    throw new Error('Not implemented - connect to your SQL database');
  },

  getCurrentUser: async (): Promise<LoginResponse> => {
    // Replace this with your actual API endpoint
    throw new Error('Not implemented - connect to your SQL database');
  },
};
