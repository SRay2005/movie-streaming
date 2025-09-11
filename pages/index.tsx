import { useEffect, useState } from "react";
import sites from "../sites.json";

export default function Home() {
  const [status, setStatus] = useState("Checking available sites...");
  const [currentSite, setCurrentSite] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      for (const site of sites) {
        setCurrentSite(site); // show which site is being checked
        try {
          const res = await fetch(`/api/check?url=${encodeURIComponent(site)}`);
          const { ok } = await res.json();

          if (ok) {
            setStatus(`✅ Found working site: ${site}`);
            // Redirect after short delay so user sees result
            setTimeout(() => {
              window.location.href = site;
            }, 1500);
            return;
          }
        } catch {
          // ignore errors and continue
        }
      }
      setCurrentSite(null);
      setStatus("❌ No site available on this network.");
    })();
  }, []);

  return (
    <div style={{ textAlign: "center", padding: "2rem" }}>
      <h1>🎬 Movie Redirector</h1>
      <p>{status}</p>
      {currentSite && <p>🔍 Currently checking: {currentSite}</p>}
    </div>
  );
}
