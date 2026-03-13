// Request storage utilities using localStorage

export interface StoredRequest {
  id: string;
  userId: string;
  studentName: string;
  documents: string[];
  requestDate: string;
  status: string;
  paymentMethod: string;
  amount: string;
  gradeLevel: string;
  section: string;
  contactNumber: string;
  claimDate: string;
  referenceNumber?: string | null;
  paidAt?: string | null;
}

const REQUESTS_KEY = 'document_requests';
const ARCHIVED_REQUESTS_KEY = 'archived_document_requests';

// Generate unique request ID
const generateRequestId = (): string => {
  const requests = getAllRequests();
  const nextNumber = requests.length + 1;
  return `REQ-${String(nextNumber).padStart(3, '0')}`;
};

// Get all requests from localStorage
export const getAllRequests = (): StoredRequest[] => {
  try {
    const stored = localStorage.getItem(REQUESTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Get archived requests from localStorage
export const getArchivedRequests = (): StoredRequest[] => {
  try {
    const stored = localStorage.getItem(ARCHIVED_REQUESTS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Get requests for a specific user
export const getUserRequests = (userId: string): StoredRequest[] => {
  const allRequests = getAllRequests();
  const archivedRequests = getArchivedRequests();
  const userRequests = [...allRequests, ...archivedRequests].filter(
    (req) => req.userId === userId
  );
  return userRequests.sort(
    (a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime()
  );
};

// Add a new request
export const addRequest = (
  request: Omit<StoredRequest, 'id' | 'status' | 'claimDate'>
): StoredRequest => {
  const requests = getAllRequests();
  const newRequest: StoredRequest = {
    ...request,
    id: generateRequestId(),
    status: 'Processing',
    claimDate: 'TBA',
  };
  requests.unshift(newRequest);
  localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
  return newRequest;
};

// Update request status
export const updateRequestStatus = (
  requestId: string,
  newStatus: string
): StoredRequest | null => {
  const requests = getAllRequests();
  const requestIndex = requests.findIndex((r) => r.id === requestId);

  if (requestIndex === -1) return null;

  requests[requestIndex].status = newStatus;

  // If completed, move to archived
  if (newStatus === 'Completed') {
    const completedRequest = requests[requestIndex];
    completedRequest.claimDate = new Date().toISOString().split('T')[0];
    
    // Remove from active requests
    requests.splice(requestIndex, 1);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
    
    // Add to archived
    const archived = getArchivedRequests();
    archived.unshift(completedRequest);
    localStorage.setItem(ARCHIVED_REQUESTS_KEY, JSON.stringify(archived));
    
    return completedRequest;
  }

  localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));
  return requests[requestIndex];
};

// Clear all requests (for development)
export const clearAllRequests = (): void => {
  localStorage.removeItem(REQUESTS_KEY);
  localStorage.removeItem(ARCHIVED_REQUESTS_KEY);
};

export const requestStorage = {
  getAll: getAllRequests,
  getArchived: getArchivedRequests,
  getByUser: getUserRequests,
  add: addRequest,
  updateStatus: updateRequestStatus,
  clear: clearAllRequests,
  generateId: generateRequestId,
};
