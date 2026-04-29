// Notification storage — backed by Supabase for real-time support
import { supabase } from '@/integrations/supabase/client';

export interface StoredNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  time: string;
  unread: boolean;
  type: 'request' | 'status' | 'announcement' | 'feedback' | 'payment';
  requestId?: string;
  feedbackId?: string;
  feedbackData?: {
    email: string;
    messageType: string;
    message: string;
    studentName?: string;
  };
}

// ── Map DB row → StoredNotification ──────────────────────────────────────────
const mapRow = (row: any): StoredNotification => ({
  id:           row.id,
  userId:       row.user_id,
  title:        row.title,
  message:      row.message,
  time:         row.created_at,
  unread:       !row.is_read,
  type:         row.type,
  requestId:    row.request_id   ?? undefined,
  feedbackId:   row.feedback_id  ?? undefined,
  feedbackData: row.feedback_data ?? undefined,
});

// ── Fetch notifications for a user ────────────────────────────────────────────
const getByUser = async (userId: string, isAdmin = false): Promise<StoredNotification[]> => {
  let query = supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (isAdmin) {
    query = query.in('user_id', [userId, 'admin']);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) { console.error('getByUser error:', error.message); return []; }
  return (data || []).map(mapRow);
};

// ── Add a notification ────────────────────────────────────────────────────────
const add = async (
  notification: Omit<StoredNotification, 'id' | 'time' | 'unread'>
): Promise<void> => {
  const { error } = await supabase.from('notifications').insert({
    user_id:       notification.userId,
    title:         notification.title,
    message:       notification.message,
    type:          notification.type,
    request_id:    notification.requestId    ?? null,
    feedback_id:   notification.feedbackId   ?? null,
    feedback_data: notification.feedbackData ?? null,
    is_read:       false,
  });
  if (error) console.error('add notification error:', error.message);
};

// ── Create request notifications (student + admin) ────────────────────────────
const createRequestNotifications = async (
  requestId: string,
  studentUserId: string,
  studentName: string,
  documentNames: string[],
): Promise<void> => {
  const documentList = documentNames.join(', ');
  await Promise.all([
    add({
      userId:    studentUserId,
      title:     'Request Submitted',
      message:   `Your request for ${documentList} has been submitted and is being processed.`,
      type:      'request',
      requestId,
    }),
    add({
      userId:    'admin',
      title:     'New Document Request',
      message:   `${studentName} requested: ${documentList}`,
      type:      'request',
      requestId,
    }),
  ]);
};

// ── Create status update notification ────────────────────────────────────────
const createStatusNotification = async (
  requestId: string,
  studentUserId: string,
  newStatus: string,
  documentNames: string[],
): Promise<void> => {
  const documentList = documentNames.join(', ');
  await add({
    userId:    studentUserId,
    title:     `Request ${newStatus}`,
    message:   `Your request for ${documentList} is now ${newStatus}.`,
    type:      'status',
    requestId,
  });
};

// ── Create payment notification ───────────────────────────────────────────────
const createPaymentNotification = async (
  requestId: string,
  studentUserId: string,
  studentName: string,
  status: 'paid' | 'pending',
): Promise<void> => {
  await Promise.all([
    add({
      userId:    studentUserId,
      title:     status === 'paid' ? 'Payment Confirmed' : 'Payment Pending',
      message:   status === 'paid'
        ? `Your payment for request ${requestId} has been confirmed.`
        : `Payment for request ${requestId} is pending.`,
      type:      'payment',
      requestId,
    }),
    add({
      userId:    'admin',
      title:     status === 'paid' ? 'Payment Received' : 'Payment Pending',
      message:   status === 'paid'
        ? `${studentName}'s payment for request ${requestId} has been confirmed.`
        : `${studentName}'s payment for request ${requestId} is pending.`,
      type:      'payment',
      requestId,
    }),
  ]);
};

// ── Create feedback notification (admin only) ─────────────────────────────────
const createFeedbackNotification = async (
  feedbackId: string,
  studentUserId: string,
  studentName: string,
  email: string,
  messageType: string,
  message: string,
): Promise<void> => {
  await add({
    userId:    'admin',
    title:     'New Feedback Received',
    message:   `${studentName} sent a ${messageType}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
    type:      'feedback',
    feedbackId,
    feedbackData: { email, messageType, message, studentName },
  });
};

// ── Mark single notification as read ─────────────────────────────────────────
const markAsRead = async (notificationId: string): Promise<void> => {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) console.error('markAsRead error:', error.message);
};

// ── Mark all as read for a user ───────────────────────────────────────────────
const markAllAsRead = async (userId: string, isAdmin = false): Promise<void> => {
  let query = supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false);

  if (isAdmin) {
    query = query.in('user_id', [userId, 'admin']);
  } else {
    query = query.eq('user_id', userId);
  }

  const { error } = await query;
  if (error) console.error('markAllAsRead error:', error.message);
};

// ── Get unread count ──────────────────────────────────────────────────────────
const getUnreadCount = async (userId: string, isAdmin = false): Promise<number> => {
  let query = supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);

  if (isAdmin) {
    query = query.in('user_id', [userId, 'admin']);
  } else {
    query = query.eq('user_id', userId);
  }

  const { count, error } = await query;
  if (error) { console.error('getUnreadCount error:', error.message); return 0; }
  return count ?? 0;
};

// ── Format relative time ──────────────────────────────────────────────────────
export const formatRelativeTime = (dateString: string): string => {
  const date    = new Date(dateString);
  const now     = new Date();
  const diffMs  = now.getTime() - date.getTime();
  const diffMins  = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays  = Math.floor(diffMs / 86400000);

  if (diffMins  < 1)  return 'Just now';
  if (diffMins  < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays  < 7)  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
};

export const notificationStorage = {
  getByUser,
  add,
  createRequestNotifications,
  createStatusNotification,
  createPaymentNotification,
  createFeedbackNotification,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  formatRelativeTime,
};