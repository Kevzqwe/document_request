import { createTransport } from "npm:nodemailer@6.9.9";

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const gmailUser = Deno.env.get('GMAIL_USER');
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');

    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured.');
    }

    const body = await req.json();
    const { to, studentName, email, password, studentId, section, gradeLevel } = body;

    if (!to || !studentName || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sending email to:', to);

    const transporter = createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword,
      },
    });

    await transporter.sendMail({
      from: `PCS Document Request System <${gmailUser}>`,
      to: to,
      subject: 'Your Account Has Been Successfully Activated - PCS Document Request System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background-color: #16a34a; padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">🎓 Pateros Catholic School</h1>
            <p style="color: #d1fae5; margin: 5px 0 0; font-size: 14px;">Document Request System</p>
          </div>
          <div style="padding: 30px;">
            <p style="color: #374151; font-size: 15px;">Hi <strong>${studentName}</strong>,</p>
            <p style="color: #374151; font-size: 15px;">
              Your account has been <strong style="color: #16a34a;">successfully activated</strong> in the 
              PCS Document Request System. You can now log in and request your school documents online.
            </p>

            <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="color: #15803d; margin: 0 0 15px; font-size: 16px;">👤 Your Account Details</h3>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
                <tr style="border-bottom: 1px solid #dcfce7;">
                  <td style="padding: 8px 0; font-weight: bold; width: 140px;">Name:</td>
                  <td style="padding: 8px 0;">${studentName}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dcfce7;">
                  <td style="padding: 8px 0; font-weight: bold;">Student ID:</td>
                  <td style="padding: 8px 0;">${studentId || 'Will be assigned soon'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dcfce7;">
                  <td style="padding: 8px 0; font-weight: bold;">Grade & Section:</td>
                  <td style="padding: 8px 0;">${gradeLevel ? `${gradeLevel}${section ? ' / ' + section : ''}` : section || '—'}</td>
                </tr>
                <tr style="border-bottom: 1px solid #dcfce7;">
                  <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                  <td style="padding: 8px 0;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Temporary Password:</td>
                  <td style="padding: 8px 0;"><strong style="color: #16a34a;">${password}</strong></td>
                </tr>
              </table>
            </div>

            <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 13px;">
                ⚠️ <strong>Important:</strong> Please change your password after your first login to keep your account secure.
              </p>
            </div>

            <a href="https://document-request.vercel.app"
               style="display: inline-block; background-color: #16a34a; color: white; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 15px; margin: 10px 0;">
              Login to PCS DRS
            </a>

            <p style="color: #374151; font-size: 15px; margin-top: 20px;">
              If you have any questions, please contact the Registrar's Office.
            </p>
            <p style="color: #374151; font-size: 15px;">Best regards,<br><strong>PCS Registrar's Office</strong></p>
          </div>
          <div style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2026 Pateros Catholic School. All rights reserved.</p>
          </div>
        </div>
      `,
    });

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