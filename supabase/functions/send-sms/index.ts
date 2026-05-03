import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const ALLOWED_ORIGINS = [
  'https://document-request.vercel.app',
];

function getCorsHeaders(req: Request) {
  const origin        = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

interface SmsRequest {
  phoneNumber: string;
  message:     string;
}

const handler = async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, message }: SmsRequest = await req.json();

    if (!phoneNumber || !message) {
      console.error('Missing required fields:', { phoneNumber: !!phoneNumber, message: !!message });
      return new Response(
        JSON.stringify({ error: 'Phone number and message are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const apiToken = Deno.env.get('IPROGSMS_API_TOKEN');
    if (!apiToken) {
      console.error('IPROGSMS_API_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'SMS service not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Format phone number to E.164
    let formattedPhone = phoneNumber.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '63' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('63')) {
      formattedPhone = '63' + formattedPhone;
    }
    formattedPhone = '+' + formattedPhone;

    console.log('Sending SMS to:', formattedPhone);
    console.log('Message:', message);

    const formData = new URLSearchParams();
    formData.append('api_token',    apiToken);
    formData.append('message',      message);
    formData.append('phone_number', formattedPhone);

    const response = await fetch('https://www.iprogsms.com/api/v1/sms_messages', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    formData.toString(),
    });

    const responseText = await response.text();
    console.log('iProG SMS API response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    const apiError = !response.ok || responseData?.status === 500 || responseData?.error;
    if (apiError) {
      const errorMsg = responseData?.message || responseData?.error || 'Failed to send SMS';
      console.error('SMS API error:', response.status, errorMsg, responseData);
      return new Response(
        JSON.stringify({ error: errorMsg, details: responseData }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log('SMS sent successfully');

    return new Response(
      JSON.stringify({ success: true, data: responseData }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in send-sms function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
};

serve(handler);