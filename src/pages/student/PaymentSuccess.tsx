import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { requestStorage } from '@/lib/requestStorage';
import { notificationStorage } from '@/lib/notificationStorage';
import { smsService } from '@/lib/smsService';
import { PAYMENT_METHODS, documentUtils, DOCUMENT_TYPES } from '@/lib/documents';
import { saveRequestToDb } from '@/lib/saveRequestToDb';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your payment...');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);

  const sendConfirmationEmail = async (
    to: string,
    studentName: string,
    contactNumber: string,
    referenceNum: string,
    documentLabels: string[],
    totalAmount: number,
    paymentMethod: string,
  ) => {
    if (!to) return;
    try {
      const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${supabaseUrl}/functions/v1/send-request-email`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey':        supabaseAnonKey,
        },
        body: JSON.stringify({
          to,
          studentName,
          contactNumber,
          referenceNumber: referenceNum,
          documents:       documentLabels,
          quantities:      documentLabels.map(() => 1),
          totalAmount,
          paymentMethod,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        console.error('Email send failed:', result);
      } else {
        console.log('Confirmation email sent to:', to);
      }
    } catch (err) {
      console.error('Failed to send confirmation email (non-critical):', err);
    }
  };

  useEffect(() => {
    const verifyPayment = async () => {
      const urlInvoiceId          = searchParams.get('invoice_id');
      const urlExternalId         = searchParams.get('external_id');
      const storedInvoiceId       = localStorage.getItem('pending_xendit_invoice');
      const lastSuccessfulInvoice = localStorage.getItem('last_successful_invoice');

      const invoiceId  = urlInvoiceId || storedInvoiceId || lastSuccessfulInvoice;
      const externalId = urlExternalId;

      console.log('URL invoice_id:', urlInvoiceId);
      console.log('URL external_id:', urlExternalId);
      console.log('localStorage pending:', storedInvoiceId);
      console.log('localStorage last_successful:', lastSuccessfulInvoice);
      console.log('Using invoice_id:', invoiceId, 'external_id:', externalId);

      if (!invoiceId && !externalId) {
        setStatus('error');
        setMessage('No payment session found. Please try again from the document request page.');
        return;
      }

      try {
        console.log('Calling verify-payment with:', { invoiceId, externalId });
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: {
            sessionId:  invoiceId  || undefined,
            externalId: externalId || undefined,
          },
        });

        if (error) throw error;

        if (!data.verified) {
          setStatus('error');
          setMessage('Payment was not completed. Please try again.');
          return;
        }

        const paymentRef = data.invoiceId || invoiceId || externalId;
        setReferenceNumber(paymentRef);

        const processedInvoices = JSON.parse(localStorage.getItem('processed_invoices') || '[]');
        if (processedInvoices.includes(invoiceId)) {
          setStatus('success');
          setMessage('This payment was already processed. Check your request history.');
          const lastRequestId = localStorage.getItem('last_request_id');
          if (lastRequestId) setRequestId(lastRequestId);
          return;
        }

        const { metadata } = data;

        const rawDocs = metadata.documents || [];
        const documentLabels = Array.isArray(rawDocs)
          ? rawDocs
          : rawDocs.split(',').map((s: string) => s.trim()).filter(Boolean);

        const totalAmount = documentLabels.reduce((sum: number, docLabel: string) => {
          const doc = DOCUMENT_TYPES.find(d => d.label === docLabel);
          return sum + (doc?.price || 0);
        }, 0);

        const newRequest = requestStorage.add({
          userId:          metadata.userId,
          studentName:     metadata.studentName,
          documents:       documentLabels,
          requestDate:     new Date().toISOString().split('T')[0],
          paymentMethod:   metadata.paymentMethod === 'gcash' ? 'GCash'
                         : metadata.paymentMethod === 'maya'  ? 'Maya'
                         : PAYMENT_METHODS.find(m => m.value === metadata.paymentMethod)?.label || metadata.paymentMethod,
          amount:          documentUtils.formatPrice(totalAmount),
          gradeLevel:      metadata.gradeLevel,
          section:         metadata.section,
          contactNumber:   metadata.contactNumber,
          referenceNumber: paymentRef,
          paidAt:          new Date().toLocaleString(),
        });

        const savedRequest = await saveRequestToDb({
          userId:          metadata.userId,
          studentName:     metadata.studentName,
          contactNumber:   metadata.contactNumber,
          gradeLevel:      metadata.gradeLevel,
          section:         metadata.section,
          documents:       documentLabels,
          paymentMethod:   metadata.paymentMethod,
          totalAmount,
          referenceNumber: paymentRef,
          paymentStatus:   'paid',
          paidAt:          new Date().toISOString(),
        });

        const formattedRequestId = savedRequest
          ? `REQ-${String(savedRequest.request_number).padStart(3, '0')}`
          : newRequest.id;

        processedInvoices.push(invoiceId);
        localStorage.setItem('processed_invoices', JSON.stringify(processedInvoices));
        localStorage.setItem('last_successful_invoice', invoiceId);
        localStorage.setItem('last_request_id', formattedRequestId);

        notificationStorage.createRequestNotifications(
          formattedRequestId,
          metadata.userId,
          metadata.studentName,
          documentLabels
        );

        // ── Fetch email from students OR alumni table ──────────────────
        let studentEmail = '';
        try {
          const [studentRes, alumniRes] = await Promise.all([
            supabase
              .from('students')
              .select('username')
              .eq('user_id', metadata.userId)
              .maybeSingle(),
            supabase
              .from('alumni')
              .select('username')
              .eq('user_id', metadata.userId)
              .maybeSingle(),
          ]);
          studentEmail =
            studentRes.data?.username ||
            alumniRes.data?.username  ||
            '';
        } catch (err) {
          console.error('Could not fetch student email (non-critical):', err);
        }

        // ── Send SMS and email in parallel (non-blocking) ─────────────
        await Promise.all([
          metadata.contactNumber
            ? smsService.notifyNewRequest(
                metadata.contactNumber,
                metadata.studentName,
                formattedRequestId,
                documentLabels
              )
            : Promise.resolve(),

          studentEmail
            ? sendConfirmationEmail(
                studentEmail,
                metadata.studentName,
                metadata.contactNumber,
                paymentRef,
                documentLabels,
                totalAmount,
                metadata.paymentMethod,
              )
            : Promise.resolve(),
        ]);

        localStorage.removeItem('pending_xendit_invoice');

        setRequestId(formattedRequestId);
        setStatus('success');
        setMessage('Payment successful! Your document request has been submitted.');

      } catch (err) {
        console.error('Payment verification error:', err);
        setStatus('error');
        setMessage('Failed to verify payment. Please contact support.');
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            {status === 'loading' && (
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
            )}
            {status === 'error' && (
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
            )}
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Processing Payment'}
            {status === 'success' && 'Payment Successful!'}
            {status === 'error'   && 'Payment Failed'}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>

          {status === 'success' && referenceNumber && (
            <div className="p-4 bg-accent/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Payment Reference Number</p>
              <p className="text-lg font-bold text-accent-foreground font-mono">{referenceNumber}</p>
            </div>
          )}

          {status === 'success' && requestId && (
            <div className="p-4 bg-primary/10 rounded-lg">
              <p className="text-sm text-muted-foreground">Request ID</p>
              <p className="text-xl font-bold text-primary">{requestId}</p>
            </div>
          )}

          {status === 'success' && (
            <p className="text-sm text-muted-foreground">
              A confirmation email and SMS have been sent to you with your request details.
            </p>
          )}

          <div className="pt-4 space-y-2">
            {status === 'success' && (
              <Button
                onClick={() => navigate('/student/request-history')}
                className="w-full"
              >
                View Request History
              </Button>
            )}
            <Button
              onClick={() => navigate('/student/document-request')}
              variant={status === 'success' ? 'outline' : 'default'}
              className="w-full"
            >
              {status === 'error' ? 'Try Again' : 'New Request'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;