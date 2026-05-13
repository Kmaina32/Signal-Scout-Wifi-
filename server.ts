import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Wi-Fi Diagnostic Endpoint
  app.get("/api/wifi", async (req, res) => {
    const platform = process.platform;
    
    try {
      if (platform === "win32") {
        const { stdout } = await execAsync("netsh wlan show interfaces");
        const signal = stdout.match(/Signal\s*:\s*(\d+)%/)?.[1];
        const ssid = stdout.match(/^\s*SSID\s*:\s*(.+)$/m)?.[1]?.trim();
        const bssid = stdout.match(/BSSID\s*:\s*(.+)$/m)?.[1]?.trim();
        const radio = stdout.match(/Radio type\s*:\s*(.+)$/m)?.[1]?.trim();
        const channel = stdout.match(/Channel\s*:\s*(\d+)/)?.[1];
        const rx = stdout.match(/Receive rate \(Mbps\)\s*:\s*([\d\.]+)/)?.[1];
        const tx = stdout.match(/Transmit rate \(Mbps\)\s*:\s*([\d\.]+)/)?.[1];

        if (!signal) throw new Error("No active Wi-Fi interface detected on Windows.");

        return res.json({
          signal: parseInt(signal),
          ssid: ssid || "Unknown Network",
          bssid: bssid || "00:00:00:00:00:00",
          radio: radio || "802.11",
          channel: parseInt(channel || "0"),
          rx_rate: parseFloat(rx || "0"),
          tx_rate: parseFloat(tx || "0"),
          timestamp: Date.now(),
          isSimulated: false
        });
      } 
      
      if (platform === "darwin") {
        const airportPath = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";
        const { stdout } = await execAsync(`${airportPath} -I`);
        
        const rssi = parseInt(stdout.match(/agrCtlRSSI:\s*(-?\d+)/)?.[1] || "0");
        const noise = parseInt(stdout.match(/agrCtlNoise:\s*(-?\d+)/)?.[1] || "0");
        const ssid = stdout.match(/\sSSID:\s*(.+)$/m)?.[1]?.trim();
        const bssid = stdout.match(/BSSID:\s*(.+)$/m)?.[1]?.trim();
        const channel = stdout.match(/channel:\s*(\d+)/)?.[1];
        
        // Convert RSSI to percentage (approximate)
        const signal = Math.min(100, Math.max(0, 2 * (rssi + 100)));

        return res.json({
          signal,
          ssid: ssid || "MacOS Network",
          bssid: bssid || "00:00:00:00:00:00",
          radio: "Apple 802.11",
          channel: parseInt(channel || "0"),
          rx_rate: 0, // Airport -I doesn't easily give Mbps
          tx_rate: 0,
          timestamp: Date.now(),
          isSimulated: false
        });
      }

      if (platform === "linux") {
        const { stdout } = await execAsync("nmcli -t -f active,ssid,signal,rate,bssid,chan device wifi | grep '^yes'");
        const [active, ssid, signal, rate, bssid, chan] = stdout.split(':');
        
        return res.json({
          signal: parseInt(signal || "0"),
          ssid: ssid || "Linux Network",
          bssid: bssid || "00:00:00:00:00:00",
          radio: "Generic 802.11",
          channel: parseInt(chan || "0"),
          rx_rate: parseFloat(rate || "0"),
          tx_rate: 0,
          timestamp: Date.now(),
          isSimulated: false
        });
      }

      throw new Error(`Platform ${platform} not supported for direct Wi-Fi hardware access.`);

    } catch (e) {
      // Return 200 with error information instead of 503 to prevent proxy HTML interception
      res.status(200).json({ 
        signal: 0,
        ssid: "Hardware Offline",
        bssid: "00:00:00:00:00:00",
        radio: "N/A",
        channel: 0,
        rx_rate: 0,
        tx_rate: 0,
        timestamp: Date.now(),
        isSimulated: true,
        error: "Hardware access failed or unsupported platform.",
        message: "This application requires low-level network access available only when hosted on your local workstation. Deploy to your machine and run 'npm run dev' to see real data.",
        details: e instanceof Error ? e.message : String(e)
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Diagnostic server running on http://localhost:${PORT}`);
  });
}

startServer();
