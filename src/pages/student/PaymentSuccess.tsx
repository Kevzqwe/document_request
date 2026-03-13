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

  useEffect(() => {
    const verifyPayment = async () => {
      // Try to get invoice_id or external_id from URL (survives cross-domain redirect)
      const urlInvoiceId = searchParams.get('invoice_id');
      const urlExternalId = searchParams.get('external_id');
      const storedInvoiceId = localStorage.getItem('pending_xendit_invoice');
      const lastSuccessfulInvoice = localStorage.getItem('last_successful_invoice');
      
      // Prefer invoice_id, then external_id from URL, then localStorage fallbacks
      const invoiceId = urlInvoiceId || storedInvoiceId || lastSuccessfulInvoice;
      const externalId = urlExternalId;
      
      console.log('URL invoice_id:', urlInvoiceId);
      console.log('URL external_id:', urlExternalId);
      console.log('localStorage pending:', storedInvoiceId);
      console.log('localStorage last_successful:', lastSuccessfulInvoice);
      console.log('Using invoice_id:', invoiceId, 'external_id:', externalId);
      
      // Final check - if we don't have any valid ID
      if (!invoiceId && !externalId) {
        setStatus('error');
        setMessage('No payment session found. Please try again from the document request page.');
        return;
      }

      try {
        // Verify payment with Xendit - pass either invoice_id or external_id
        console.log('Calling verify-payment with:', { invoiceId, externalId });
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { 
            sessionId: invoiceId || undefined,
            externalId: externalId || undefined 
          },
        });

        if (error) throw error;

        if (!data.verified) {
          setStatus('error');
          setMessage('Payment was not completed. Please try again.');
          return;
        }

        // Store the reference number (Xendit invoice ID)
        const paymentRef = data.invoiceId || invoiceId || externalId;
        setReferenceNumber(paymentRef);

        // Check if this invoice was already processed
        const processedInvoices = JSON.parse(localStorage.getItem('processed_invoices') || '[]');
        if (processedInvoices.includes(invoiceId)) {
          // Already processed - show success without creating duplicate request
          setStatus('success');
          setMessage('This payment was already processed. Check your request history.');
          // Try to find the request ID from the last request
          const lastRequestId = localStorage.getItem('last_request_id');
          if (lastRequestId) {
            setRequestId(lastRequestId);
          }
          return;
        }

        // Payment verified - create the document request
        const { metadata } = data;
        
        // Convert document strings back to labels (metadata.documents may be a comma-separated string)
        const rawDocs = metadata.documents || [];
        const documentLabels = Array.isArray(rawDocs) ? rawDocs : rawDocs.split(',').map((s: string) => s.trim()).filter(Boolean);
        const totalAmount = documentLabels.reduce((sum: number, docLabel: string) => {
          const doc = DOCUMENT_TYPES.find(d => d.label === docLabel);
          return sum + (doc?.price || 0);
        }, 0);

        // Save to localStorage
        const newRequest = requestStorage.add({
          userId: metadata.userId,
          studentName: metadata.studentName,
          documents: documentLabels,
          requestDate: new Date().toISOString().split('T')[0],
          paymentMethod: metadata.paymentMethod === 'gcash' ? 'GCash' : 
                        metadata.paymentMethod === 'maya' ? 'Maya' : 
                        PAYMENT_METHODS.find(m => m.value === metadata.paymentMethod)?.label || metadata.paymentMethod,
          amount: documentUtils.formatPrice(totalAmount),
          gradeLevel: metadata.gradeLevel,
          section: metadata.section,
          contactNumber: metadata.contactNumber,
          referenceNumber: paymentRef,
          paidAt: new Date().toLocaleString(),
        });

        // Save to Supabase database and get the actual request number
        const savedRequest = await saveRequestToDb({
          userId: metadata.userId,
          studentName: metadata.studentName,
          contactNumber: metadata.contactNumber,
          gradeLevel: metadata.gradeLevel,
          section: metadata.section,
          documents: documentLabels,
          paymentMethod: metadata.paymentMethod,
          totalAmount,
          referenceNumber: paymentRef,
          paymentStatus: 'paid',
          paidAt: new Date().toISOString(),
        });

        // Use the actual DB request number for display
        const formattedRequestId = savedRequest
          ? `REQ-${String(savedRequest.request_number).padStart(3, '0')}`
          : newRequest.id;

        // Mark invoice as processed to prevent duplicates
        processedInvoices.push(invoiceId);
        localStorage.setItem('processed_invoices', JSON.stringify(processedInvoices));
        localStorage.setItem('last_successful_invoice', invoiceId);
        localStorage.setItem('last_request_id', formattedRequestId);

        // Create notifications
        notificationStorage.createRequestNotifications(
          formattedRequestId,
          metadata.userId,
          metadata.studentName,
          documentLabels
        );

        // Send SMS notification
        if (metadata.contactNumber) {
          await smsService.notifyNewRequest(
            metadata.contactNumber,
            metadata.studentName,
            formattedRequestId,
            documentLabels
          );
        }

        // Clear the pending invoice from localStorage
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
            {status === 'error' && 'Payment Failed'}
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
