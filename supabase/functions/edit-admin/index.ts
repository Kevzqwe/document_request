import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = ['https://document-request.vercel.app'];

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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl    = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin  = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid session.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Must be admin
    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const record_id      = toStr(body.record_id);
    const account_type   = toStr(body.account_type);
    const first_name     = toStr(body.first_name);
    const last_name      = toStr(body.last_name);
    const middle_name    = toStr(body.middle_name);
    const contact_number = toStr(body.contact_number);
    const admin_role     = toStr(body.admin_role);

    if (!record_id)  return new Response(JSON.stringify({ error: 'record_id is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!first_name) return new Response(JSON.stringify({ error: 'first_name is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!last_name)  return new Response(JSON.stringify({ error: 'last_name is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const TABLE_MAP: Record<string, string> = {
      admin:       'admins',
      cashier:     'cashiers',
      programhead: 'programheads',
    };

    const table = TABLE_MAP[account_type];
    if (!table) {
      return new Response(JSON.stringify({ error: 'Invalid account_type. Must be admin, cashier, or programhead.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Normalize and validate contact number
    let normalizedContact: string | null = contact_number || null;
    if (normalizedContact) {
      if (normalizedContact.startsWith('9')) normalizedContact = '0' + normalizedContact;
      if (normalizedContact.length !== 11) {
        return new Response(JSON.stringify({ error: 'Failed to save: number must be 11 digits' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const updatePayload: Record<string, any> = {
      first_name,
      last_name,
      middle_name:    middle_name    || null,
      contact_number: normalizedContact,
    };

    if (account_type === 'admin' && admin_role) {
      updatePayload.admin_role = admin_role;
    }

    const { error: updateError } = await supabaseAdmin
      .from(table)
      .update(updatePayload)
      .eq('id', record_id);

    if (updateError) {
      console.error('Admin update error:', updateError.message);
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, message: `${account_type} updated successfully.` }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});