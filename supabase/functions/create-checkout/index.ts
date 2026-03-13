import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const ALLOWED_ORIGINS = [
  'https://id-preview--f99b0611-d4cf-4efe-bc26-0cc4ac5dcb70.lovable.app',
  Deno.env.get('ALLOWED_ORIGIN') || '',
].filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

// Allowlist for redirect URLs to prevent open redirect attacks
const ALLOWED_REDIRECT_HOSTS = [
  'id-preview--f99b0611-d4cf-4efe-bc26-0cc4ac5dcb70.lovable.app',
];

function isAllowedRedirectUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const envHost = Deno.env.get('ALLOWED_ORIGIN');
    const allowedHosts = [...ALLOWED_REDIRECT_HOSTS];
    if (envHost) {
      try { allowedHosts.push(new URL(envHost).hostname); } catch {}
    }
    return allowedHosts.includes(parsed.hostname);
  } catch {
    return false;
  }
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

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get('XENDIT_SECRET_KEY');
    if (!secretKey) {
      throw new Error('Xendit secret key not configured');
    }

    const body: CheckoutRequest = await req.json();
    console.log('Creating Xendit invoice for:', body.studentName);

    const { 
      amount, 
      description, 
      studentName, 
      contactNumber, 
      documents, 
      userId, 
      gradeLevel, 
      section,
      paymentMethod,
      successUrl,
      cancelUrl 
    } = body;

    // Validate redirect URLs against allowlist
    if (!isAllowedRedirectUrl(successUrl)) {
      throw new Error('Invalid success redirect URL');
    }
    if (!isAllowedRedirectUrl(cancelUrl)) {
      throw new Error('Invalid cancel redirect URL');
    }

    // Generate a unique external ID
    const externalId = `doc-req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const successUrlWithRef = `${successUrl}?external_id=${externalId}`;
    console.log('Success URL with external_id:', successUrlWithRef);

    const invoiceResponse = await fetch('https://api.xendit.co/v2/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
      },
      body: JSON.stringify({
        external_id: externalId,
        amount: amount,
        currency: 'PHP',
        description: description,
        customer: {
          given_names: studentName,
          mobile_number: contactNumber,
        },
        success_redirect_url: successUrlWithRef,
        failure_redirect_url: cancelUrl,
        payment_methods: ['GCASH', 'PAYMAYA', 'GRABPAY', 'CARD'],
        metadata: {
          student_name: studentName,
          contact_number: contactNumber,
          user_id: userId,
          grade_level: gradeLevel,
          section: section,
          documents: documents.join('|'),
          payment_method: paymentMethod,
        },
      }),
    });

    const invoiceData = await invoiceResponse.json();
    console.log('Xendit response status:', invoiceResponse.status);

    if (!invoiceResponse.ok) {
      console.error('Xendit error:', JSON.stringify(invoiceData));
      const errorMessage = invoiceData.message || 'Failed to create invoice';
      throw new Error(errorMessage);
    }

    const invoiceUrl = invoiceData.invoice_url;
    const invoiceId = invoiceData.id;

    console.log('Invoice created:', invoiceId, 'with external_id:', externalId);

    return new Response(
      JSON.stringify({
        success: true,
        checkoutUrl: invoiceUrl,
        checkoutSessionId: invoiceId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Checkout error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
