import Stripe from 'npm:stripe@17';
import { createClient } from 'jsr:@supabase/supabase-js@2';

// Authenticated (app is logged in). Toggles cancel_at_period_end on the user's active Stripe
// subscription; the stripe-webhook then syncs users/subscriptions. Replaces the client-side
// db.js write, which Plan 1's billing guard + subscriptions RLS now (correctly) block.
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) return json({ error: 'unauthenticated' }, 401);

    const { on } = await req.json();
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: sub } = await svc.from('subscriptions').select('id')
      .eq('user_id', user.id).in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (!sub) return json({ error: 'no active subscription' }, 400);

    await stripe.subscriptions.update(sub.id, { cancel_at_period_end: !on });
    return json({ ok: true });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
