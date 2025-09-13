import { useEffect, useState } from "react";
import sites from "../sites.json";

export default function Home() {
  const [status, setStatus] = useState("Checking available sites...");
  const [workingSites, setWorkingSites] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [progress, setProgress] = useState(0);

  const checkSite = (site: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = site + "/favicon.ico?" + Date.now();

      const timer = setTimeout(() => resolve(false), 3000);

      img.onload = () => {
        clearTimeout(timer);
        if (
          img.width > 0 &&
          img.width <= 128 &&
          img.height > 0 &&
          img.height <= 128
        ) {
          resolve(true);
        } else {
          resolve(false);
        }
      };

      img.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
    });
  };

  useEffect(() => {
    const checkAllSites = async () => {
      setStatus("Checking available sites...");
      setProgress(0);

      const results = await Promise.all(
        sites.map(async (site) => {
          const ok = await checkSite(site);
          setProgress((prev) => prev + 1);

          if (!ok) return null;

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            await fetch(site + "/robots.txt", {
              method: "GET",
              mode: "no-cors",
              signal: controller.signal,
            });

            clearTimeout(timeout);
            return site;
          } catch {
            return null;
          }
        })
      );

      const available = results.filter((s): s is string => s !== null);
      setWorkingSites(available);

      if (available.length === 0) {
        setStatus("No available sites were found on your network.");
        return;
      }

      let countdown = 15;
      const interval = setInterval(() => {
        if (countdown > 0) {
          setStatus(
            `Redirecting to ${available[0]} in ${countdown}s... (Found ${available.length} working site${
              available.length > 1 ? "s" : ""
            })`
          );
          countdown--;
        } else {
          clearInterval(interval);
          if (!showOptions) {
            window.location.href = available[0];
          }
        }
      }, 1000);
    };

    checkAllSites();
  }, [showOptions]);

  const getSiteName = (url: string) => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white p-6">
      <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
        <p className="text-lg font-medium">{status}</p>

        {progress < sites.length && (
          <p className="text-sm text-gray-400">
            Checked {progress} of {sites.length} sites...
          </p>
        )}

        {workingSites.length > 1 && (
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="px-4 py-2 rounded-lg bg-gray-700 text-white hover:bg-gray-800"
          >
            {showOptions ? "Hide other sites" : "Show other working sites"}
          </button>
        )}

        {showOptions && (
          <div className="w-full flex justify-center">
            <table className="table-auto border-collapse border border-gray-600 w-full max-w-2xl rounded-lg overflow-hidden shadow-lg">
              <thead>
                <tr className="bg-gray-800 text-white">
                  <th className="border border-gray-600 px-6 py-3 text-left">
                    Site
                  </th>
                  <th className="border border-gray-600 px-6 py-3 text-center">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {workingSites.map((site) => (
                  <tr
                    key={site}
                    className="bg-gray-900 text-gray-200 hover:bg-gray-700"
                  >
                    <td className="border border-gray-600 px-6 py-3">
                      {getSiteName(site)}
                    </td>
                    <td className="border border-gray-600 px-6 py-3 text-center">
                      <button
                        onClick={() => (window.location.href = site)}
                        className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                      >
                        Go
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
