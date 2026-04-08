import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const ALLOWED_ORIGINS = [
  'https://document-request.vercel.app',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const body = await req.json();
    const { to, studentName, email, password } = body;

    if (!to || !studentName || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, studentName, email, password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'PCS Document Request System <onboarding@resend.dev>',
        to: [to],
        subject: 'Your Student Account Has Been Created - PCS Document Request System',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
              .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              .header { background-color: #16a34a; padding: 30px; text-align: center; }
              .header h1 { color: white; margin: 0; font-size: 22px; }
              .header p { color: #d1fae5; margin: 5px 0 0; font-size: 14px; }
              .body { padding: 30px; }
              .body p { color: #374151; font-size: 15px; line-height: 1.6; }
              .credentials { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0; }
              .credentials h3 { color: #15803d; margin: 0 0 15px; font-size: 16px; }
              .credential-row { margin-bottom: 10px; font-size: 14px; color: #374151; }
              .credential-row strong { display: inline-block; width: 100px; }
              .warning { background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 20px 0; }
              .warning p { color: #92400e; margin: 0; font-size: 13px; }
              .button { display: inline-block; background-color: #16a34a; color: white !important; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px; margin: 20px 0; }
              .footer { background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb; }
              .footer p { color: #9ca3af; font-size: 12px; margin: 0; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎓 Pateros Catholic School</h1>
                <p>Document Request System</p>
              </div>
              <div class="body">
                <p>Dear <strong>${studentName}</strong>,</p>
                <p>Your student account has been successfully created in the <strong>PCS Document Request System</strong>. You can now log in and request your school documents online.</p>

                <div class="credentials">
                  <h3>🔐 Your Login Credentials</h3>
                  <div class="credential-row">
                    <strong>Email:</strong> ${email}
                  </div>
                  <div class="credential-row">
                    <strong>Password:</strong> ${password}
                  </div>
                </div>

                <div class="warning">
                  <p>⚠️ <strong>Important:</strong> Please change your password after your first login to keep your account secure.</p>
                </div>

                <p>You can access the system using the link below:</p>
                <a href="https://document-request.vercel.app" class="button">Login to PCS DRS</a>

                <p>If you have any questions, please contact the Registrar's Office.</p>
                <p>Best regards,<br><strong>PCS Registrar's Office</strong></p>
              </div>
              <div class="footer">
                <p>© 2026 Pateros Catholic School. All rights reserved.</p>
                <p>Contact the Registrar's Office for assistance.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend error:', data);
      throw new Error(data.message || 'Failed to send email');
    }

    console.log('Email sent successfully to:', to);

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${to}`, id: data.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Email error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to send email' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});