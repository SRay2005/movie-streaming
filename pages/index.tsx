import { useEffect, useState } from "react";
import sites from "../sites.json";

export default function Home() {
  const [status, setStatus] = useState("Checking available sites...");

  // helper: wait N ms
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    const checkSites = async () => {
      for (const site of sites) {
        try {
          // show which site is being checked
          setStatus(`🔎 Checking: ${site}`);
          await delay(500); // let UI update for half a second

          const img = new Image();
          img.src = site + "/favicon.ico?" + Date.now();

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Blocked or not reachable"));
            setTimeout(() => reject(new Error("Timeout")), 3000);
          });

          // ✅ Success → redirect (after showing status briefly)
          setStatus(`✅ Found working site: ${site}. Redirecting...`);
          await delay(1500); // give user time to see the result
          window.location.href = site;
          return;
        } catch (err) {
          console.warn(`❌ Site failed: ${site}`, err);
          // continue to next site
        }
      }

      setStatus("❌ No available sites were found on your network.");
    };

    checkSites();
  }, []);

  return (
    <div className="h-screen flex items-center justify-center text-lg font-mono">
      <p>{status}</p>
    </div>
  );
}
