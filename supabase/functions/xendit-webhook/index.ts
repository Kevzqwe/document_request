import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  'https://id-preview--f99b0611-d4cf-4efe-bc26-0cc4ac5dcb70.lovable.app',
  Deno.env.get('ALLOWED_ORIGIN') || '',
].filter(Boolean);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-callback-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const callbackToken = req.headers.get('x-callback-token');
    const expectedToken = Deno.env.get('XENDIT_WEBHOOK_TOKEN');
    
    if (expectedToken && callbackToken !== expectedToken) {
      console.error('Invalid callback token');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    console.log('Xendit webhook received:', JSON.stringify(body));

    if (body.status === 'PAID' || body.status === 'SETTLED') {
      const invoiceId = body.id || body.external_id;
      const metadata = body.metadata || {};
      
      console.log('Payment confirmed for invoice:', invoiceId);
      console.log('Metadata:', JSON.stringify(metadata));

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const channel = supabase.channel('payment-updates');
      
      await channel.send({
        type: 'broadcast',
        event: 'payment-confirmed',
        payload: {
          invoiceId,
          status: body.status,
          metadata: {
            studentName: metadata.student_name,
            userId: metadata.user_id,
            documents: metadata.documents ? metadata.documents.split('|') : [],
          },
          amount: body.amount || body.paid_amount,
          paidAt: body.paid_at || new Date().toISOString(),
        },
      });

      console.log('Broadcast sent for invoice:', invoiceId);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
