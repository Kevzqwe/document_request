// Analytics API endpoints
// Connect this to your external SQL database

export interface AnalyticsSummary {
  totalRequests: number;
  pendingRequests: number;
  completedRequests: number;
  totalRevenue: number;
  averageProcessingTime: number;
}

export interface RequestsByStatus {
  status: string;
  count: number;
}

export interface RequestsByDocument {
  documentType: string;
  count: number;
  revenue: number;
}

export interface RequestsTrend {
  date: string;
  count: number;
}

// TODO: Replace with actual API calls to your SQL backend
export const analyticsApi = {
  getSummary: async (): Promise<AnalyticsSummary> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getRequestsByStatus: async (): Promise<RequestsByStatus[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getRequestsByDocument: async (): Promise<RequestsByDocument[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getRequestsTrend: async (startDate: string, endDate: string): Promise<RequestsTrend[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getRevenueByMonth: async (year: number): Promise<{ month: string; revenue: number }[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },
};
