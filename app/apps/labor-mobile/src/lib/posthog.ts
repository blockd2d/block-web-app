import { PostHog } from "posthog-react-native";
import { env } from "../env";

export const posthog = new PostHog(env.POSTHOG_KEY, { host: env.POSTHOG_HOST });
