"use client";

// The last resort, for when even the page frame (the nav, the layout)
// couldn't be drawn. It replaces the whole document, so none of the app's
// styles are here: everything it needs is inline.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  console.error(error);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          color: "#fff",
          background: "linear-gradient(180deg, #6d28d9 0%, #9333ea 45%, #c026d3 75%, #db2777 100%)",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <title>packmates</title>
        <div style={{ maxWidth: 340 }}>
          <h1 style={{ fontSize: 26, margin: "0 0 24px" }}>That didn&apos;t load</h1>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              width: "100%",
              height: 56,
              border: 0,
              borderRadius: 999,
              background: "#000",
              color: "#fff",
              fontSize: 17,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <p style={{ marginTop: 16 }}>
            <a href="/" style={{ color: "#fff" }}>
              Back to the map
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
