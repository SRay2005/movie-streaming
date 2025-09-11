import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { url } = req.query;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ ok: false });
  }

  try {
    const response = await fetch(url, { method: "HEAD" }); // light check
    res.status(200).json({ ok: response.ok });
  } catch {
    res.status(200).json({ ok: false });
  }
}
