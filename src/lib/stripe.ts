import Stripe from "stripe";

// null when STRIPE_SECRET_KEY is not configured (dev / pre-launch)
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2026-06-24.dahlia" as Stripe.LatestApiVersion,
    })
  : null;

export const ANNUAL_LICENSE_NAME = "AI-Office · Licencia Anual";
export const ANNUAL_LICENSE_DESC =
  "Acceso completo a AI-Office durante un año. Activación inmediata.";
