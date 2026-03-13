import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FileText, CheckCircle2, Loader2, CreditCard } from 'lucide-react';
import { DOCUMENT_TYPES, PAYMENT_METHODS, documentUtils } from '@/lib/documents';
import { smsService } from '@/lib/smsService';

import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { saveRequestToDb } from '@/lib/saveRequestToDb';

const DocumentRequest = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showPaymentPendingModal, setShowPaymentPendingModal] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string>('');
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Use AuthContext profile directly (database source of truth)
  const displayProfile = {
    firstName: profile?.firstName || '',
    middleName: profile?.middleName || '',
    lastName: profile?.lastName || '',
    contactNumber: profile?.contactNumber || '',
    gradeLevel: profile?.gradeLevel || '',
    section: profile?.section || '',
    user_id: profile?.user_id || user?.id || '',
  };

  const handleDocumentToggle = (value: string) => {
    setSelectedDocuments(prev =>
      prev.includes(value)
        ? prev.filter(doc => doc !== value)
        : [...prev, value]
    );
  };

  const handleCashPayment = async () => {
    // Get document labels for storage
    const documentLabels = selectedDocuments
      .map(docValue => documentUtils.getDocumentByValue(docValue)?.label)
      .filter(Boolean) as string[];

    const totalAmount = documentUtils.calculateTotal(selectedDocuments);
    const studentName = `${displayProfile.firstName} ${displayProfile.lastName}`.trim();

    // Save to Supabase database
    const savedRequest = await saveRequestToDb({
      userId: displayProfile.user_id,
      studentName,
      contactNumber: displayProfile.contactNumber,
      gradeLevel: displayProfile.gradeLevel,
      section: displayProfile.section,
      documents: documentLabels,
      paymentMethod: 'cash',
      totalAmount,
      paymentStatus: 'pending',
    });

    if (!savedRequest) {
      toast({
        title: 'Error',
        description: 'Failed to submit request. Please try again.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    const formattedId = `REQ-${String(savedRequest.request_number).padStart(3, '0')}`;
    setSubmittedRequestId(formattedId);

    // Send SMS notification
    if (displayProfile.contactNumber) {
      await smsService.notifyNewRequest(
        displayProfile.contactNumber,
        studentName,
        formattedId,
        documentLabels
      );
    }

    setShowSuccessModal(true);
    setSelectedDocuments([]);
    setPaymentMethod('');
  };

  // Cleanup polling and realtime on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, []);

  const startPaymentPolling = (invoiceId: string) => {
    // Start polling for payment status
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { sessionId: invoiceId },
        });

        if (error) {
          console.error('Polling error:', error);
          return;
        }

        if (data.verified) {
          // Payment confirmed! Stop polling and redirect
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setShowPaymentPendingModal(false);
          
          // Navigate to success page WITH invoice_id to ensure it works
          navigate(`/payment-success?invoice_id=${invoiceId}`);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000); // Poll every 3 seconds

    // Also listen for realtime broadcast
    realtimeChannelRef.current = supabase
      .channel('payment-updates')
      .on('broadcast', { event: 'payment-confirmed' }, (payload) => {
        console.log('Realtime payment update:', payload);
        if (payload.payload?.invoiceId === invoiceId) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setShowPaymentPendingModal(false);
          navigate(`/payment-success?invoice_id=${invoiceId}`);
        }
      })
      .subscribe();
  };

  const handleOnlinePayment = async () => {
    const documentLabels = selectedDocuments
      .map(docValue => documentUtils.getDocumentByValue(docValue)?.label)
      .filter(Boolean) as string[];

    const totalAmount = documentUtils.calculateTotal(selectedDocuments);
    const studentName = `${displayProfile.firstName} ${displayProfile.lastName}`.trim();
    
    // Get the current origin for redirect URLs
    const currentOrigin = window.location.origin;

    try {
      // Create Xendit checkout session
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          amount: totalAmount,
          description: `Document Request - ${documentLabels.join(', ')}`,
          studentName,
          contactNumber: displayProfile.contactNumber,
          documents: documentLabels,
          userId: displayProfile.user_id,
          gradeLevel: displayProfile.gradeLevel,
          section: displayProfile.section,
          paymentMethod,
          successUrl: `${currentOrigin}/payment-success`,
          cancelUrl: `${currentOrigin}/payment-cancel`,
        },
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Store the invoice ID in localStorage for verification after redirect
      const invoiceId = data.checkoutSessionId;
      console.log('Storing invoice ID:', invoiceId);
      localStorage.setItem('pending_xendit_invoice', invoiceId);

      // Show pending modal and start polling
      setShowPaymentPendingModal(true);
      startPaymentPolling(invoiceId);

      // Open Xendit checkout in a new tab
      window.open(data.checkoutUrl, '_blank');
      
    } catch (err) {
      console.error('Checkout error:', err);
      toast({
        title: 'Payment Error',
        description: err instanceof Error ? err.message : 'Failed to initiate payment. Please try again.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedDocuments.length === 0 || !paymentMethod) {
      return;
    }

    setIsSubmitting(true);

    // Check if cash or online payment
    if (paymentMethod === 'cash') {
      await handleCashPayment();
      setIsSubmitting(false);
    } else {
      // Online payment (gcash or maya)
      await handleOnlinePayment();
      // isSubmitting stays true until payment is confirmed or cancelled
    }
  };

  const totalAmount = documentUtils.calculateTotal(selectedDocuments);
  const isOnlinePayment = paymentMethod === 'online';

  return (
    <>
      <div className="max-w-3xl mx-auto">
        <Card className="border-2 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-accent/10 border-b">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl">Document Request Form</CardTitle>
                <CardDescription>Fill out the form to request a document</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information (Locked) */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      value={displayProfile.lastName}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      value={displayProfile.firstName}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="middleName">Middle Name</Label>
                    <Input
                      id="middleName"
                      value={displayProfile.middleName}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactNumber">Contact Number</Label>
                    <Input
                      id="contactNumber"
                      value={displayProfile.contactNumber}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gradeLevel">Grade Level & Section</Label>
                    <Input
                      id="gradeLevel"
                      value={`${displayProfile.gradeLevel} - ${displayProfile.section}`}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>

              {/* Document Type */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Document Request</h3>
                <div className="space-y-3">
                  <Label className="text-base">Select Documents * (You can select multiple)</Label>
                  {DOCUMENT_TYPES.map((doc) => (
                    <div
                      key={doc.value}
                      className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={doc.value}
                        checked={selectedDocuments.includes(doc.value)}
                        onCheckedChange={() => handleDocumentToggle(doc.value)}
                      />
                      <Label
                        htmlFor={doc.value}
                        className="flex-1 cursor-pointer flex justify-between items-center"
                      >
                        <span className="font-medium">{doc.label}</span>
                        <span className="text-muted-foreground">{documentUtils.formatPrice(doc.price)}</span>
                      </Label>
                    </div>
                  ))}
                </div>
                
                {selectedDocuments.length > 0 && (
                  <div className="p-4 bg-primary/10 border-2 border-primary/30 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Selected Documents:</span>
                      <span className="text-sm text-primary">{selectedDocuments.length} item(s)</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedDocuments.map(docValue => {
                        const doc = documentUtils.getDocumentByValue(docValue);
                        return doc ? (
                          <span key={docValue} className="text-xs bg-white/50 px-2 py-1 rounded">
                            {doc.label}
                          </span>
                        ) : null;
                      })}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-primary/20">
                      <span className="text-sm text-muted-foreground">Total Amount:</span>
                      <span className="text-2xl font-bold text-primary">{documentUtils.formatPrice(totalAmount)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Method */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Payment Method</h3>
                <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                  <div className="space-y-3">
                    {PAYMENT_METHODS.map((method) => (
                      <div
                        key={method.value}
                        className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <RadioGroupItem value={method.value} id={method.value} />
                        <Label htmlFor={method.value} className="flex-1 cursor-pointer">
                          <div className="font-medium">{method.label}</div>
                          <div className="text-sm text-muted-foreground">
                            {method.description}
                          </div>
                        </Label>
                      </div>
                    ))}
                  </div>
                </RadioGroup>
              </div>

              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary-light text-lg py-6"
                disabled={isSubmitting || selectedDocuments.length === 0 || !paymentMethod}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    {isOnlinePayment ? 'Redirecting to Payment...' : 'Submitting Request...'}
                  </>
                ) : isOnlinePayment ? (
                  <>
                    <CreditCard className="w-5 h-5 mr-2" />
                    Proceed to Payment
                  </>
                ) : (
                  'Submit Request'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">Request Submitted!</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              Your document request <span className="font-semibold text-primary">{submittedRequestId}</span> has been successfully submitted and is now being processed. 
              You can track the status in the Request History section.
            </DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => setShowSuccessModal(false)}
            className="w-full mt-4"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>

      {/* Payment Pending Modal */}
      <Dialog open={showPaymentPendingModal} onOpenChange={(open) => {
        if (!open) {
          // User closed modal - stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          if (realtimeChannelRef.current) {
            supabase.removeChannel(realtimeChannelRef.current);
          }
          setIsSubmitting(false);
        }
        setShowPaymentPendingModal(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">Completing Payment...</DialogTitle>
            <DialogDescription className="text-center text-base pt-2">
              A new tab has opened for you to complete the payment. 
              This page will automatically update once your payment is confirmed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <p className="text-sm text-center text-muted-foreground">
              Don't see the payment page? 
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const invoiceId = localStorage.getItem('pending_xendit_invoice');
                if (invoiceId) {
                  // Re-open the payment page
                  supabase.functions.invoke('verify-payment', {
                    body: { sessionId: invoiceId },
                  }).then(({ data }) => {
                    if (data?.checkoutUrl) {
                      window.open(data.checkoutUrl, '_blank');
                    }
                  });
                }
              }}
              className="w-full"
            >
              Open Payment Page Again
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowPaymentPendingModal(false);
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                }
                if (realtimeChannelRef.current) {
                  supabase.removeChannel(realtimeChannelRef.current);
                }
                setIsSubmitting(false);
              }}
              className="w-full"
            >
              Cancel Payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentRequest;