const KEYISH = /(?:\/v2\/|\/v3\/|\/nft\/v3\/)[A-Za-z0-9_-]{8,}/g;
const QUERY_KEY = /([?&](?:apikey|api_key|key)=)[^&\s]+/gi;
const ASSIGN_KEY = /((?:api[_-]?key|alchemy[_-]?key)\s*[:=]\s*)[A-Za-z0-9_-]{8,}/gi;

export function sanitizeProviderUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    const path = u.pathname.replace(KEYISH, "/v2/***");
    return `${u.protocol}//${u.host}${path}`;
  } catch {
    return url.replace(KEYISH, "/v2/***").replace(QUERY_KEY, "$1***");
  }
}

export function sanitizeProviderText(text: string | null | undefined): string | null {
  if (text == null) return null;
  return text.replace(KEYISH, "/v2/***").replace(QUERY_KEY, "$1***").replace(ASSIGN_KEY, "$1***");
}

export function payloadContainsSecret(payload: unknown, secrets: string[]): boolean {
  const raw = JSON.stringify(payload);
  return secrets.some((s) => s.length >= 8 && raw.includes(s));
}
