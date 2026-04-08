import { SmtpClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD.');
    }

    const body = await req.json();
    const { to, studentName, email, password } = body;

    if (!to || !studentName || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, studentName, email, password' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending email to:', to);

    const client = new SmtpClient();

    await client.connectTLS({
      hostname: 'smtp.gmail.com',
      port: 465,
      username: gmailUser,
      password: gmailPassword,
    });

    await client.send({
      from: `PCS Document Request System <${gmailUser}>`,
      to: to,
      subject: 'Your Student Account Has Been Created - PCS Document Request System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background-color: #16a34a; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🎓 Pateros Catholic School</h1>
            <p style="color: #d1fae5; margin: 5px 0 0; font-size: 14px;">Document Request System</p>
          </div>
          <div style="padding: 30px;">
            <p style="color: #374151; font-size: 15px;">Dear <strong>${studentName}</strong>,</p>
            <p style="color: #374151; font-size: 15px;">Your student account has been successfully created in the <strong>PCS Document Request System</strong>. You can now log in and request your school documents online.</p>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #15803d; margin: 0 0 15px; font-size: 16px;">🔐 Your Login Credentials</h3>
              <p style="margin: 8px 0; font-size: 14px; color: #374151;">
                <strong style="display: inline-block; width: 100px;">Email:</strong> ${email}
              </p>
              <p style="margin: 8px 0; font-size: 14px; color: #374151;">
                <strong style="display: inline-block; width: 100px;">Password:</strong> ${password}
              </p>
            </div>

            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 13px;">
                ⚠️ <strong>Important:</strong> Please change your password after your first login to keep your account secure.
              </p>
            </div>

            <p style="color: #374151; font-size: 15px;">You can access the system using the link below:</p>
            <a href="https://document-request.vercel.app"
               style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px; margin: 10px 0;">
              Login to PCS DRS
            </a>

            <p style="color: #374151; font-size: 15px;">If you have any questions, please contact the Registrar's Office.</p>
            <p style="color: #374151; font-size: 15px;">Best regards,<br><strong>PCS Registrar's Office</strong></p>
          </div>
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2026 Pateros Catholic School. All rights reserved.</p>
          </div>
        </div>
      `,
    });

    await client.close();

    console.log('Email sent successfully to:', to);

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${to}` }),
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