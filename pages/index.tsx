import { useEffect, useState, useRef, useCallback } from "react";
import sites from "../sites.json";
import { track } from "@vercel/analytics";
import styles from "./index.module.css";

type SiteRating = { up: number; down: number };
type Ratings = Record<string, SiteRating>;

// Score = upvotes - downvotes, used to rank sites
function score(r: SiteRating | undefined): number {
  if (!r) return 0;
  return (r.up ?? 0) - (r.down ?? 0);
}

function getSiteName(url: string) {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export default function Home() {
  const [status, setStatus] = useState("Scanning available sites…");
  const [workingSites, setWorkingSites] = useState<string[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(15);
  const [ratings, setRatings] = useState<Ratings>({});
  const [votedSites, setVotedSites] = useState<Record<string, "up" | "down">>({});
  const [done, setDone] = useState(false);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch all ratings once on mount
  useEffect(() => {
    fetch("/api/ratings")
      .then((r) => r.json())
      .then((data: Ratings) => setRatings(data))
      .catch(() => {});
  }, []);

  const checkSite = async (url: string): Promise<boolean> => {
    try {
      // Fetch directly from the browser so the check goes through the user's
      // actual network. Campus/enterprise firewalls (FortiGuard, Cisco Umbrella,
      // etc.) intercept at the network layer: the SSL cert they serve won't
      // match the requested domain, causing a hard network error here.
      // mode:'no-cors' lets us attempt the request without CORS restrictions;
      // an opaque success response means the site is reachable.
      const res = await fetch(url, {
        mode: "no-cors",
        signal: AbortSignal.timeout(10000),
      });
      // opaque or basic response = site responded = not blocked
      return res.type === "opaque" || res.type === "basic" || res.ok;
    } catch {
      // Network error, SSL failure, timeout, or DNS block = site is unreachable
      return false;
    }
  };

  useEffect(() => {
    const checkAllSites = async () => {
      setStatus("Scanning available sites…");
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
      setDone(true);

      if (available.length === 0) {
        setStatus("No available sites were found on your network.");
        return;
      }

      setStatus(`Found ${available.length} working site${available.length > 1 ? "s" : ""}.`);
      setCountdown(15);

      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            // Redirect to best-rated working site
            setRatings((currentRatings) => {
              const sorted = [...available].sort(
                (a, b) => score(currentRatings[b]) - score(currentRatings[a])
              );
              const best = sorted[0];
              if (!showOptions) {
                track("auto_redirect", { site: best });
                window.location.href = best;
              }
              return currentRatings;
            });
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
    if (showOptions && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [showOptions]);

  const handleVote = useCallback(
    async (site: string, vote: "up" | "down") => {
      // Optimistic update
      setRatings((prev) => {
        const existing = prev[site] ?? { up: 0, down: 0 };
        const prevVote = votedSites[site];
        const updated = { ...existing };

        // If already voted the same way, undo the vote
        if (prevVote === vote) {
          updated[vote] = Math.max(0, (updated[vote] ?? 0) - 1);
          setVotedSites((v) => {
            const next = { ...v };
            delete next[site];
            return next;
          });
        } else {
          // Remove opposite vote if existed
          if (prevVote) {
            updated[prevVote] = Math.max(0, (updated[prevVote] ?? 0) - 1);
          }
          updated[vote] = (updated[vote] ?? 0) + 1;
          setVotedSites((v) => ({ ...v, [site]: vote }));
        }
        return { ...prev, [site]: updated };
      });

      // Persist to server
      try {
        await fetch("/api/ratings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site, vote }),
        });
      } catch {
        // silent
      }
    },
    [votedSites]
  );

  // Sorted working sites by rating score (highest first)
  const sortedWorkingSites = [...workingSites].sort(
    (a, b) => score(ratings[b]) - score(ratings[a])
  );

  const bestSite = sortedWorkingSites[0];

  const progressPct = sites.length > 0 ? (progress / sites.length) * 100 : 0;

  return (
    <div className={styles.page}>
      {/* Background glow orbs */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />

      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>▶</span>
            <span className={styles.logoText}>StreamFinder</span>
          </div>
          <p className={styles.tagline}>Finding the best streaming sites on your network</p>
        </div>

        {/* Status card */}
        <div className={styles.statusCard}>
          {!done ? (
            <>
              <div className={styles.scanningRow}>
                <span className={styles.pulsingDot} />
                <span className={styles.statusText}>{status}</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className={styles.progressLabel}>
                {progress} / {sites.length} sites checked
              </p>
            </>
          ) : (
            <>
              {workingSites.length > 0 ? (
                <div className={styles.doneRow}>
                  <span className={styles.checkmark}>✓</span>
                  <div>
                    <p className={styles.doneTitle}>{status}</p>
                    {countdown > 0 && !showOptions && (
                      <p className={styles.countdownText}>
                        Redirecting to{" "}
                        <span className={styles.siteHighlight}>
                          {getSiteName(bestSite)}
                        </span>{" "}
                        in <span className={styles.siteHighlight}>{countdown}s</span>…
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className={styles.doneRow}>
                  <span className={styles.xmark}>✗</span>
                  <p className={styles.doneTitle}>{status}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        {done && workingSites.length > 0 && (
          <div className={styles.actions}>
            <button
              className={styles.primaryBtn}
              onClick={() => {
                track("manual_redirect", { site: bestSite });
                window.location.href = bestSite;
              }}
            >
              <span>Go to {getSiteName(bestSite)}</span>
              <span className={styles.btnIcon}>→</span>
            </button>

            {workingSites.length > 1 && (
              <button
                className={styles.secondaryBtn}
                onClick={() => {
                  track("show_other_sites");
                  setShowOptions((v) => !v);
                }}
              >
                {showOptions ? "Hide list" : `See all ${workingSites.length} sites`}
              </button>
            )}
          </div>
        )}

        {/* Sites table */}
        {showOptions && sortedWorkingSites.length > 0 && (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thRank}>#</th>
                  <th className={styles.thSite}>Site</th>
                  <th className={styles.thScore}>Score</th>
                  <th className={styles.thVotes}>Rate</th>
                  <th className={styles.thAction}>Go</th>
                </tr>
              </thead>
              <tbody>
                {sortedWorkingSites.map((site, i) => {
                  const r = ratings[site] ?? { up: 0, down: 0 };
                  const s = score(r);
                  const userVote = votedSites[site];
                  return (
                    <tr key={site} className={styles.tableRow}>
                      <td className={styles.tdRank}>
                        {i === 0 ? (
                          <span className={styles.crownBadge}>👑</span>
                        ) : (
                          <span className={styles.rankNum}>{i + 1}</span>
                        )}
                      </td>
                      <td className={styles.tdSite}>
                        <span className={styles.siteName}>{getSiteName(site)}</span>
                        <span className={styles.siteUrl}>{site}</span>
                      </td>
                      <td className={styles.tdScore}>
                        <span
                          className={
                            s > 0
                              ? styles.scorePositive
                              : s < 0
                              ? styles.scoreNegative
                              : styles.scoreNeutral
                          }
                        >
                          {s > 0 ? "+" : ""}{s}
                        </span>
                      </td>
                      <td className={styles.tdVotes}>
                        <div className={styles.voteGroup}>
                          <button
                            className={`${styles.voteBtn} ${styles.upvoteBtn} ${userVote === "up" ? styles.votedUp : ""}`}
                            onClick={() => handleVote(site, "up")}
                            title="Upvote"
                          >
                            ▲
                            <span className={styles.voteCount}>{r.up}</span>
                          </button>
                          <button
                            className={`${styles.voteBtn} ${styles.downvoteBtn} ${userVote === "down" ? styles.votedDown : ""}`}
                            onClick={() => handleVote(site, "down")}
                            title="Downvote"
                          >
                            ▼
                            <span className={styles.voteCount}>{r.down}</span>
                          </button>
                        </div>
                      </td>
                      <td className={styles.tdAction}>
                        <button
                          className={styles.goBtn}
                          onClick={() => {
                            track("manual_redirect", { site });
                            window.location.href = site;
                          }}
                        >
                          Visit →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
