import { getEnv } from "./env.js";
import twilio from "twilio";

const env = getEnv();

export const twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);

export function validateTwilioSignature(reqUrl: string, params: Record<string, any>, signature: string) {
  // Twilio Node SDK provides validator:
  return twilio.validateRequest(env.TWILIO_AUTH_TOKEN, signature, reqUrl, params);
}
