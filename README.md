# 📡 Signal Scout Pro

**Signal Scout Pro** is a professional-grade Wi-Fi diagnostic and spatial mapping suite. It provides real-time telemetry from your local network hardware, allowing you to visualize signal strength, track history, and map out dead zones in your environment.

> [!IMPORTANT]
> **Hardware Access Notice:** This application requires low-level system access to Wi-Fi interfaces. While it includes a simulated data fallback, actual real-time telemetry is only available when running the application locally on a workstation (Windows, macOS, or Linux).

---

## ✨ Features

- 🛰️ **Real-time Radar Gauges:** Instant visual feedback on signal quality and link stability.
- 📉 **Telemetry History:** Interactive line charts powered by Recharts to track signal fluctuations over time.
- 🗺️ **Spatial Heatmapping:** Canvas-based interactive mapping tool to place signal samples and visualize coverage.
- 💻 **Cross-Platform Support:** Native hooks for `netsh` (Windows), `airport` (macOS), and `nmcli` (Linux).
- 🎨 **Modern Interface:** Built with Tailwind CSS 4.0, Framer Motion animations, and a high-contrast dark mode aesthetic.

---

## 📖 How to Use

### 1. Dashboard View
Monitor real-time statistics including signal percentage, RX/TX rates, and channel info. The **Radar Gauge** provides a quick heuristic for link stability.

### 2. Spatial Mapping (Heatmap)
Switch to the **Heatmap** view to map your physical space:
- Move your laptop to a specific location.
- Wait for the telemetry to stabilize.
- **Click anywhere on the grid** to drop a data point.
- The intensity of the colored glow represents the signal strength at that specific coordinate.

### 3. Data Export
Click the **Export** button to download a complete session log in `.json` format. This contains both the historical telemetry stream and the coordinates/strength of all heatmap points.

---

## 🛠️ Tech Stack

- **Frontend:** React 19, Vite 6, Tailwind CSS 4
- **Backend:** Node.js, Express 4, TSX
- **Data Viz:** Recharts, HTML5 Canvas
- **Animations:** Framer Motion (motion/react)
- **Icons:** Lucide React
- **Language:** TypeScript (Strict mode)

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd signal-scout-pro
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root (see `.env.example` for reference):
   ```env
   GEMINI_API_KEY="your_api_key_here"
   APP_URL="http://localhost:3000"
   ```

### Running Locally

To benefit from real Wi-Fi hardware telemetry, you must run the server in development mode on your host machine:

```bash
# Start the diagnostic server and frontend
npm run dev
```

The application will be available at `http://localhost:3000`.

---

## 📂 Project Structure

```text
├── server.ts            # Express server & hardware telemetry API
├── src/
│   ├── App.tsx          # Main dashboard & heatmap logic
│   ├── main.tsx         # Entry point
│   ├── index.css        # Tailwind 4.0 imports & theme settings
│   └── components/      # UI components
├── public/              # Static assets
└── vite.config.ts       # Vite & Tailwind configuration
```

---

## ⚙️ Configuration

| Variable | Description |
| :--- | :--- |
| `GEMINI_API_KEY` | Optional API key for future AI-powered diagnostic insights. |
| `APP_URL` | The base URL for the application (used for API routing). |

---

## 🛡️ License

Built with ❤️ for network professionals. This project is for diagnostic use and should be run with appropriate permissions on your local system.
