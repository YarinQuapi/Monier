import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/shortcuts/:path*",
        headers: [
          { key: "Content-Type", value: "application/octet-stream" },
          {
            key: "Content-Disposition",
            value: 'attachment; filename="Log Purchase.shortcut"',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
