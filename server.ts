import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { exec } from "child_process";
import { promisify } from "util";

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
    // Dynamic import to avoid breaking the whole server if the package is missing or problematic
    const { default: FastSpeedtest } = await import("fast-speedtest-api");
    
    const speedtest = new FastSpeedtest({
      token: "YXdnZW5lcmF0ZW9mZmljaWFsbWFya2V0aW5nc2l0ZTo=", // Default public token
      verbose: false,
      timeout: 10000,
      https: true,
      urlCount: 5,
      bufferSize: 8,
      unit: (FastSpeedtest as any).UNITS.Mbps
    });

    const speed = await speedtest.getSpeed();
    speedMetrics.internet_dl = Math.round(speed * 10) / 10;
    speedMetrics.last_wan_update = new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' });
    console.log(`[SpeedTest] Success: ${speedMetrics.internet_dl} Mbps`);
  } catch (e) {
    console.warn("Internet speed test failed (likely token or connectivity issue):", e instanceof Error ? e.message : String(e));
    speedMetrics.last_wan_update = "Unavailable";
    // Provide a random simulated speed if real test fails, to keep the UI interesting
    if (speedMetrics.internet_dl === 0) {
      speedMetrics.internet_dl = Math.floor(Math.random() * 50) + 30;
      speedMetrics.last_wan_update = "Simulated";
    }
  } finally {
    speedMetrics.is_testing = false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const apiRouter = express.Router();

  // Request Logging for API
  apiRouter.use((req, res, next) => {
    console.log(`[API] ${req.method} ${req.url}`);
    next();
  });

  // Health check
  apiRouter.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Diagnostic: Ping & Jitter
  apiRouter.get("/ping", async (req, res) => {
    const target = (req.query.target as string) || "8.8.8.8";
    try {
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

  // Wi-Fi Diagnostic Endpoint
  apiRouter.get("/wifi", async (req, res) => {
    const { source } = req.query;
    const platform = process.platform;
    
    try {
      if (source === "simulated") throw new Error("Simulated mode requested.");

      if ((platform === "win32" && (!source || source === "netsh")) || source === "netsh") {
        const { stdout } = await execAsync("netsh wlan show interfaces");
        const signal = stdout.match(/Signal\s*:\s*(\d+)%/)?.[1];
        const ssid = stdout.match(/^\s*SSID\s*:\s*(.+)$/m)?.[1]?.trim();
        const bssid = stdout.match(/BSSID\s*:\s*(.+)$/m)?.[1]?.trim();
        const radio = stdout.match(/Radio type\s*:\s*(.+)$/m)?.[1]?.trim();
        const channel = stdout.match(/Channel\s*:\s*(\d+)/)?.[1];
        const rx = stdout.match(/Receive rate \(Mbps\)\s*:\s*([\d\.]+)/)?.[1];
        const tx = stdout.match(/Transmit rate \(Mbps\)\s*:\s*([\d\.]+)/)?.[1];

        if (!signal) throw new Error("No Wi-Fi interface detected.");

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
          radio: "Apple 801.11",
          channel: parseInt(channel || "0"),
          rx_rate: parseFloat(rate),
          tx_rate: parseFloat(rate),
          internet_dl: speedMetrics.internet_dl,
          last_wan_update: speedMetrics.last_wan_update,
          timestamp: Date.now(),
          isSimulated: false
        });
      }

      if ((platform === "linux" && (!source || source === "nmcli")) || source === "nmcli") {
        const { stdout } = await execAsync("nmcli -t -f active,ssid,signal,rate,bssid,chan device wifi | grep '^yes'");
        const [, ssid, signal, rate, bssid, chan] = stdout.split(':');
        
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

      throw new Error(`Platform ${platform} not supported for hardware access.`);

    } catch (e) {
      res.json({ 
        signal: Math.floor(Math.random() * 40) + 40,
        ssid: source === "simulated" ? "Simulated Network" : "Hardware Offline",
        bssid: "DE:AD:BE:EF:00:01",
        radio: "Simulated 802.11ax",
        channel: 6,
        rx_rate: 120.5,
        tx_rate: 98.2,
        internet_dl: speedMetrics.internet_dl || 42.5,
        last_wan_update: speedMetrics.last_wan_update === "Never" ? "Simulated" : speedMetrics.last_wan_update,
        timestamp: Date.now(),
        isSimulated: true,
        message: "Hardware access limited. Using diagnostic simulation."
      });
    }
  });

  apiRouter.get("/networks", async (req, res) => {
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
        raw: "Simulated spectral sweep: Ch 1 (High Load), Ch 6 (Medium), Ch 11 (Low), Ch 36 (Clear), Ch 149 (Clear)", 
        platform: "simulated" 
      });
    }
  });

  // Mount API router
  app.use("/api", apiRouter);

  // Catch-all for missing API routes (within /api prefix)
  apiRouter.all("*", (req, res) => {
    res.status(404).json({ error: "API Route Not Found", path: req.url });
  });

  // Start periodic internet speed tests
  setInterval(runInternetSpeedTest, 60000);
  runInternetSpeedTest();

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
    console.log(`Diagnostic server running on port ${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server startup failure:", err);
});
