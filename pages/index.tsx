import { useEffect, useState } from "react";
import sites from "../sites.json";

export default function Home() {
  const [status, setStatus] = useState("Checking available sites...");

  useEffect(() => {
    const checkSites = async () => {
      for (const site of sites) {
        try {
          setStatus(`Checking ${site}...`);

          // STEP 1: Try favicon (small image expected)
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.src = site + "/favicon.ico?" + Date.now();

            const timer = setTimeout(() => reject(new Error("Timeout")), 3000);

            img.onload = () => {
              clearTimeout(timer);

              // Check favicon dimensions (Fortinet block pages won’t be tiny icons)
              if (
                img.width > 0 &&
                img.width <= 128 &&
                img.height > 0 &&
                img.height <= 128
              ) {
                resolve();
              } else {
                reject(new Error("Invalid favicon size, probably blocked"));
              }
            };

            img.onerror = () => {
              clearTimeout(timer);
              reject(new Error("Blocked or not reachable"));
            };
          });

          // STEP 2: Double-check with robots.txt
          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(site + "/robots.txt", {
              method: "GET",
              mode: "no-cors",
              signal: controller.signal,
            });

            clearTimeout(timeout);

            // If it didn’t throw, assume okay (mode:no-cors hides status, but blocked sites usually throw)
          } catch {
            throw new Error("Robots.txt fetch failed, likely blocked");
          }

          // If both checks pass → redirect
          setStatus(`Redirecting to ${site}...`);
          window.location.href = site;
          return;
        } catch (err) {
          console.warn(`Site failed: ${site}`, err);
          continue; // try next site
        }
      }

      setStatus("No available sites were found on your network.");
    };

    checkSites();
  }, []);

  return (
    <div className="h-screen flex items-center justify-center">
      <p>{status}</p>
    </div>
  );
}
