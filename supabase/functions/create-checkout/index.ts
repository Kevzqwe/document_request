import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

function getCorsHeaders(req: Request) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

interface CheckoutRequest {
  amount: number;
  description: string;
  studentName: string;
  contactNumber: string;
  documents: string[];
  userId: string;
  gradeLevel: string;
  section: string;
  paymentMethod: string;
  successUrl: string;
  cancelUrl: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get('XENDIT_SECRET_KEY');
    if (!secretKey) throw new Error('Xendit secret key not configured');

    const body: CheckoutRequest = await req.json();
    console.log('Creating Xendit invoice for:', body.studentName);

    const {
      amount, description, studentName, contactNumber,
      documents, userId, gradeLevel, section,
      paymentMethod, successUrl, cancelUrl,
    } = body;

    // Unique external ID per request
    const externalId = `doc-req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const successUrlWithRef = `${successUrl}?external_id=${externalId}`;

    console.log('External ID:', externalId);
    console.log('Success URL:', successUrlWithRef);

    const invoiceResponse = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
      },
      body: JSON.stringify({
        external_id:          externalId,
        amount,
        currency:             'PHP',
        description,
        customer: {
          given_names:   studentName,
          mobile_number: contactNumber,
        },
        success_redirect_url: successUrlWithRef,
        failure_redirect_url: cancelUrl,
        payment_methods:      ['GCASH', 'PAYMAYA', 'GRABPAY', 'CARD'],
        metadata: {
          student_name:   studentName,
          contact_number: contactNumber,
          user_id:        userId,
          grade_level:    gradeLevel,
          section,
          documents:      documents.join('|'),
          payment_method: paymentMethod,
        },
      }),
    });

    const invoiceData = await invoiceResponse.json();

    if (!invoiceResponse.ok) {
      console.error('Xendit error:', JSON.stringify(invoiceData));
      throw new Error(invoiceData.message || 'Failed to create invoice');
    }

    console.log('Invoice created:', invoiceData.id);

    return new Response(
      JSON.stringify({
        success:          true,
        checkoutUrl:      invoiceData.invoice_url,
        checkoutSessionId: invoiceData.id,
        externalId,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});