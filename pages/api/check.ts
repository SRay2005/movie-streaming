import type { NextApiRequest, NextApiResponse } from "next";

// Known block page fingerprints from common campus/enterprise firewalls
const BLOCK_SIGNATURES = [
  // Fortinet FortiGuard
  "high security alert",
  "fortinet",
  "forticlient",
  "fortiguard",
  "js/redirector",
  // Cisco Umbrella
  "cisco umbrella",
  "umbrella.cisco.com",
  // Barracuda
  "barracuda networks",
  "barracudacentral",
  // Sophos
  "sophos web appliance",
  "sophos.com/en-us/threat",
  // Zscaler
  "zscaler",
  "zscalerone",
  // Palo Alto
  "palo alto networks",
  "pan-db",
  // Generic block pages
  "access denied",
  "this site is blocked",
  "website blocked",
  "blocked by",
  "content filtering",
  "internet access blocked",
  "request rejected",
  "your request has been blocked",
  // Vercel / hosting provider paused/dead deployments
  "this deployment is temporarily paused",
  "deployment not found",
  "this project is not deployed",
];

// Firewall domains that Fortinet / others redirect the browser to
const FIREWALL_REDIRECT_DOMAINS = [
  "fortinet",
  "fortigate",
  "fortiguard",
  "umbrella.cisco",
  "zscaler",
  "barracuda",
  "safebrowsing",
  "phishtank",
  "mcafee",
  "webroot",
];

/** Read up to `maxBytes` from a ReadableStream, returned as a lowercase string */
async function readBodyUpTo(
  body: ReadableStream<Uint8Array>,
  maxBytes = 51200 // 50 KB — more than enough for any block page
): Promise<string> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let totalRead = 0;

  try {
    while (totalRead < maxBytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalRead += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => { }); // Release the lock regardless
  }

  const merged = new Uint8Array(totalRead);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged).toLowerCase();
}

/** Extract the root domain (e.g. "vidjoy.pro") from a URL string */
function rootDomain(url: string): string {
  try {
    const host = new URL(url).hostname.toLowerCase();
    // Strip leading "www." or "ww38." style prefixes
    const parts = host.split(".");
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return host;
  } catch {
    return "";
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  let origin: string;
  let requestedRootDomain: string;
  try {
    const parsed = new URL(url);
    origin = parsed.origin;
    requestedRootDomain = rootDomain(url);
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(origin, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    clearTimeout(timeout);

    // ── 1. Read up to 50KB of the response body ────────────────────────────
    let body = "";
    if (response.body) {
      body = await readBodyUpTo(response.body, 51200);
    }

    // ── 2. Block page fingerprinting ───────────────────────────────────────
    const isBlockPage = BLOCK_SIGNATURES.some((sig) =>
      body.includes(sig.toLowerCase())
    );

    // ── 3. Firewall redirect domain check ──────────────────────────────────
    const finalUrl = response.url || origin;
    const isFirewallRedirect = FIREWALL_REDIRECT_DOMAINS.some((fw) =>
      finalUrl.toLowerCase().includes(fw)
    );

    // ── 4. Domain hijacking / redirect chain check ─────────────────────────
    // If the final URL's root domain is completely different from what we
    // requested, the site redirected us somewhere else (parking page, ad page,
    // or a Fortinet-like interception subdomain).  Mark it as broken.
    const finalRootDomain = rootDomain(finalUrl);
    const domainMismatch =
      finalRootDomain !== "" &&
      requestedRootDomain !== "" &&
      finalRootDomain !== requestedRootDomain;

    const working =
      response.ok && !isBlockPage && !isFirewallRedirect && !domainMismatch;

    return res.status(200).json({
      working,
      debug: {
        requestedOrigin: origin,
        requestedRootDomain,
        finalUrl,
        finalRootDomain,
        status: response.status,
        isBlockPage,
        isFirewallRedirect,
        domainMismatch,
        // Uncomment the line below temporarily if you want to see what the
        // first 500 characters of the response look like:
        // bodyPreview: body.slice(0, 500),
      },
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    // Network error = DNS block, TCP reset, SSL failure, or timeout
    return res.status(200).json({
      working: false,
      debug: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}
