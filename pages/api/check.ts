import type { NextApiRequest, NextApiResponse } from "next";

// Known block page fingerprints from common campus/enterprise firewalls
const BLOCK_SIGNATURES = [
  // Fortinet FortiGuard (what your college uses)
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
  // Generic captive portal / block pages
  "access denied",
  "this site is blocked",
  "website blocked",
  "blocked by",
  "content filtering",
  "internet access blocked",
  "request rejected",
  "your request has been blocked",
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "Missing url parameter" });
  }

  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(origin, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        // Mimic a real browser to avoid sites rejecting bot-like requests
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
    });

    clearTimeout(timeout);

    // Read a chunk of the response body (first 8KB is enough to fingerprint block pages)
    const reader = response.body?.getReader();
    let bodyChunk = "";
    if (reader) {
      const { value } = await reader.read();
      reader.cancel(); // Don't need the rest
      if (value) {
        bodyChunk = new TextDecoder().decode(value).toLowerCase();
      }
    }

    // Check if the response body matches any known block page signature
    const isBlocked = BLOCK_SIGNATURES.some((sig) =>
      bodyChunk.includes(sig.toLowerCase())
    );

    // Also check final URL after redirects — Fortinet often redirects to its own domain
    const finalUrl = response.url || origin;
    const isRedirectedToFirewall =
      finalUrl.includes("fortinet") ||
      finalUrl.includes("fortigate") ||
      finalUrl.includes("umbrella.cisco") ||
      finalUrl.includes("zscaler") ||
      finalUrl.includes("barracuda");

    const working = response.ok && !isBlocked && !isRedirectedToFirewall;

    return res.status(200).json({
      working,
      // Helpful debug info (remove in production if you want)
      debug: {
        status: response.status,
        finalUrl,
        isBlocked,
        isRedirectedToFirewall,
      },
    });
  } catch (err: unknown) {
    clearTimeout(timeout);

    // Network error = site is unreachable (DNS block, TCP reset, SSL failure, timeout)
    // This is a genuine block
    return res.status(200).json({
      working: false,
      debug: { error: err instanceof Error ? err.message : String(err) },
    });
  }
}
