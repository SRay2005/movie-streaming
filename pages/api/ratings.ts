import type { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";

// Store ratings in a JSON file in the project's tmp dir (persists across requests on one server instance)
// On Vercel this resets between cold starts — for persistent cross-user ratings you'd want a DB or KV store.
// The file lives at the project root so it survives hot-reloads in dev.
const RATINGS_FILE = path.join(process.cwd(), "ratings.json");

type Ratings = Record<string, { up: number; down: number }>;

function readRatings(): Ratings {
  try {
    if (fs.existsSync(RATINGS_FILE)) {
      return JSON.parse(fs.readFileSync(RATINGS_FILE, "utf-8")) as Ratings;
    }
  } catch {
    // ignore parse errors — start fresh
  }
  return {};
}

function writeRatings(data: Ratings) {
  try {
    fs.writeFileSync(RATINGS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // ignore write errors (e.g. read-only FS on Vercel — ratings will just be in-memory)
  }
}

// In-memory fallback for environments where FS writes fail (Vercel Edge etc.)
let memoryStore: Ratings = readRatings();

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    // Return all ratings
    const data = readRatings();
    memoryStore = data;
    return res.status(200).json(data);
  }

  if (req.method === "POST") {
    const { site, vote } = req.body as { site?: string; vote?: "up" | "down" };

    if (!site || (vote !== "up" && vote !== "down")) {
      return res.status(400).json({ error: "Missing site or vote (up|down)" });
    }

    const data = { ...memoryStore };
    if (!data[site]) data[site] = { up: 0, down: 0 };
    data[site][vote] = (data[site][vote] ?? 0) + 1;

    memoryStore = data;
    writeRatings(data);

    return res.status(200).json(data[site]);
  }

  return res.status(405).json({ error: "Method not allowed" });
}
