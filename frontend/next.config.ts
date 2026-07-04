import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

let allowedOrigins = ["localhost", "127.0.0.1"];
try {
  // Read from the root directory
  const configPath = path.join(process.cwd(), "..", "model_config.json");
  if (fs.existsSync(configPath)) {
    const rawData = fs.readFileSync(configPath, 'utf8');
    const configData = JSON.parse(rawData);
    if (configData.allowed_origins && Array.isArray(configData.allowed_origins)) {
      allowedOrigins = configData.allowed_origins.map((origin: string) => {
        try {
          // If the user pasted a full URL (e.g., https://...), extract just the hostname
          if (origin.startsWith('http')) return new URL(origin).hostname;
          // Otherwise, strip any accidental paths or ports
          return origin.split('/')[0].split(':')[0];
        } catch(e) { return origin; }
      });
    }
  }
} catch(err) {
  console.error("Error reading allowed origins:", err);
}

const nextConfig: NextConfig = {
  allowedDevOrigins: allowedOrigins,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:8000/api/:path*'
      }
    ];
  }
};

export default nextConfig;

// HOT_RELOAD_TRIGGER: 11783167707
