import Stripe from "stripe";
import { getEnv } from "./env.js";

const env = getEnv();

export const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-06-20",
});
