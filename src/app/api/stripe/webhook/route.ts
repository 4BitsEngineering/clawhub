// El webhook de Stripe se gestiona desde la Supabase Edge Function:
// supabase/functions/stripe-webhook/index.ts
//
// URL: https://sbtpydttrswiljnskrsq.supabase.co/functions/v1/stripe-webhook
//
// Esta ruta Next.js ya no se usa.

export async function POST() {
  return new Response(
    "Este webhook ha sido migrado a Supabase Edge Functions.",
    { status: 410 },
  );
}
