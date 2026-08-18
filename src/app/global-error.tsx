"use client";

import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * The last boundary: this one catches failures in the root layout itself,
 * which means it replaces the document rather than filling a slot in it.
 *
 * Everything here is inline and self-contained. The root layout is what
 * loads the stylesheet and the font, so by the time this renders neither is
 * guaranteed — a Tailwind class here would be a class with no rule behind
 * it. This is the one place in the codebase where inline styles are correct.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Root layout error", error.digest ?? "", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          padding: "1.5rem",
          /*
           * The literal value of `--color-surface`, written out because this
           * is the one component that cannot rely on the stylesheet having
           * loaded. If that token changes, change it here too — there is no
           * mechanism that will do it for you, which is exactly why every
           * other copy of this colour was replaced with the token.
           */
          backgroundColor: "#12161a",
          color: "#ffffff",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "24rem" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.8125rem",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "rgba(255,255,255,0.45)",
            }}
          >
            the beauty of earth.
          </p>
          <h1
            style={{
              margin: "1.5rem 0 0",
              fontSize: "1.5rem",
              fontWeight: 600,
              letterSpacing: "-0.035em",
            }}
          >
            The site failed to load
          </h1>
          <p
            style={{
              margin: "0.75rem 0 0",
              fontSize: "0.875rem",
              lineHeight: 1.6,
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Something went wrong before the page could start. Reloading usually
            clears it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: "2rem",
              minHeight: "2.75rem",
              padding: "0 1.5rem",
              borderRadius: "1rem",
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.08)",
              color: "#ffffff",
              font: "inherit",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
            type="button"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
