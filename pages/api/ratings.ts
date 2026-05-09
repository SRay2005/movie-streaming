import type { NextApiRequest, NextApiResponse } from "next";
import { Redis } from "@upstash/redis";

// Upstash Redis — free tier, persists across deployments and cold starts.
// Env vars UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are read
// automatically from .env.local (dev) or Vercel environment variables (prod).
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const RATINGS_KEY = "site_ratings";

type SiteRating = { up: number; down: number };
type Ratings = Record<string, SiteRating>;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    try {
      const data = (await redis.get<Ratings>(RATINGS_KEY)) ?? {};
      return res.status(200).json(data);
    } catch (err) {
      console.error("Redis GET error:", err);
      return res.status(500).json({ error: "Failed to read ratings" });
    }
  }

  if (req.method === "POST") {
    const { site, vote } = req.body as { site?: string; vote?: "up" | "down" };

    if (!site || (vote !== "up" && vote !== "down")) {
      return res.status(400).json({ error: "Missing site or vote (up|down)" });
    }

    try {
      // Read current ratings, update, write back
      const data = (await redis.get<Ratings>(RATINGS_KEY)) ?? {};
      if (!data[site]) data[site] = { up: 0, down: 0 };
      data[site][vote] = (data[site][vote] ?? 0) + 1;

      await redis.set(RATINGS_KEY, data);
      return res.status(200).json(data[site]);
    } catch (err) {
      console.error("Redis POST error:", err);
      return res.status(500).json({ error: "Failed to save rating" });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
