import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const ALLOWED_ORIGINS = [
  'https://document-request.vercel.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

interface VerifyRequest {
  sessionId?: string;
  externalId?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const secretKey = Deno.env.get('XENDIT_SECRET_KEY');
    if (!secretKey) {
      throw new Error('Xendit secret key not configured');
    }

    const body: VerifyRequest = await req.json();
    const { sessionId, externalId } = body;

    if (!sessionId && !externalId) {
      throw new Error('Invoice ID or External ID is required');
    }

    let invoiceData;

    if (sessionId) {
      console.log('Verifying Xendit invoice by ID:', sessionId);
      const verifyResponse = await fetch(`https://api.xendit.co/v2/invoices/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(secretKey + ':')}`,
        },
      });

      if (!verifyResponse.ok) {
        if (verifyResponse.status === 404) {
          throw new Error('Invoice not found');
        }
        const errorData = await verifyResponse.json();
        console.error('Xendit error:', JSON.stringify(errorData));
        throw new Error('Failed to verify payment');
      }

      invoiceData = await verifyResponse.json();
    } else if (externalId) {
      console.log('Verifying Xendit invoice by external_id:', externalId);
      const verifyResponse = await fetch(`https://api.xendit.co/v2/invoices?external_id=${externalId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(secretKey + ':')}`,
        },
      });

      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json();
        console.error('Xendit error:', JSON.stringify(errorData));
        throw new Error('Failed to verify payment');
      }

      const invoices = await verifyResponse.json();
      if (!invoices || invoices.length === 0) {
        throw new Error('Invoice not found for external_id');
      }
      
      invoiceData = invoices[0];
    }

    console.log('Xendit invoice response:', JSON.stringify(invoiceData));

    const status = invoiceData.status;
    const metadata = invoiceData.metadata || {};
    const invoiceId = invoiceData.id;

    const isPaid = status === 'PAID' || status === 'SETTLED';

    console.log('Invoice status:', status);
    console.log('Is paid:', isPaid);

    return new Response(
      JSON.stringify({
        success: true,
        verified: isPaid,
        status,
        invoiceId,
        metadata: {
          studentName: metadata.student_name,
          contactNumber: metadata.contact_number,
          userId: metadata.user_id,
          gradeLevel: metadata.grade_level,
          section: metadata.section,
          documents: metadata.documents ? metadata.documents.split('|') : [],
          paymentMethod: metadata.payment_method,
        },
        amount: invoiceData.amount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Verify error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        verified: false,
        error: errorMessage,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});