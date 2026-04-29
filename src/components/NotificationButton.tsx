import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, FileText, Info, MessageSquare, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { notificationStorage, StoredNotification, formatRelativeTime } from '@/lib/notificationStorage';
import { feedbackStorage } from '@/lib/feedbackStorage';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const NotificationButton = () => {
  const { user, profile } = useAuth();
  const [notifications, setNotifications] = useState<StoredNotification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<StoredNotification | null>(null);
  const [modalOpen, setModalOpen]         = useState(false);

  const isAdmin = profile?.role === 'admin' ||
                  profile?.role === 'cashier' ||
                  profile?.role === 'programhead';

  // ── Fetch notifications ────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return;
    const data = await notificationStorage.getByUser(user.id, isAdmin);
    setNotifications(data.slice(0, 15));
    setUnreadCount(data.filter(n => n.unread).length);
  }, [user?.id, isAdmin]);

  // ── Initial fetch + realtime subscription ─────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;

    fetchNotifications();

    // Subscribe to new notifications for this user
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'notifications',
          // Listen for rows targeting this user OR 'admin'
        },
        (payload) => {
          const row = payload.new as any;
          // Only refresh if this notification is for the current user
          if (
            row?.user_id === user.id ||
            row?.user_id === 'admin' && isAdmin
          ) {
            fetchNotifications();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, isAdmin, fetchNotifications]);

  // Refresh when popover opens
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open]);

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    await notificationStorage.markAllAsRead(user.id, isAdmin);
    fetchNotifications();
  };

  const handleNotificationClick = async (notification: StoredNotification) => {
    await notificationStorage.markAsRead(notification.id);
    setSelectedNotification(notification);
    setModalOpen(true);
    setOpen(false);
    fetchNotifications();
  };

  const getNotificationIcon = (type: StoredNotification['type']) => {
    switch (type) {
      case 'feedback':    return <MessageSquare className="w-4 h-4" />;
      case 'payment':     return <CreditCard    className="w-4 h-4" />;
      case 'request':
      case 'status':      return <FileText      className="w-4 h-4" />;
      default:            return <Info          className="w-4 h-4" />;
    }
  };

  const getNotificationColor = (type: StoredNotification['type']) => {
    switch (type) {
      case 'payment':     return 'text-green-600';
      case 'feedback':    return 'text-blue-600';
      case 'status':      return 'text-amber-600';
      default:            return 'text-primary';
    }
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'complaint':  return 'bg-destructive/10 text-destructive';
      case 'suggestion': return 'bg-blue-100 text-blue-700';
      case 'inquiry':    return 'bg-amber-100 text-amber-700';
      default:           return 'bg-primary/10 text-primary';
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center bg-destructive text-destructive-foreground text-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleMarkAllAsRead}>
                  <Check className="w-3 h-3 mr-1" />
                  Mark all read
                </Button>
              )}
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'p-3 rounded-lg border transition-colors cursor-pointer',
                      notification.unread
                        ? 'bg-primary/5 border-primary/20 hover:bg-primary/10'
                        : 'bg-muted/50 border-border hover:bg-muted'
                    )}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className={cn('flex items-center gap-2', getNotificationColor(notification.type))}>
                        {getNotificationIcon(notification.type)}
                        <h4 className="font-medium text-sm text-foreground">{notification.title}</h4>
                      </div>
                      {notification.unread && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-1 line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(notification.time)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Notification Detail Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedNotification && (
                <span className={getNotificationColor(selectedNotification.type)}>
                  {getNotificationIcon(selectedNotification.type)}
                </span>
              )}
              {selectedNotification?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedNotification && (
            <div className="space-y-4 py-4">
              {/* Feedback details */}
              {selectedNotification.type === 'feedback' && selectedNotification.feedbackData && (
                <>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">From</p>
                    <p className="font-medium">{selectedNotification.feedbackData.studentName}</p>
                    <p className="text-sm text-muted-foreground">{selectedNotification.feedbackData.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Type</p>
                    <Badge className={cn('capitalize', getMessageTypeColor(selectedNotification.feedbackData.messageType))}>
                      {feedbackStorage.getMessageTypeLabel(selectedNotification.feedbackData.messageType)}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Message</p>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{selectedNotification.feedbackData.message}</p>
                    </div>
                  </div>
                </>
              )}

              {/* General / payment / status / request details */}
              {selectedNotification.type !== 'feedback' && (
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Details</p>
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm">{selectedNotification.message}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-2">
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(selectedNotification.time)}
                </p>
                <Button onClick={() => setModalOpen(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationButton;