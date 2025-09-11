import { useEffect, useState } from "react";
import sites from "../sites.json";

export default function Home() {
  const [status, setStatus] = useState("Checking available sites...");

  useEffect(() => {
    const checkSites = async () => {
      for (const site of sites) {
        try {
          // Try to load favicon (works around CORS restrictions)
          const img = new Image();
          img.src = site + "/favicon.ico?" + Date.now(); // timestamp busts cache

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Blocked or not reachable"));
            setTimeout(() => reject(new Error("Timeout")), 3000); // 3s timeout
          });

          // ✅ This redirect now reflects *your network*, not Vercel's
          setStatus(`Redirecting to ${site}...`);
          window.location.href = site;
          return;
        } catch (err) {
          console.warn(`Site failed: ${site}`, err);
          continue;
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
