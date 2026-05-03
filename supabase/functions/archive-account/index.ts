import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://document-request.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:8080',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Content-Type':                 'application/json',
  };
}

// Map account_type → correct table
function getTable(account_type: string): string | null {
  switch (account_type) {
    case 'admin':       return 'admins';
    case 'cashier':     return 'cashiers';
    case 'programhead': return 'programheads';
    case 'student':     return 'students';
    default:            return null;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const respond = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return respond({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '').trim();
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !caller) {
      return respond({ error: 'Unauthorized' }, 401);
    }

    // Check caller is admin — check admins table directly (no user_roles dependency)
    const { data: adminRow } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('user_id', caller.id)
      .eq('is_archived', false)
      .maybeSingle();

    if (!adminRow) {
      return respond({ error: 'Forbidden: admin only' }, 403);
    }

    const body = await req.json();
    const { user_id, account_type, action } = body;

    if (!user_id || !account_type || !action) {
      return respond({ error: 'user_id, account_type, and action are required' }, 400);
    }

    if (action !== 'archive' && action !== 'unarchive') {
      return respond({ error: 'action must be "archive" or "unarchive"' }, 400);
    }

    // ── Route to the correct table ────────────────────────────────────────
    const table = getTable(account_type);
    if (!table) {
      return respond({ error: `Unknown account_type: ${account_type}` }, 400);
    }

    const isArchiving = action === 'archive';

    const { error: updateError, count } = await supabaseAdmin
      .from(table)
      .update({
        is_archived: isArchiving,
        archived_at: isArchiving ? new Date().toISOString() : null,
      })
      .eq('user_id', user_id);

    if (updateError) {
      console.error('Archive update error:', updateError.message);
      return respond({ error: updateError.message }, 400);
    }

    console.log(`User ${user_id} ${action}d in table ${table} (rows affected: ${count})`);

    return respond({
      success: true,
      message: `Account ${isArchiving ? 'archived' : 'restored'} successfully`,
    });

  } catch (err: any) {
    console.error('Unexpected error:', err);
    return respond({ error: err.message || 'Internal server error' }, 500);
  }
});