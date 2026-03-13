// Document Requests API endpoints
// Connect this to your external SQL database

export interface DocumentRequest {
  id: string;
  user_id: string;
  request_number: string;
  status: 'pending' | 'processing' | 'approved' | 'completed' | 'rejected';
  purpose: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRequestItem {
  id: string;
  request_id: string;
  document_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CreateDocumentRequestInput {
  user_id: string;
  purpose: string;
  notes?: string;
  items: {
    document_type: string;
    quantity: number;
    unit_price: number;
  }[];
}

// TODO: Replace with actual API calls to your SQL backend
export const documentRequestsApi = {
  getAll: async (): Promise<DocumentRequest[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getByUserId: async (userId: string): Promise<DocumentRequest[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  getById: async (id: string): Promise<DocumentRequest | null> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  create: async (data: CreateDocumentRequestInput): Promise<DocumentRequest> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  updateStatus: async (id: string, status: DocumentRequest['status']): Promise<DocumentRequest> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  delete: async (id: string): Promise<void> => {
    throw new Error('Not implemented - connect to your SQL database');
  },

  // Request Items
  getRequestItems: async (requestId: string): Promise<DocumentRequestItem[]> => {
    throw new Error('Not implemented - connect to your SQL database');
  },
};
