import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FeedbackModal = ({ open, onOpenChange }: FeedbackModalProps) => {
  const { user, profile } = useAuth();
  const [messageType, setMessageType] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!messageType || !message.trim() || !user) return;

    setIsSubmitting(true);
    
    const email = user?.email || profile?.username || '';

    const { error } = await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        email,
        message_type: messageType,
        message: message.trim(),
      });

    if (error) {
      console.error('Error saving feedback:', error);
    }

    setMessageType('');
    setMessage('');
    setIsSubmitting(false);
    setShowSuccess(true);
  };

  const handleCancel = () => {
    setMessageType('');
    setMessage('');
    onOpenChange(false);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !showSuccess} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Send Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user?.email || profile?.username || ''}
                readOnly
                className="bg-muted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="messageType">Message Type</Label>
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger id="messageType">
                  <SelectValue placeholder="Select message type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inquiry">Inquiry</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                  <SelectItem value="suggestion">Suggestion</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                placeholder="Type your message here (minimum 10 characters)..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
              />
              {message.trim().length > 0 && message.trim().length < 10 && (
                <p className="text-xs text-destructive">Message must be at least 10 characters.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !messageType || message.trim().length < 10}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : 'Send'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <DialogTitle className="text-center text-xl">Feedback Sent Successfully!</DialogTitle>
            <p className="text-center text-muted-foreground">
              Thank you for your feedback. We will review it shortly.
            </p>
            <Button onClick={handleSuccessClose} className="mt-4">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FeedbackModal;
