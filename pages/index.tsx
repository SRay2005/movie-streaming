import { useEffect, useState, useRef } from "react";
import sites from "../sites.json";
import { track } from "@vercel/analytics";

export default function Home() {
  const [status, setStatus] = useState("Checking available sites...");
  const [workingSites, setWorkingSites] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(15);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const checkSite = (site: string): Promise<boolean> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = site + "/favicon.ico?" + Date.now();

      const timer = setTimeout(() => resolve(false), 3000);

      img.onload = () => {
        clearTimeout(timer);
        resolve(true); // favicon loaded → assume working
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
          return ok ? site : null;
        })
      );

      const available = results.filter((s): s is string => s !== null);
      setWorkingSites(available);

      if (available.length === 0) {
        setStatus("No available sites were found on your network.");
        return;
      }

      // Reset countdown
      setCountdown(15);

      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            if (!showOptions) {
              track("auto_redirect", { site: available[0] }); // 👈 log event
              window.location.href = available[0];
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    };

    checkAllSites();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    // If user opens options, stop auto redirect
    if (showOptions && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
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
        <p className="text-lg font-medium">
          {workingSites.length > 0 && countdown > 0 && !showOptions
            ? `Redirecting to ${workingSites[0]} in ${countdown}s... (Found ${workingSites.length} working site${workingSites.length > 1 ? "s" : ""
              })`
            : status}
        </p>

        {progress < sites.length && (
          <p className="text-sm text-gray-400">
            Checked {progress} of {sites.length} sites...
          </p>
        )}

        {workingSites.length > 1 && (
          <button
            onClick={() => {
              track("show_other_sites"); // 👈 log event
              setShowOptions(!showOptions);
            }}
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
                        onClick={() => {
                          track("manual_redirect", { site }); // 👈 log event
                          window.location.href = site;
                        }}
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
