import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { exec } from "child_process";
import { promisify } from "util";
import FastSpeedtest from "fast-speedtest-api";

const execAsync = promisify(exec);

// Global state for speed metrics
let speedMetrics = {
  internet_dl: 0,
  last_wan_update: "Never",
  is_testing: false
};

// Background internet speed test
async function runInternetSpeedTest() {
  if (speedMetrics.is_testing) return;
  speedMetrics.is_testing = true;
  
  try {
    const speedtest = new FastSpeedtest({
      token: "YXdnZW5lcmF0ZW9mZmljaWFsbWFya2V0aW5nc2l0ZTo=", // Default public token
      verbose: false,
      timeout: 10000,
      https: true,
      urlCount: 5,
      bufferSize: 8,
      unit: FastSpeedtest.UNITS.Mbps
    });

    const speed = await speedtest.getSpeed();
    speedMetrics.internet_dl = Math.round(speed * 10) / 10;
    speedMetrics.last_wan_update = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
  } catch (e) {
    console.error("Internet speed test failed:", e);
    speedMetrics.last_wan_update = "Error";
  } finally {
    speedMetrics.is_testing = false;
  }
}

// Start periodic internet speed tests
setInterval(runInternetSpeedTest, 60000); // Once a minute to save data
runInternetSpeedTest();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Wi-Fi Diagnostic Endpoint
  app.get("/api/wifi", async (req, res) => {
    const { source } = req.query;
    const platform = process.platform;
    
    try {
      // Force simulated data if requested
      if (source === "simulated") {
        throw new Error("Simulated mode requested.");
      }

      // Windows - netsh
      if ((platform === "win32" && (!source || source === "netsh")) || source === "netsh") {
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
          internet_dl: speedMetrics.internet_dl,
          last_wan_update: speedMetrics.last_wan_update,
          timestamp: Date.now(),
          isSimulated: false
        });
      } 
      
      // macOS - airport
      if ((platform === "darwin" && (!source || source === "airport")) || source === "airport") {
        const airportPath = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";
        const { stdout } = await execAsync(`${airportPath} -I`);
        
        const rssi = parseInt(stdout.match(/agrCtlRSSI:\s*(-?\d+)/)?.[1] || "0");
        const ssid = stdout.match(/\sSSID:\s*(.+)$/m)?.[1]?.trim();
        const bssid = stdout.match(/BSSID:\s*(.+)$/m)?.[1]?.trim();
        const channel = stdout.match(/channel:\s*(\d+)/)?.[1];
        const rate = stdout.match(/lastTxRate:\s*(\d+)/)?.[1] || "0";
        
        const signal = Math.min(100, Math.max(0, 2 * (rssi + 100)));

        return res.json({
          signal,
          ssid: ssid || "MacOS Network",
          bssid: bssid || "00:00:00:00:00:00",
          radio: "Apple 802.11",
          channel: parseInt(channel || "0"),
          rx_rate: parseFloat(rate),
          tx_rate: parseFloat(rate),
          internet_dl: speedMetrics.internet_dl,
          last_wan_update: speedMetrics.last_wan_update,
          timestamp: Date.now(),
          isSimulated: false
        });
      }

      // Linux - nmcli
      if ((platform === "linux" && (!source || source === "nmcli")) || source === "nmcli") {
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
          internet_dl: speedMetrics.internet_dl,
          last_wan_update: speedMetrics.last_wan_update,
          timestamp: Date.now(),
          isSimulated: false
        });
      }

      throw new Error(`Platform ${platform} or source ${source} not supported for direct hardware access.`);

    } catch (e) {
      // Simulate data if hardware fails or simulated is requested
      const simulatedSignal = Math.floor(Math.random() * 40) + 40; // 40-80%
      const supports6E = Math.random() > 0.5;
      res.status(200).json({ 
        signal: simulatedSignal,
        ssid: source === "simulated" ? "Simulated Network" : "Hardware Offline",
        bssid: "DE:AD:BE:EF:00:01",
        radio: supports6E ? "802.11ax (6GHz)" : "Simulated 802.11ax",
        channel: supports6E ? (Math.random() > 0.5 ? 37 : 197) : 6,
        rx_rate: 120.5,
        tx_rate: 98.2,
        internet_dl: speedMetrics.internet_dl || 42.5,
        last_wan_update: speedMetrics.last_wan_update === "Never" ? "Simulated" : speedMetrics.last_wan_update,
        timestamp: Date.now(),
        isSimulated: true,
        error: source === "simulated" ? null : "Hardware access failed or unsupported.",
        message: source === "simulated" 
            ? "Running in simulated mode for demonstration." 
            : "Hardware access failed. Returning simulated data for UI testing.",
        details: e instanceof Error ? e.message : String(e)
      });
    }
  });

  // Diagnostic: Spectral Congestion Scan
  app.get("/api/networks", async (req, res) => {
    const platform = process.platform;
    try {
      if (platform === "win32") {
        const { stdout } = await execAsync("netsh wlan show networks mode=bssid");
        res.json({ raw: stdout, platform });
      } else if (platform === "darwin") {
        const airportPath = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";
        const { stdout } = await execAsync(`${airportPath} -s`);
        res.json({ raw: stdout, platform });
      } else if (platform === "linux") {
        const { stdout } = await execAsync("nmcli -f SSID,CHAN,SIGNAL,BARS,SECURITY device wifi list");
        res.json({ raw: stdout, platform });
      } else {
        throw new Error("Unsupported platform");
      }
    } catch (e) {
      res.json({ 
        raw: "Simulated spectral data: Channel 1 (2.4GHz) - 80% load, Channel 6 (2.4GHz) - 20% load, Channel 36 (5GHz) - 5% load, Channel 37 (6GHz) - 2% load, Channel 197 (6GHz) - 1% load", 
        platform: "simulated" 
      });
    }
  });

  // Diagnostic: Ping & Jitter
  app.get("/api/ping", async (req, res) => {
    const target = req.query.target || "8.8.8.8";
    try {
      // Basic ping - 1 packet for quick response
      const countFlag = process.platform === "win32" ? "-n 1" : "-c 1";
      const { stdout } = await execAsync(`ping ${countFlag} ${target}`);
      
      let latency = 0;
      if (process.platform === "win32") {
        latency = parseInt(stdout.match(/time[=<](\d+)ms/)?.[1] || "0");
      } else {
        latency = parseFloat(stdout.match(/time=(\d+\.?\d*)\s*ms/)?.[1] || "0");
      }

      res.json({ latency, target, timestamp: Date.now() });
    } catch (e) {
      res.json({ latency: Math.floor(Math.random() * 20) + 15, target, simulated: true });
    }
  });

  // Catch-all for missing API routes to return JSON instead of HTML
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: "API Route Not Found", path: req.url });
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
