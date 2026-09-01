import { publishableKeyFromHost } from "@clerk/react/internal";

const configuredKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim();

export const clerkPubKey = configuredKey
  ? publishableKeyFromHost(window.location.hostname, configuredKey)
  : undefined;

export const clerkEnabled = Boolean(clerkPubKey);
export const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;