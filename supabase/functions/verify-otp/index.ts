import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://document-request.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request) {
  const origin  = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type':                 'application/json',
  };
}

const MAX_ATTEMPTS  = 5;
const LOCK_DURATION = 5 * 60000; // 5 minutes

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: corsHeaders });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Service role required for auth.admin.updateUserById
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { userId, otpCode } = await req.json();

    if (!userId || !otpCode) {
      return respond({ error: 'userId and otpCode are required' }, 400);
    }

    // ── Fetch the latest unused OTP for this user ─────────────────────────
    const { data: otpRecord, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('is_used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return respond({ error: 'No active OTP found. Please request a new one.' }, 400);
    }

    // ── Check if account is locked ────────────────────────────────────────
    if (otpRecord.locked_until) {
      const lockedUntil = new Date(otpRecord.locked_until);
      if (lockedUntil > new Date()) {
        const remainingMs   = lockedUntil.getTime() - Date.now();
        const remainingMins = Math.ceil(remainingMs / 60000);
        return respond({
          error:       `Account locked. Too many failed attempts. Try again in ${remainingMins} minute(s).`,
          locked:      true,
          lockedUntil: otpRecord.locked_until,
        }, 429);
      }
    }

    // ── Check if OTP has expired ──────────────────────────────────────────
    if (new Date(otpRecord.expires_at) < new Date()) {
      await supabase
        .from('otp_codes')
        .update({ is_used: true })
        .eq('id', otpRecord.id);
      return respond({ error: 'OTP has expired. Please request a new one.' }, 400);
    }

    // ── Verify OTP code ───────────────────────────────────────────────────
    if (otpRecord.otp_code !== otpCode.trim()) {
      const newAttempts = (otpRecord.attempts || 0) + 1;
      const remaining   = MAX_ATTEMPTS - newAttempts;

      if (newAttempts >= MAX_ATTEMPTS) {
        const lockedUntil = new Date(Date.now() + LOCK_DURATION).toISOString();
        await supabase
          .from('otp_codes')
          .update({ attempts: newAttempts, locked_until: lockedUntil })
          .eq('id', otpRecord.id);

        return respond({
          error:       'Too many failed attempts. Your account is locked for 5 minutes.',
          locked:      true,
          lockedUntil,
        }, 429);
      }

      await supabase
        .from('otp_codes')
        .update({ attempts: newAttempts })
        .eq('id', otpRecord.id);

      return respond({
        error:     `Incorrect OTP. ${remaining} attempt(s) remaining.`,
        attempts:  newAttempts,
        remaining,
      }, 400);
    }

    // ── OTP is correct — mark as used ─────────────────────────────────────
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('id', otpRecord.id);

    // ── Confirm the user's email so signInWithPassword works ─────────────
    // ✅ Correct method: updateUserById (not updateUser)
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      userId,
      { email_confirm: true }
    );

    if (confirmError) {
      console.error('Email confirmation error:', confirmError.message);
      return respond({
        error: `OTP verified but failed to activate account: ${confirmError.message}`,
      }, 500);
    }

    console.log('OTP verified and email confirmed for user:', userId);

    return respond({ success: true, message: 'OTP verified successfully.' });

  } catch (err: any) {
    console.error('verify-otp error:', err);
    return respond({ error: err.message || 'Internal server error' }, 500);
  }
});