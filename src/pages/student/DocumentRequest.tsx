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
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
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

  const displayProfile = {
    firstName:     profile?.firstName     || '',
    middleName:    profile?.middleName    || '',
    lastName:      profile?.lastName      || '',
    contactNumber: profile?.contactNumber || '',
    gradeLevel:    profile?.gradeLevel    || '',
    section:       profile?.section       || '',
    username:      profile?.username      || user?.email || '',
    user_id:       profile?.user_id       || user?.id    || '',
  };

  const handleDocumentToggle = (value: string) => {
    setSelectedDocuments(prev =>
      prev.includes(value) ? prev.filter(d => d !== value) : [...prev, value]
    );
  };

  // ── Send confirmation email using REAL reference number ───────────────────
  const sendConfirmationEmail = async (
    referenceNumber: string,
    documentLabels: string[],
    totalAmount: number,
    method: string,
  ) => {
    if (!displayProfile.username) return;
    try {
      const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      await fetch(`${supabaseUrl}/functions/v1/send-request-email`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey':        supabaseAnonKey,
        },
        body: JSON.stringify({
          to:              displayProfile.username,
          studentName:     `${displayProfile.firstName} ${displayProfile.lastName}`.trim(),
          contactNumber:   displayProfile.contactNumber,
          gradeLevel:      displayProfile.gradeLevel,
          section:         displayProfile.section,
          referenceNumber,
          documents:       documentLabels,
          quantities:      documentLabels.map(() => 1),
          totalAmount,
          paymentMethod:   method,
        }),
      });
      console.log('Confirmation email sent to:', displayProfile.username);
    } catch (err) {
      console.error('Failed to send confirmation email:', err);
    }
  };

  // ── Send SMS using REAL reference number ─────────────────────────────────
  const sendConfirmationSms = async (
    referenceNumber: string,
    documentLabels: string[],
    totalAmount: number,
    method: string,
  ) => {
    if (!displayProfile.contactNumber) return;
    const studentName = `${displayProfile.firstName} ${displayProfile.lastName}`.trim();
    const paymentLabel = method === 'cash' ? 'Cash (Pay at School)' : 'Online Payment';
    const message =
      `PCS Document Request Confirmed!\n` +
      `Ref #: ${referenceNumber}\n` +
      `Student: ${studentName}\n` +
      `Documents: ${documentLabels.join(', ')}\n` +
      `Amount: PHP ${Number(totalAmount).toFixed(2)}\n` +
      `Payment: ${paymentLabel}\n` +
      `Please bring this reference # when claiming.`;

    try {
      await smsService.sendSms(displayProfile.contactNumber, message);
    } catch (err) {
      console.error('Failed to send SMS:', err);
    }
  };

  // ── Cash payment ──────────────────────────────────────────────────────────
  const handleCashPayment = async () => {
    const documentLabels = selectedDocuments
      .map(v => documentUtils.getDocumentByValue(v)?.label)
      .filter(Boolean) as string[];

    const totalAmount = documentUtils.calculateTotal(selectedDocuments);
    const studentName = `${displayProfile.firstName} ${displayProfile.lastName}`.trim();

    const savedRequest = await saveRequestToDb({
      userId:        displayProfile.user_id,
      studentName,
      contactNumber: displayProfile.contactNumber,
      gradeLevel:    displayProfile.gradeLevel,
      section:       displayProfile.section,
      documents:     documentLabels,
      paymentMethod: 'cash',
      totalAmount,
      paymentStatus: 'pending',
    });

    if (!savedRequest) {
      toast({ title: 'Error', description: 'Failed to submit request. Please try again.', variant: 'destructive' });
      setIsSubmitting(false);
      return;
    }

    // ── Fetch the REAL reference number from the payments table ───────────
    let realReferenceNumber = '';
    try {
      // Wait briefly for DB trigger to generate the cash reference number
      await new Promise(r => setTimeout(r, 800));
      const { data: paymentData } = await supabase
        .from('payments')
        .select('reference_number')
        .eq('request_id', savedRequest.id)
        .single();
      realReferenceNumber = paymentData?.reference_number || '';
    } catch (err) {
      console.error('Could not fetch reference number:', err);
    }

    // Fallback to request number if reference_number not yet generated
    const formattedId = `REQ-${String(savedRequest.request_number).padStart(3, '0')}`;
    const displayRef  = realReferenceNumber || formattedId;

    setSubmittedRequestId(formattedId);

    // ── Send SMS and email with REAL reference number ─────────────────────
    await Promise.all([
      sendConfirmationSms(displayRef, documentLabels, totalAmount, 'cash'),
      sendConfirmationEmail(displayRef, documentLabels, totalAmount, 'cash'),
    ]);

    setShowSuccessModal(true);
    setSelectedDocuments([]);
    setPaymentMethod('');
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current)  clearInterval(pollingIntervalRef.current);
      if (realtimeChannelRef.current)  supabase.removeChannel(realtimeChannelRef.current);
    };
  }, []);

  // ── Online payment polling ────────────────────────────────────────────────
  const startPaymentPolling = (invoiceId: string, documentLabels: string[], totalAmount: number) => {
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { sessionId: invoiceId },
        });
        if (error) { console.error('Polling error:', error); return; }

        if (data.verified) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setShowPaymentPendingModal(false);

          // ── Fetch REAL reference number from payments table after confirmation
          try {
            await new Promise(r => setTimeout(r, 1000));
            const { data: paymentData } = await supabase
              .from('payments')
              .select('reference_number, request_id')
              .eq('reference_number', invoiceId)
              .maybeSingle();

            // Try by invoice id first, then by user's latest payment
            let realRef = paymentData?.reference_number || '';
            if (!realRef) {
              const { data: latestPayment } = await supabase
                .from('payments')
                .select('reference_number')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
              realRef = latestPayment?.reference_number || invoiceId;
            }

            // Send email with real reference number
            await Promise.all([
              sendConfirmationEmail(realRef, documentLabels, totalAmount, 'online'),
              sendConfirmationSms(realRef, documentLabels, totalAmount, 'online'),
            ]);
          } catch (emailErr) {
            console.error('Post-payment notification error:', emailErr);
          }

          navigate(`/payment-success?invoice_id=${invoiceId}`);
        }
      } catch (err) { console.error('Polling error:', err); }
    }, 3000);

    realtimeChannelRef.current = supabase
      .channel('payment-updates')
      .on('broadcast', { event: 'payment-confirmed' }, async (payload) => {
        if (payload.payload?.invoiceId === invoiceId) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          setShowPaymentPendingModal(false);
          navigate(`/payment-success?invoice_id=${invoiceId}`);
        }
      })
      .subscribe();
  };

  // ── Online payment ────────────────────────────────────────────────────────
  const handleOnlinePayment = async () => {
    const documentLabels = selectedDocuments
      .map(v => documentUtils.getDocumentByValue(v)?.label)
      .filter(Boolean) as string[];

    const totalAmount   = documentUtils.calculateTotal(selectedDocuments);
    const studentName   = `${displayProfile.firstName} ${displayProfile.lastName}`.trim();
    const currentOrigin = window.location.origin;

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: {
          amount:        totalAmount,
          description:   `Document Request - ${documentLabels.join(', ')}`,
          studentName,
          contactNumber: displayProfile.contactNumber,
          documents:     documentLabels,
          userId:        displayProfile.user_id,
          gradeLevel:    displayProfile.gradeLevel,
          section:       displayProfile.section,
          paymentMethod,
          successUrl:    `${currentOrigin}/payment-success`,
          cancelUrl:     `${currentOrigin}/payment-cancel`,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to create checkout session');

      const invoiceId = data.checkoutSessionId;
      localStorage.setItem('pending_xendit_invoice', invoiceId);

      // Start polling — email will be sent AFTER payment verified with real ref number
      setShowPaymentPendingModal(true);
      startPaymentPolling(invoiceId, documentLabels, totalAmount);
      window.open(data.checkoutUrl, '_blank');

    } catch (err) {
      console.error('Checkout error:', err);
      toast({
        title: 'Payment Error',
        description: err instanceof Error ? err.message : 'Failed to initiate payment.',
        variant: 'destructive',
      });
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDocuments.length === 0 || !paymentMethod) return;
    setIsSubmitting(true);
    if (paymentMethod === 'cash') {
      await handleCashPayment();
      setIsSubmitting(false);
    } else {
      await handleOnlinePayment();
    }
  };

  const totalAmount     = documentUtils.calculateTotal(selectedDocuments);
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
              {/* Personal Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Last Name</Label>
                    <Input value={displayProfile.lastName}  disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>First Name</Label>
                    <Input value={displayProfile.firstName} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Middle Name</Label>
                    <Input value={displayProfile.middleName} disabled className="bg-muted" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Contact Number</Label>
                    <Input value={displayProfile.contactNumber} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label>Grade Level & Section</Label>
                    <Input value={`${displayProfile.gradeLevel} - ${displayProfile.section}`} disabled className="bg-muted" />
                  </div>
                </div>
              </div>

              {/* Document Type */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg border-b pb-2">Document Request</h3>
                <div className="space-y-3">
                  <Label className="text-base">Select Documents * (You can select multiple)</Label>
                  {DOCUMENT_TYPES.map((doc) => (
                    <div key={doc.value} className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={doc.value}
                        checked={selectedDocuments.includes(doc.value)}
                        onCheckedChange={() => handleDocumentToggle(doc.value)}
                      />
                      <Label htmlFor={doc.value} className="flex-1 cursor-pointer flex justify-between items-center">
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
                          <span key={docValue} className="text-xs bg-white/50 px-2 py-1 rounded">{doc.label}</span>
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
                      <div key={method.value} className="flex items-center space-x-3 p-4 border-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value={method.value} id={method.value} />
                        <Label htmlFor={method.value} className="flex-1 cursor-pointer">
                          <div className="font-medium">{method.label}</div>
                          <div className="text-sm text-muted-foreground">{method.description}</div>
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

      {/* Success Modal */}
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
              Your document request <span className="font-semibold text-primary">{submittedRequestId}</span> has been
              successfully submitted. A confirmation email and SMS with your reference number have been sent to you.
              You can track the status in the Request History section.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={() => setShowSuccessModal(false)} className="w-full mt-4">Close</Button>
        </DialogContent>
      </Dialog>

      {/* Payment Pending Modal */}
      <Dialog open={showPaymentPendingModal} onOpenChange={(open) => {
        if (!open) {
          if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
          if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
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
              A confirmation email and SMS will be sent once payment is verified.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <p className="text-sm text-center text-muted-foreground">Don't see the payment page?</p>
            <Button
              variant="outline"
              onClick={() => {
                const invoiceId = localStorage.getItem('pending_xendit_invoice');
                if (invoiceId) {
                  supabase.functions.invoke('verify-payment', { body: { sessionId: invoiceId } })
                    .then(({ data }) => { if (data?.checkoutUrl) window.open(data.checkoutUrl, '_blank'); });
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
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
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