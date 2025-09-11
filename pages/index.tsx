import { useEffect, useState } from "react";
import sites from "../sites.json";

export default function Home() {
  const [status, setStatus] = useState("Checking available sites...");

  useEffect(() => {
    const checkSites = async () => {
      for (const site of sites) {
        try {
          setStatus(`Checking: ${site} ...`);

          const img = new Image();
          img.src = site + "/favicon.ico?" + Date.now(); // avoid cache

          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject(new Error("Blocked or not reachable"));
            setTimeout(() => reject(new Error("Timeout")), 3000); // 3s timeout
          });

          // ✅ Success → redirect
          setStatus(`✅ Found working site: ${site}. Redirecting...`);
          window.location.href = site;
          return;
        } catch (err) {
          console.warn(`Site failed: ${site}`, err);
          // move on to the next site
        }
      }

      setStatus("❌ No available sites were found on your network.");
    };

    checkSites();
  }, []);

  return (
    <div className="h-screen flex items-center justify-center">
      <p>{status}</p>
    </div>
  );
}
