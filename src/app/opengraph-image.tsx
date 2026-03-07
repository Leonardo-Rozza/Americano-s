import { ImageResponse } from "next/og";

export const alt = "Americano's - Gestion de torneos de padel";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "64px 72px",
          background:
            "radial-gradient(circle at 18% 10%, rgba(56,138,255,0.35) 0%, rgba(56,138,255,0) 36%), radial-gradient(circle at 88% 100%, rgba(139,92,246,0.24) 0%, rgba(139,92,246,0) 38%), linear-gradient(180deg, #0A0E1A 0%, #0B1324 100%)",
          color: "#F1F5F9",
          fontFamily: "Barlow, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            maxWidth: 680,
          }}
        >
          <div
            style={{
              display: "flex",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
              background: "rgba(17,24,39,0.65)",
              padding: "8px 14px",
              fontSize: 20,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#94A3B8",
            }}
          >
            Americano&apos;s
          </div>

          <h1
            style={{
              margin: "22px 0 0",
              fontSize: 68,
              lineHeight: 1.04,
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            Torneos de padel
          </h1>

          <p
            style={{
              margin: "20px 0 0",
              fontSize: 30,
              lineHeight: 1.3,
              color: "#B8C7DD",
            }}
          >
            Grupos, ranking, desempates y bracket eliminatorio en una sola app.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            position: "relative",
            width: 320,
            height: 320,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 35% 32%, #F3FFB4 0%, #D4F454 46%, #A9CD1D 100%)",
            border: "8px solid rgba(255,255,255,0.28)",
            boxShadow: "0 30px 70px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 40,
              top: -4,
              bottom: -4,
              width: 122,
              border: "10px solid rgba(248,255,242,0.95)",
              borderRight: "none",
              borderRadius: "50%",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 40,
              top: -4,
              bottom: -4,
              width: 122,
              border: "10px solid rgba(248,255,242,0.95)",
              borderLeft: "none",
              borderRadius: "50%",
            }}
          />
        </div>
      </div>
    ),
    size,
  );
}
