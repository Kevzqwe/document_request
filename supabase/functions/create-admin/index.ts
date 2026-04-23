import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decode } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

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

function toStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function generatePassword(lastName: string, contactNumber: string): string {
  const cleanedPhone = contactNumber.replace(/\D/g, '');
  const last4 = cleanedPhone.length >= 4
    ? cleanedPhone.slice(-4)
    : cleanedPhone.padStart(4, '0');
  const cleanedLastName = lastName.trim().replace(/\s+/g, '');
  return `${cleanedLastName}${last4}`;
}

const respond = (corsHeaders: Record<string, string>, body: object, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin  = createClient(supabaseUrl, serviceRoleKey);

    // ── Auth check ────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return respond(corsHeaders, { error: 'Unauthorized: missing Bearer token' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    if (token.split('.').length !== 3) {
      return respond(corsHeaders, { error: 'Unauthorized: invalid token format' }, 401);
    }

    // Decode JWT to get user ID without needing getUser()
    let callerId: string;
    try {
      const [_header, payload] = decode(token);
      const p = payload as Record<string, any>;
      callerId = p.sub as string;
      if (!callerId) throw new Error('No sub in token');

      // Check token expiry
      if (p.exp && p.exp < Math.floor(Date.now() / 1000)) {
        return respond(corsHeaders, { error: 'Unauthorized: token expired' }, 401);
      }
    } catch (e: any) {
      return respond(corsHeaders, { error: `Unauthorized: ${e.message}` }, 401);
    }

    // ── Check caller is admin ─────────────────────────────────────────────────
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callerId)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return respond(corsHeaders, { error: 'Forbidden: admin only' }, 403);
    }

    // ── Parse body ────────────────────────────────────────────────────────────
    let body: any;
    try { body = await req.json(); }
    catch { return respond(corsHeaders, { error: 'Invalid JSON body' }, 400); }

    const email          = toStr(body.email).toLowerCase();
    const first_name     = toStr(body.first_name);
    const last_name      = toStr(body.last_name);
    const middle_name    = toStr(body.middle_name);
    const contact_number = toStr(body.contact_number);
    const admin_role     = toStr(body.admin_role) || 'admin';

    const validRoles = ['admin', 'programhead', 'cashier'];
    if (!validRoles.includes(admin_role)) {
      return respond(corsHeaders, { error: 'Invalid role. Must be admin, programhead, or cashier.' }, 400);
    }

    if (!email)          return respond(corsHeaders, { error: 'email is required' }, 400);
    if (!first_name)     return respond(corsHeaders, { error: 'first_name is required' }, 400);
    if (!last_name)      return respond(corsHeaders, { error: 'last_name is required' }, 400);
    if (!contact_number) return respond(corsHeaders, { error: 'contact_number is required' }, 400);

    // ── Check for duplicate email ─────────────────────────────────────────────
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
    const emailExists = existingUsers?.users?.some((u) => u.email?.toLowerCase() === email);
    if (emailExists) {
      return respond(corsHeaders, {
        error: `A user with email "${email}" already exists.`,
      }, 400);
    }

    const password = generatePassword(last_name, contact_number);
    console.log('Creating account for:', email, '| role:', admin_role, '| password:', password);

    // ── Create auth user ──────────────────────────────────────────────────────
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role:           admin_role,
        username:       email,
        first_name,
        last_name,
        middle_name:    middle_name || null,
        contact_number: contact_number || null,
      },
    });

    if (createError) {
      console.error('createUser error:', createError.message);
      return respond(corsHeaders, { error: createError.message }, 400);
    }

    const userId = newUser.user!.id;
    console.log('Auth user created:', userId);

    // ── Ensure user_roles row exists ──────────────────────────────────────────
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: userId, role: admin_role }, { onConflict: 'user_id,role' });

    if (roleInsertError) {
      console.error('user_roles insert error:', roleInsertError.message);
    }

    // ── Wait for trigger, then insert profile row if missing ──────────────────
    await new Promise((r) => setTimeout(r, 600));

    const profileData = {
      user_id:        userId,
      username:       email,
      first_name,
      last_name,
      middle_name:    middle_name || null,
      contact_number: contact_number || null,
      is_archived:    false,
    };

    if (admin_role === 'cashier') {
      const { data: existing } = await supabaseAdmin
        .from('cashiers').select('id').eq('user_id', userId).single();
      if (!existing) {
        const { error: e } = await supabaseAdmin
          .from('cashiers').insert({ ...profileData, admin_role: 'cashier' });
        if (e) return respond(corsHeaders, { error: `cashiers insert failed: ${e.message}` }, 500);
        console.log('Cashier row inserted for:', email);
      }

    } else if (admin_role === 'programhead') {
      const { data: existing } = await supabaseAdmin
        .from('programheads').select('id').eq('user_id', userId).single();
      if (!existing) {
        const { error: e } = await supabaseAdmin
          .from('programheads').insert({ ...profileData, admin_role: 'programhead' });
        if (e) return respond(corsHeaders, { error: `programheads insert failed: ${e.message}` }, 500);
        console.log('Programhead row inserted for:', email);
      }

    } else {
      const { data: existing } = await supabaseAdmin
        .from('admins').select('id').eq('user_id', userId).single();
      if (!existing) {
        const { error: e } = await supabaseAdmin
          .from('admins').insert({ ...profileData, admin_role: 'admin' });
        if (e) return respond(corsHeaders, { error: `admins insert failed: ${e.message}` }, 500);
        console.log('Admin row inserted for:', email);
      }
    }

    console.log(`${admin_role} profile confirmed for:`, email);

    // ── Send welcome email ────────────────────────────────────────────────────
    try {
      const roleLabel = admin_role === 'programhead' ? 'Program Head'
        : admin_role === 'cashier' ? 'Cashier'
        : 'Administrator';

      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-gmail`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${serviceRoleKey}`,
          'apikey':        serviceRoleKey,
        },
        body: JSON.stringify({
          to:          email,
          studentName: `${first_name} ${last_name}`,
          email,
          password,
          studentId:   roleLabel,
          gradeLevel:  'Staff Portal',
          section:     '',
        }),
      });

      if (!emailRes.ok) {
        const d = await emailRes.json();
        console.error('Email failed:', JSON.stringify(d));
      } else {
        console.log('Welcome email sent to:', email);
      }
    } catch (emailErr: any) {
      console.error('Email error (non-critical):', emailErr.message);
    }

    return respond(corsHeaders, {
      success: true,
      user_id: userId,
      message: `${admin_role} account created for ${first_name} ${last_name}.`,
    });

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return respond(corsHeaders, { error: err.message || 'Internal server error' }, 500);
  }
});