import { ImageResponse } from "next/og";

// Next.js will pick this file up as the favicon for static export.
// We render a tiny lion emoji as the icon — distinct from the SE2 default.

export const dynamic = "force-static";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 28,
          background: "#93bbfb",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
        }}
      >
        🦁
      </div>
    ),
    { ...size },
  );
}
