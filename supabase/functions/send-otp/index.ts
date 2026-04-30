import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createTransport } from 'npm:nodemailer@6.9.9';

const ALLOWED_ORIGINS = ['https://document-request.vercel.app'];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Generate 6-digit OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format phone number to E.164
function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) return '+63' + cleaned.substring(1);
  if (!cleaned.startsWith('63')) return '+63' + cleaned;
  return '+' + cleaned;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase       = createClient(supabaseUrl, serviceRoleKey);

    const { userId, email, contactNumber } = await req.json();

    if (!userId || !email) return respond({ error: 'userId and email are required' }, 400);

    // ── Check if account is currently locked ──────────────────────────────
    const { data: existingOtp } = await supabase
      .from('otp_codes')
      .select('locked_until')
      .eq('user_id', userId)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingOtp?.locked_until) {
      const lockedUntil = new Date(existingOtp.locked_until);
      if (lockedUntil > new Date()) {
        const remainingMs   = lockedUntil.getTime() - Date.now();
        const remainingMins = Math.ceil(remainingMs / 60000);
        return respond({
          error: `Account is locked due to too many failed attempts. Try again in ${remainingMins} minute(s).`,
          locked: true,
          lockedUntil: existingOtp.locked_until,
        }, 429);
      }
    }

    // ── Invalidate previous unused OTPs for this user ─────────────────────
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('user_id', userId)
      .eq('is_used', false);

    // ── Generate OTP and save to DB ───────────────────────────────────────
    const otp       = generateOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const { data: otpRecord, error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        user_id:    userId,
        email,
        otp_code:   otp,
        expires_at: expiresAt.toISOString(),
        is_used:    false,
        attempts:   0,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('OTP insert error:', insertError.message);
      return respond({ error: 'Failed to generate OTP' }, 500);
    }

    console.log('OTP generated for:', email, '→', otp);

    // ── Send via EMAIL ────────────────────────────────────────────────────
    const gmailUser     = Deno.env.get('GMAIL_USER');
    const gmailPassword = Deno.env.get('GMAIL_APP_PASSWORD');
    let emailSent = false;

    if (gmailUser && gmailPassword) {
      try {
        const transporter = createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPassword },
        });

        await transporter.sendMail({
          from:    `PCS Document Request System <${gmailUser}>`,
          to:      email,
          subject: 'Your Login OTP Code',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
              <div style="background: #16a34a; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 20px;">🎓 Pateros Catholic School</h1>
              </div>
              <div style="padding: 32px; background: #fff; border: 1px solid #e5e7eb;">
                <h2 style="color: #111827; margin: 0 0 8px;">Login Verification Code</h2>
                <p style="color: #6b7280; margin: 0 0 24px;">Use this OTP to complete your login. It expires in <strong>5 minutes</strong>.</p>
                <div style="background: #f0fdf4; border: 2px dashed #16a34a; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                  <p style="margin: 0; font-size: 13px; color: #6b7280;">Your One-Time Password</p>
                  <p style="margin: 8px 0 0; font-size: 42px; font-weight: bold; color: #16a34a; letter-spacing: 12px;">${otp}</p>
                </div>
                <p style="color: #ef4444; font-size: 13px; margin: 0;">⚠️ Never share this code with anyone. PCS staff will never ask for your OTP.</p>
                <p style="color: #6b7280; font-size: 13px; margin: 16px 0 0;">If you didn't request this, please ignore this email or contact support.</p>
              </div>
              <div style="background: #f9fafb; padding: 16px; text-align: center; border-radius: 0 0 8px 8px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">© 2026 Pateros Catholic School</p>
              </div>
            </div>
          `,
        });
        emailSent = true;
        console.log('OTP email sent to:', email);
      } catch (emailErr: any) {
        console.error('OTP email error:', emailErr.message);
      }
    }

    // ── Send via SMS ──────────────────────────────────────────────────────
    const smsApiToken = Deno.env.get('IPROGSMS_API_TOKEN');
    let smsSent = false;

    if (smsApiToken && contactNumber) {
      try {
        const formattedPhone = formatPhone(contactNumber);
        const smsMessage     = `PCS Login OTP: ${otp}\nExpires in 5 minutes.\nDo NOT share this code.`;

        const formData = new URLSearchParams();
        formData.append('api_token',    smsApiToken);
        formData.append('message',      smsMessage);
        formData.append('phone_number', formattedPhone);

        const smsRes = await fetch('https://www.iprogsms.com/api/v1/sms_messages', {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    formData.toString(),
        });

        if (smsRes.ok) {
          smsSent = true;
          console.log('OTP SMS sent to:', formattedPhone);
        } else {
          const smsErr = await smsRes.text();
          console.error('SMS error:', smsErr);
        }
      } catch (smsErr: any) {
        console.error('SMS send error:', smsErr.message);
      }
    }

    return respond({
      success:   true,
      otpId:     otpRecord.id,
      emailSent,
      smsSent,
      expiresAt: expiresAt.toISOString(),
      message:   `OTP sent via ${[emailSent && 'email', smsSent && 'SMS'].filter(Boolean).join(' and ')}.`,
    });

  } catch (err: any) {
    console.error('send-otp error:', err);
    return respond({ error: err.message || 'Internal server error' }, 500);
  }
});