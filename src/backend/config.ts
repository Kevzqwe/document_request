// Backend configuration
// Configure your external SQL database connection here

export const backendConfig = {
  // Replace with your actual API base URL
  apiBaseUrl: (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001/api',
  
  // Request timeout in milliseconds
  timeout: 30000,
  
  // Headers to include with every request
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
};

// Helper function to make API requests
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${backendConfig.apiBaseUrl}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      ...backendConfig.defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Helper to get auth token from storage
export function getAuthToken(): string | null {
  const session = localStorage.getItem('auth_session');
  if (session) {
    try {
      const parsed = JSON.parse(session);
      return parsed.token || null;
    } catch {
      return null;
    }
  }
  return null;
}

// Helper for authenticated requests
export async function authenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken();
  
  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
