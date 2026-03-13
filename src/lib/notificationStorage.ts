// Notification storage utilities using localStorage

export interface StoredNotification {
  id: string;
  userId: string; // 'admin' for admin notifications, or specific user ID
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: 'request' | 'status' | 'announcement' | 'feedback';
  requestId?: string;
  feedbackId?: string;
  feedbackData?: {
    email: string;
    messageType: string;
    message: string;
    studentName?: string;
  };
}

const NOTIFICATIONS_KEY = 'notifications';

// Generate unique notification ID
const generateNotificationId = (): string => {
  return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get all notifications from localStorage
export const getAllNotifications = (): StoredNotification[] => {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Get notifications for a specific user (includes 'admin' for admin users)
export const getUserNotifications = (userId: string, isAdmin: boolean = false): StoredNotification[] => {
  const allNotifications = getAllNotifications();
  const userNotifications = allNotifications.filter(
    (n) => n.userId === userId || (isAdmin && n.userId === 'admin')
  );
  return userNotifications.sort(
    (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
  );
};

// Add a new notification
export const addNotification = (
  notification: Omit<StoredNotification, 'id' | 'time' | 'unread'>
): StoredNotification => {
  const notifications = getAllNotifications();
  const newNotification: StoredNotification = {
    ...notification,
    id: generateNotificationId(),
    time: new Date().toISOString(),
    unread: true,
  };
  notifications.unshift(newNotification);
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  return newNotification;
};

// Create notifications for new request (both student and admin)
export const createRequestNotifications = (
  requestId: string,
  studentUserId: string,
  studentName: string,
  documentNames: string[]
): void => {
  const documentList = documentNames.join(', ');
  
  // Notification for student
  addNotification({
    userId: studentUserId,
    title: 'Request Submitted',
    message: `Your request for ${documentList} has been submitted and is being processed.`,
    type: 'request',
    requestId,
  });

  // Notification for admin
  addNotification({
    userId: 'admin',
    title: 'New Document Request',
    message: `${studentName} requested: ${documentList}`,
    type: 'request',
    requestId,
  });
};

// Create notification for status update
export const createStatusNotification = (
  requestId: string,
  studentUserId: string,
  newStatus: string,
  documentNames: string[]
): void => {
  const documentList = documentNames.join(', ');
  
  addNotification({
    userId: studentUserId,
    title: `Request ${newStatus}`,
    message: `Your request for ${documentList} is now ${newStatus}.`,
    type: 'status',
    requestId,
  });
};

// Create notification for new feedback (admin only)
export const createFeedbackNotification = (
  feedbackId: string,
  studentUserId: string,
  studentName: string,
  email: string,
  messageType: string,
  message: string
): void => {
  addNotification({
    userId: 'admin',
    title: 'New Feedback Received',
    message: `${studentName} sent a ${messageType}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
    type: 'feedback',
    feedbackId,
    feedbackData: {
      email,
      messageType,
      message,
      studentName,
    },
  });
};

// Mark notification as read
export const markAsRead = (notificationId: string): void => {
  const notifications = getAllNotifications();
  const index = notifications.findIndex(n => n.id === notificationId);
  if (index !== -1) {
    notifications[index].unread = false;
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
  }
};

// Mark all notifications as read for a user
export const markAllAsRead = (userId: string, isAdmin: boolean = false): void => {
  const notifications = getAllNotifications();
  notifications.forEach(n => {
    if (n.userId === userId || (isAdmin && n.userId === 'admin')) {
      n.unread = false;
    }
  });
  localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
};

// Get unread count for a user
export const getUnreadCount = (userId: string, isAdmin: boolean = false): number => {
  const notifications = getUserNotifications(userId, isAdmin);
  return notifications.filter(n => n.unread).length;
};

// Clear all notifications (for development)
export const clearAllNotifications = (): void => {
  localStorage.removeItem(NOTIFICATIONS_KEY);
};

// Format relative time
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

export const notificationStorage = {
  getAll: getAllNotifications,
  getByUser: getUserNotifications,
  add: addNotification,
  createRequestNotifications,
  createStatusNotification,
  createFeedbackNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  formatRelativeTime,
  clear: clearAllNotifications,
};
