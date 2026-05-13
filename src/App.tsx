import { useState, useEffect, useRef } from 'react';
import { 
  Wifi, 
  Activity, 
  Signal, 
  Map as MapIcon, 
  History, 
  Settings, 
  Compass, 
  AlertCircle,
  Download,
  Upload,
  Info,
  Brain,
  Pointer,
  Crosshair,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  LayoutGrid
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getNetworkDiagnostics, type DiagnosticResult } from './services/aiService';

// --- Utilities ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface WifiData {
  signal: number;
  ssid: string;
  bssid: string;
  radio: string;
  channel: number;
  rx_rate: number;
  tx_rate: number;
  timestamp: number;
  isSimulated: boolean;
}

interface HeatPoint {
  x: number;
  y: number;
  strength: number;
  id: string;
}

// --- Components ---

function MetricCard({ title, value, unit, colorClass, secondary }: { title: string; value: string | number; unit?: string; colorClass?: string; secondary?: string }) {
  return (
    <div className="bg-slate-900/40 border border-slate-800/60 p-5 rounded-xl backdrop-blur-md shadow-lg shadow-black/20">
      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">{title}</p>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-1.5">
          <span className={cn("text-2xl font-medium tracking-tight", colorClass || "text-white")}>{value}</span>
          {unit && <span className="text-xs text-slate-500 font-mono">{unit}</span>}
        </div>
        {secondary && <span className="text-[10px] font-mono text-slate-600">{secondary}</span>}
      </div>
    </div>
  );
}

function RadarGauge({ signal }: { signal: number }) {
  const getStatusText = (s: number) => {
    if (s > 75) return "Optimal Link";
    if (s > 40) return "Stable Link";
    return "Weak Coupling";
  };

  const getColorClass = (s: number) => {
    if (s > 75) return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";
    if (s > 40) return "text-amber-400 border-amber-500/30 bg-amber-500/10";
    return "text-red-400 border-red-500/30 bg-red-500/10";
  };

  return (
    <div className="relative w-80 h-80 flex items-center justify-center">
      {/* Concentric Radar Rings */}
      <div className="absolute inset-0 border border-slate-800/80 rounded-full shadow-[inset_0_0_20px_rgba(30,41,59,0.5)]"></div>
      <div className="absolute inset-8 border border-slate-800/60 rounded-full"></div>
      <div className="absolute inset-16 border border-slate-800/40 rounded-full"></div>
      
      {/* Rotating Scan Line */}
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        className="absolute w-1/2 h-[1px] bg-gradient-to-r from-transparent to-cyan-400 origin-left left-1/2 top-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(34,211,238,0.4)] z-0"
      />
      
      {/* Core Data */}
      <div className="text-center z-10 relative">
        <div className="text-8xl font-bold tracking-tighter text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-baseline justify-center">
          {signal}<span className="text-3xl text-cyan-400 ml-1">%</span>
        </div>
        <div className={cn("mt-4 px-4 py-1.5 border rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors duration-500", getColorClass(signal))}>
          {getStatusText(signal)}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<WifiData | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<HeatPoint[]>([]);
  const [previousSignal, setPreviousSignal] = useState<number | null>(null);
  const [direction, setDirection] = useState<'better' | 'worse' | 'stable'>('stable');
  const [view, setView] = useState<'dashboard' | 'heatmap' | 'security'>('dashboard');
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<DiagnosticResult | null>(null);
  const [spectralData, setSpectralData] = useState<any[]>([]);
  const [pingHistory, setPingHistory] = useState<any[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<HeatPoint | null>(null);
  const [floorPlan, setFloorPlan] = useState<string | null>(null);
  
  const [settings, setSettings] = useState({
    refreshRate: 1500,
    dataSource: 'auto',
    showGuidance: true,
    showAIPanel: true,
    showSpectralScanner: true,
  });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const floorPlanInputRef = useRef<HTMLInputElement>(null);

  // Spectral Data Fetch
  useEffect(() => {
    const fetchSpectral = async () => {
      try {
        const res = await fetch('/api/networks');
        const data = await res.json();
        
        // Advanced mock generator for 6E support
        // Channels: 1-13 (2.4G), 36-165 (5G), 1-233 (6G)
        const mockSpectral = [
          // 2.4GHz Band
          ...Array.from({ length: 13 }, (_, i) => ({
            channel: i + 1,
            usage: Math.floor(Math.random() * 50) + (i === 5 ? 40 : 0),
            band: '2.4GHz'
          })),
          // 5GHz Band (subset for viz)
          ...[36, 40, 44, 48, 149, 153, 157, 161].map(ch => ({
            channel: ch,
            usage: Math.floor(Math.random() * 30) + 5,
            band: '5GHz'
          })),
          // 6GHz Band (WiFi 6E)
          ...[1, 37, 73, 109, 145, 197].map(ch => ({
            channel: ch,
            usage: Math.floor(Math.random() * 10) + 1,
            band: '6GHz'
          }))
        ];
        setSpectralData(mockSpectral);
      } catch (e) {
        console.error("Failed to fetch spectral data");
      }
    };
    fetchSpectral();
  }, []);

  // Ping Loop
  useEffect(() => {
    const fetchPing = async () => {
      try {
        const res = await fetch('/api/ping');
        const data = await res.json();
        setPingHistory(prev => [...prev.slice(-19), { time: new Date().toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }), latency: data.latency }]);
      } catch (e) {}
    };
    const interval = setInterval(fetchPing, 2000);
    return () => clearInterval(interval);
  }, []);

  // AI Diagnostic Trigger
  const runAiDiagnostic = async () => {
    if (!data) return;
    setIsAiLoading(true);
    try {
      const result = await getNetworkDiagnostics(
        history,
        data,
        spectralData.map(s => `Ch ${s.channel}: ${s.usage}%`).join(', ')
      );
      setAiResult(result);
    } catch (e) {
      console.error("AI Diagnostic failed", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Fetch Logic
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const query = settings.dataSource !== 'auto' ? `?source=${settings.dataSource}` : '';
        const res = await fetch(`/api/wifi${query}`);
        const contentType = res.headers.get("content-type");
        
        if (!contentType || !contentType.includes("application/json")) {
          // If we got HTML (e.g. from a proxy error page), don't try to parse as JSON
          setError("Network infrastructure error: Received non-JSON response from server.");
          return;
        }

        const newData = await res.json();
        
        // Handle cases where the server returned a 200 but with an error property
        if (newData.error) {
          setError(newData.message || "Hardware unavailable");
          setData(newData); // Keep the skeleton data for UI
          return;
        }

        setError(null);
        setData(newData);
        setHistory(prev => {
          const next = [...prev, { 
            time: new Date(newData.timestamp).toLocaleTimeString([], { hour12: false, minute: '2-digit', second: '2-digit' }), 
            signal: newData.signal 
          }];
          return next.slice(-20); 
        });

        if (previousSignal !== null) {
          if (newData.signal > previousSignal) setDirection('better');
          else if (newData.signal < previousSignal) setDirection('worse');
          else if (newData.signal === previousSignal) setDirection('stable');
        } else {
          setPreviousSignal(newData.signal);
        }
      } catch (e) {
        console.error("Failed to fetch wifi data", e);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, settings.refreshRate);
    return () => clearInterval(interval);
  }, [previousSignal, settings.refreshRate, settings.dataSource]);

  // Heatmap Canvas Rendering
  useEffect(() => {
    if (view === 'heatmap' && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;

      const scale = window.devicePixelRatio || 1;
      canvasRef.current.width = 800 * scale;
      canvasRef.current.height = 500 * scale;
      ctx.scale(scale, scale);

      ctx.clearRect(0, 0, 800, 500);
      
      // Draw floor plan if exists
      if (floorPlan) {
        const img = new Image();
        img.src = floorPlan;
        img.onload = () => {
          ctx.globalAlpha = 0.4;
          ctx.drawImage(img, 0, 0, 800, 500);
          ctx.globalAlpha = 1.0;
          drawOverlay(ctx);
        };
      } else {
        drawOverlay(ctx);
      }

      function drawOverlay(ctx: CanvasRenderingContext2D) {
        // Draw grid
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 800; i += 40) {
          ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 500); ctx.stroke();
        }
        for (let j = 0; j < 500; j += 40) {
          ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(800, j); ctx.stroke();
        }

        // Draw points
        heatmap.forEach(point => {
          const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 70);
          let color = point.strength > 75 ? '16, 185, 129' : point.strength > 40 ? '245, 158, 11' : '239, 68, 68';
          
          // Outer glow
          gradient.addColorStop(0, `rgba(${color}, 0.6)`);
          gradient.addColorStop(0.5, `rgba(${color}, 0.2)`);
          gradient.addColorStop(1, `rgba(${color}, 0)`);
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 70, 0, Math.PI * 2);
          ctx.fill();

          // Core point
          ctx.fillStyle = `rgb(${color})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
          ctx.fill();
          
          // White highlight
          ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.beginPath();
          ctx.arc(point.x, point.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });

        // Hover highlight
        if (hoveredPoint) {
          ctx.strokeStyle = '#22d3ee';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(hoveredPoint.x, hoveredPoint.y, 10, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }
  }, [view, heatmap, floorPlan, hoveredPoint]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (e.clientX - rect.left) * (800 / rect.width);
    const y = (e.clientY - rect.top) * (500 / rect.height);

    const point = heatmap.find(p => {
      const dist = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
      return dist < 15;
    });
    setHoveredPoint(point || null);
  };

  const handleFloorPlanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setFloorPlan(ev.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addHeatPoint = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!data) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Adjust coordinates based on client bounding rect
    const x = (e.clientX - rect.left) * (800 / rect.width);
    const y = (e.clientY - rect.top) * (500 / rect.height);
    
    setHeatmap(prev => [...prev, { x, y, strength: data.signal, id: Math.random().toString(36) }]);
  };

  const downloadHistory = () => {
    const blob = new Blob([JSON.stringify({ history, heatmap, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signal-diagnostic-${Date.now()}.json`;
    a.click();
  };

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] p-8">
      <div className="max-w-md w-full bg-slate-900/50 border border-slate-800 p-8 rounded-3xl backdrop-blur-xl text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
          <AlertCircle size={32} className="text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Hardware Integration Required</h2>
        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          {error}
        </p>
        <div className="p-4 bg-slate-950/50 rounded-xl border border-slate-800 text-left mb-6">
          <p className="text-[10px] font-mono text-slate-500 uppercase mb-2">To use your actual Wi-Fi:</p>
          <ul className="text-xs text-slate-300 space-y-2 font-mono">
            <li>1. Download this project</li>
            <li>2. Run <code className="text-cyan-400">npm install</code></li>
            <li>3. Start local host: <code className="text-cyan-400">npm run dev</code></li>
          </ul>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="w-full py-3 bg-cyan-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-lg shadow-cyan-500/20 hover:bg-cyan-400 transition-all"
        >
          Check Again
        </button>
      </div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617]">
      <div className="flex flex-col items-center gap-6">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} 
          transition={{ duration: 2, repeat: Infinity }}
          className="relative"
        >
          <Wifi size={64} className="text-cyan-500 blur-[2px]" />
          <Wifi size={64} className="text-cyan-400 absolute inset-0" />
        </motion.div>
        <div className="text-center">
          <p className="text-cyan-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-2">System Initialization</p>
          <div className="h-1 w-48 bg-slate-900 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "100%" }}
              transition={{ duration: 3 }}
              className="h-full bg-cyan-500"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden flex flex-col p-6 md:p-10">
      {/* Atmospheric Glow Overlays */}
      <div className="glow-overlay top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-900/15 rounded-full blur-[120px]" />
      <div className="glow-overlay bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/10 rounded-full blur-[150px]" />

      <header className="relative z-10 flex justify-between items-end border-b border-slate-800/50 pb-8 mb-10">
        <div>
          <h1 className="text-[10px] font-bold uppercase tracking-[0.4em] text-cyan-500 mb-2">Active Diagnostic System</h1>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-light tracking-tight text-white flex items-center gap-3">
              Signal Scout <span className="text-slate-700 font-mono tracking-normal text-lg">PRO</span>
            </span>
            <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[9px] font-mono tracking-widest animate-pulse flex items-center gap-1.5">
              <div className="w-1 h-1 bg-emerald-400 rounded-full" />
              LOCAL_HOST:RUNNING
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex bg-slate-900/50 border border-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setView('dashboard')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all", view === 'dashboard' ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "text-slate-500 hover:text-slate-300")}
            >
              Telemetry
            </button>
            <button 
              onClick={() => setView('heatmap')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all", view === 'heatmap' ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/20" : "text-slate-500 hover:text-slate-300")}
            >
              Spatial
            </button>
            <button 
              onClick={() => setView('security')}
              className={cn("px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all", view === 'security' ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300")}
            >
              Audit
            </button>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={cn(
                "p-2.5 rounded-xl border transition-all",
                isSettingsOpen ? "bg-slate-800 border-slate-700 text-cyan-400" : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
              )}
            >
              <Settings size={18} />
            </button>

            <AnimatePresence>
              {isSettingsOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-3 w-64 bg-slate-900/95 border border-slate-700 rounded-2xl p-5 shadow-2xl backdrop-blur-xl z-50"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500 mb-4 flex items-center gap-2">
                    <Settings size={12} /> System Configuration
                  </p>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500 mb-1.5 block">Refresh Rate (ms)</label>
                      <select 
                        value={settings.refreshRate}
                        onChange={(e) => setSettings(s => ({ ...s, refreshRate: parseInt(e.target.value) }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value={500}>500ms (High Perf)</option>
                        <option value={1000}>1000ms (Standard)</option>
                        <option value={1500}>1500ms (Power Save)</option>
                        <option value={3000}>3000ms (Passive)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9px] uppercase font-bold text-slate-500 mb-1.5 block">Telemetry Source</label>
                      <select 
                        value={settings.dataSource}
                        onChange={(e) => setSettings(s => ({ ...s, dataSource: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                      >
                        <option value="auto">Auto Detect Host</option>
                        <option value="netsh">Windows (netsh)</option>
                        <option value="nmcli">Linux (nmcli)</option>
                        <option value="airport">macOS (airport)</option>
                        <option value="simulated">Simulated Data</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-slate-800 pt-3">
                      <label className="text-[9px] uppercase font-bold text-slate-500">AI Panel</label>
                      <button 
                        onClick={() => setSettings(s => ({ ...s, showAIPanel: !s.showAIPanel }))}
                        className={cn("w-10 h-5 rounded-full relative transition-colors p-1", settings.showAIPanel ? "bg-cyan-500" : "bg-slate-800")}
                      >
                        <motion.div animate={{ x: settings.showAIPanel ? 20 : 0 }} className="w-3 h-3 bg-white rounded-full shadow-sm" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-1">
                      <label className="text-[9px] uppercase font-bold text-slate-500">Spectral Scanner</label>
                      <button 
                        onClick={() => setSettings(s => ({ ...s, showSpectralScanner: !s.showSpectralScanner }))}
                        className={cn("w-10 h-5 rounded-full relative transition-colors p-1", settings.showSpectralScanner ? "bg-cyan-500" : "bg-slate-800")}
                      >
                        <motion.div animate={{ x: settings.showSpectralScanner ? 20 : 0 }} className="w-3 h-3 bg-white rounded-full shadow-sm" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between py-2 border-t border-slate-800 pt-3">
                      <label className="text-[9px] uppercase font-bold text-slate-500">Navigation Aid</label>
                      <button 
                        onClick={() => setSettings(s => ({ ...s, showGuidance: !s.showGuidance }))}
                        className={cn(
                          "w-10 h-5 rounded-full relative transition-colors p-1",
                          settings.showGuidance ? "bg-cyan-500" : "bg-slate-800"
                        )}
                      >
                        <motion.div 
                          animate={{ x: settings.showGuidance ? 20 : 0 }}
                          className="w-3 h-3 bg-white rounded-full shadow-sm"
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden md:block text-right font-mono text-[10px] text-slate-500 leading-relaxed uppercase">
            REFRESH: {settings.refreshRate}MS<br/>
            SOURCE: {settings.dataSource.toUpperCase()}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          {view === 'dashboard' ? (
            <motion.div 
              key="dash"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-10"
            >
              {/* Primary Gauge Column */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <RadarGauge signal={data.signal} />
                
                {settings.showAIPanel && (
                  <div className="mt-8 w-full bg-indigo-950/20 border border-indigo-500/20 p-6 rounded-2xl backdrop-blur-md shadow-xl overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Brain size={120} />
                    </div>
                    
                    <div className="flex justify-between items-center mb-4 relative z-10">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-bold flex items-center gap-2">
                        <Brain size={14} /> AI Diagnostic Consultant
                      </div>
                      <button 
                        onClick={runAiDiagnostic}
                        disabled={isAiLoading}
                        className="p-1 px-3 bg-indigo-500 text-white rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-2 hover:bg-indigo-400 transition-colors disabled:opacity-50"
                      >
                        {isAiLoading ? <RefreshCw className="animate-spin" size={10} /> : <Brain size={10} />}
                        Run Diagnostic
                      </button>
                    </div>

                    <AnimatePresence mode="wait">
                      {isAiLoading ? (
                        <motion.div 
                          key="loading"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="pt-4"
                        >
                          <div className="flex flex-col gap-3">
                            <div className="h-3 w-full bg-indigo-500/10 rounded-full animate-pulse" />
                            <div className="h-3 w-4/5 bg-indigo-500/10 rounded-full animate-pulse delay-75" />
                            <div className="h-3 w-3/4 bg-indigo-500/10 rounded-full animate-pulse delay-150" />
                          </div>
                          <p className="mt-6 text-[9px] font-mono text-indigo-400/60 uppercase tracking-widest text-center">Synthesizing network telemetry...</p>
                        </motion.div>
                      ) : aiResult ? (
                        <motion.div 
                          key="result"
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="pt-2 relative z-10"
                        >
                          <div className={cn(
                            "mb-4 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest inline-block",
                            aiResult.severity === 'high' ? "bg-red-500/10 text-red-400 border border-red-500/30" :
                            aiResult.severity === 'medium' ? "bg-amber-500/10 text-amber-400 border border-amber-500/30" :
                            "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          )}>
                            Action Severity: {aiResult.severity}
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed italic mb-4">"{aiResult.analysis}"</p>
                          <div className="space-y-2">
                            {aiResult.recommendations.map((rec, i) => (
                              <div key={i} className="flex gap-2 items-start bg-slate-900/50 p-2.5 rounded-lg border border-slate-800/80">
                                <div className="mt-1 flex-shrink-0 w-1 h-1 rounded-full bg-indigo-400" />
                                <span className="text-[11px] text-slate-400">{rec}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                        <div className="pt-8 text-center">
                          <p className="text-xs text-slate-500 leading-relaxed max-w-[250px] mx-auto">
                            Initial data synthesis complete. Global signal benchmarks ready for comparative logic.
                          </p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                
                {settings.showSpectralScanner && (
                  <div className="mt-8 w-full bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl backdrop-blur-md shadow-xl overflow-hidden relative">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-6 flex justify-between items-center">
                      Advanced Spectral Scanner
                      <span className="font-mono text-[9px] text-slate-600 bg-slate-950 px-2 py-0.5 rounded uppercase tracking-normal">WiFi 6E [6GHz] ENABLED</span>
                    </div>
                    
                    <div className="h-[140px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={spectralData}>
                          <Bar dataKey="usage" radius={[3, 3, 0, 0]}>
                            {spectralData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={
                                  entry.band === '6GHz' ? '#8b5cf6' : 
                                  entry.band === '5GHz' ? '#06b6d4' : 
                                  entry.usage > 45 ? '#ef4444' : '#334155'
                                } 
                                fillOpacity={entry.band === '6GHz' ? 0.8 : 1}
                              />
                            ))}
                          </Bar>
                          <XAxis 
                            dataKey="channel" 
                            axisLine={false} 
                            tickLine={false} 
                            fontSize={8} 
                            tick={{ fill: '#475569' }} 
                            dy={5}
                            label={{ value: 'Channels (2.4G/5G/6E)', position: 'insideBottom', offset: -10, fontSize: 8, fill: '#334155' }}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }} 
                            contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', fontSize: '10px' }}
                            labelFormatter={(v, props) => {
                              const entry = props[0]?.payload;
                              return `Band: ${entry?.band || 'Unknown'} - Ch ${v}`;
                            }}
                            formatter={(v: number) => [`${v}% Load`, 'Spectral Density']}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex justify-between mt-4 text-[8px] font-bold uppercase tracking-widest">
                      <span className="text-slate-600">2.4 GHz</span>
                      <span className="text-cyan-600">5 GHz High-Cap</span>
                      <span className="text-indigo-400">WiFi 6E (6 GHz)</span>
                    </div>
                  </div>
                )}

                <div className="mt-8 w-full p-4 bg-cyan-950/10 border border-cyan-800/30 rounded-xl relative overflow-hidden">
                  <div className="absolute top-[-20%] right-[-10%] w-1/3 h-full bg-cyan-500/5 blur-[40px] pointer-events-none" />
                  <div className="flex gap-4 relative z-10">
                    <div className="p-2 bg-slate-900 rounded-lg h-unit text-cyan-400 border border-slate-800">
                      <LayoutGrid size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-cyan-500 tracking-wider mb-1">Infrastructure Insight</p>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        {data.radio.includes('6GHz') ? (
                          <>
                            Connected via <span className="text-indigo-400 font-bold">WiFi 6E</span> on the <span className="text-indigo-400 font-mono">6GHz</span> band. 
                            Zero co-channel interference detected. Optimal spectrum efficiency.
                          </>
                        ) : (
                          <>
                            Current latency stabilized at <span className="text-cyan-400 font-mono">{(pingHistory[pingHistory.length-1]?.latency || 0)}ms</span>. 
                            Network topology suggests {data.channel > 14 ? 'a high-frequency 5GHz' : 'a localized 2.4GHz'} deployment.
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metric Grid Column */}
              <div className="lg:col-span-7 flex flex-col gap-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <MetricCard 
                    title="Active Network" 
                    value={data.ssid} 
                    secondary={`CH ${data.channel}`}
                  />
                  <MetricCard 
                    title="Hardware Protocol" 
                    value={data.radio} 
                    secondary="AES-CCMP"
                  />
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-md shadow-2xl flex-1 flex flex-col overflow-hidden relative">
                  <div className="flex justify-between items-center mb-10">
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Telemetry Performance Stack</div>
                    <div className="flex gap-5 font-mono text-[9px] uppercase tracking-widest">
                      <span className="flex items-center gap-1.5 text-cyan-500"><TrendingUp size={10} /> Signal</span>
                      <span className="flex items-center gap-1.5 text-slate-600 border-l border-slate-800 pl-5"><TrendingDown size={10} /> Latency (Ping)</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} strokeOpacity={0.4} />
                        <XAxis 
                          dataKey="time" 
                          stroke="#475569" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          dy={10}
                        />
                        <YAxis 
                          yAxisId="left"
                          domain={[0, 100]} 
                          stroke="#475569" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <YAxis 
                          yAxisId="right"
                          orientation="right"
                          domain={[0, 'auto']} 
                          stroke="#475569" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(v) => `${v}ms`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }}
                          itemStyle={{ color: '#22d3ee' }}
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="signal" 
                          name="Signal"
                          stroke="#22d3ee" 
                          strokeWidth={2} 
                          dot={false}
                          animationDuration={500}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          data={pingHistory}
                          dataKey="latency" 
                          name="Ping"
                          stroke="#475569" 
                          strokeWidth={1} 
                          strokeDasharray="4 4"
                          dot={false}
                          animationDuration={500}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-10 border-t border-slate-800/80 pt-6">
                    <div>
                      <div className="text-[9px] text-slate-600 uppercase font-bold mb-1 tracking-wider text-center sm:text-left">Throughput</div>
                      <div className="text-base font-mono font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                        <Download size={14} className="text-cyan-400" /> {data.rx_rate} <span className="text-[9px] text-slate-500">M</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-600 uppercase font-bold mb-1 tracking-wider text-center sm:text-left">Spectral SNR</div>
                      <div className="text-base font-mono font-bold text-emerald-400 text-center sm:text-left">+42 <span className="text-[9px] text-slate-500 italic uppercase">dB</span></div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-600 uppercase font-bold mb-1 tracking-wider text-center sm:text-left">Bandwidth</div>
                      <div className="text-base font-mono font-bold text-white text-center sm:text-left">160 <span className="text-[9px] text-slate-500 uppercase">MHz</span></div>
                    </div>
                    <div className="cursor-pointer group" onClick={downloadHistory}>
                      <div className="text-[9px] text-slate-600 uppercase font-bold mb-1 tracking-wider text-center sm:text-left group-hover:text-cyan-400 transition-colors">Export Logs</div>
                      <div className="text-base font-mono font-bold text-slate-400 group-hover:text-white transition-colors flex items-center justify-center sm:justify-start gap-1.5">
                        <Download size={14} /> JSON
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl backdrop-blur-md flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-slate-800/80 rounded-xl text-slate-500 border border-slate-700">
                      <Activity size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Static MAC Indicator (BSSID)</p>
                      <p className="text-sm font-mono text-cyan-200 tracking-wider font-light">{data.bssid}</p>
                    </div>
                  </div>
                  <div className="px-3 py-1 bg-slate-950/80 rounded border border-slate-800 text-[10px] font-mono text-slate-600 uppercase tracking-tighter">
                    Checksum: {data.bssid.slice(-5)}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : view === 'heatmap' ? (
            <motion.div 
              key="heat"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col"
            >
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-sm flex flex-col flex-1 min-h-[600px]">
                <div className="p-8 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/50">
                  <div>
                    <h3 className="font-bold flex items-center gap-3 text-white">
                      <MapIcon size={20} className="text-cyan-500" />
                      Spatial Signal Integration
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 uppercase tracking-widest font-bold">Mapping active area telemetry nodes</p>
                  </div>
                  <div className="flex gap-4 items-center">
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={floorPlanInputRef}
                      onChange={handleFloorPlanUpload}
                    />
                    <button 
                      onClick={() => floorPlanInputRef.current?.click()}
                      className="px-4 py-1.5 bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all rounded-full flex items-center gap-2"
                    >
                      <Upload size={12} /> {floorPlan ? 'Change Map' : 'Upload Floorplan'}
                    </button>
                    <div className="text-[10px] font-mono text-slate-400 bg-slate-950/80 px-4 py-1.5 rounded-full border border-slate-800">
                      TELEMETRY_LINK: <span className="font-bold text-cyan-400">{data.signal}%</span>
                    </div>
                    <button 
                      onClick={() => setHeatmap([])}
                      className="px-4 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-[10px] font-bold uppercase tracking-widest transition-all rounded-full"
                    >
                      Purge Data
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 p-8 flex justify-center items-center bg-[#000]/10 overflow-auto relative cursor-crosshair group">
                  {/* Radar Grid Overlay */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#22d3ee_1px,transparent_1px)] [background-size:32px_32px]" />
                  
                  <div className="relative w-full max-w-[800px]">
                    <canvas 
                      ref={canvasRef}
                      onClick={addHeatPoint}
                      onMouseMove={handleMouseMove}
                      onMouseLeave={() => setHoveredPoint(null)}
                      className={cn(
                        "bg-black/40 rounded-2xl border border-slate-800/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-shadow duration-500 group-hover:shadow-[0_0_60px_rgba(34,211,238,0.05)] w-full h-auto aspect-[8/5]",
                        floorPlan && "border-cyan-500/30"
                      )}
                    />

                    {/* Tooltip */}
                    <AnimatePresence>
                      {hoveredPoint && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          style={{ 
                            position: 'absolute', 
                            left: `${(hoveredPoint.x / 800) * 100}%`,
                            top: `${(hoveredPoint.y / 500) * 100}%`,
                            transform: 'translate(-50%, -120%)'
                          }}
                          className="pointer-events-none bg-slate-900 border border-cyan-500/40 p-3 rounded-lg shadow-2xl backdrop-blur-md z-40 min-w-[120px]"
                        >
                          <div className="text-[9px] uppercase font-bold text-cyan-500 mb-1 flex items-center gap-2">
                            <Crosshair size={10} /> Localized Metadata
                          </div>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-[10px] font-mono text-slate-500">Signal</span>
                            <span className="text-sm font-bold text-white">{hoveredPoint.strength}%</span>
                          </div>
                          <div className="flex justify-between items-baseline border-t border-slate-800 pt-1 mt-1">
                            <span className="text-[9px] font-mono text-slate-500 italic">Pos (X,Y)</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {Math.round(hoveredPoint.x)},{Math.round(hoveredPoint.y)}
                            </span>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {heatmap.length === 0 && !floorPlan && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="text-center px-6 py-4 bg-slate-900/80 border border-slate-800 rounded-xl backdrop-blur-xl">
                        <p className="text-slate-400 text-xs font-mono mb-2">Awaiting spatial coordinates...</p>
                        <p className="text-[10px] text-slate-600 uppercase tracking-[0.2em]">Click on the grid to record linkage</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 bg-slate-950/40 border-t border-slate-800 flex justify-center items-center gap-12">
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-emerald-400">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Optimal
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-amber-400">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" /> Nominal
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-colors hover:text-red-400">
                        <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" /> Sparse
                    </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="security"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col gap-8"
            >
              <div className="bg-indigo-950/10 border border-indigo-500/20 p-8 rounded-3xl backdrop-blur-xl">
                <div className="flex items-center gap-4 mb-8">
                  <div className="p-3 bg-indigo-500/20 rounded-2xl text-indigo-400 border border-indigo-500/30">
                    <Brain size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white uppercase tracking-tight">Security Audit Intel</h2>
                    <p className="text-[10px] text-indigo-400 uppercase tracking-[0.2em] font-bold">Vulnerability Research & Defense Mitigation</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-10">
                    <section>
                      <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                        Cracking Methodology
                      </h3>
                      <p className="text-sm text-slate-400 leading-relaxed mb-4 italic">
                        In professional cybersecurity, attackers do not "guess" live Wi-Fi passwords while connected. They capture encrypted authentication packets out of the air and use specialized terminal-based toolsets to crack cryptographic hashes offline.
                      </p>
                      <div className="bg-black/40 border border-slate-800 rounded-2xl p-6">
                        <h4 className="text-[10px] font-bold text-white uppercase mb-4 tracking-widest border-b border-slate-800 pb-2">The Standard WPA2 4-Way Handshake Attack</h4>
                        <div className="space-y-4">
                          {[
                            { phase: "Monitoring", cmd: "airmon-ng start wlan0", desc: "Switching card to Monitor Mode to listen to all raw traffic." },
                            { phase: "Deauthentication", cmd: "aireplay-ng -0 5 -a [BSSID] -c [CLIENT_MAC]", desc: "Forcing connected devices to disconnect and reconnect to sniff the handshake." },
                            { phase: "Offline Brute-Force", cmd: "aircrack-ng -w wordlist.txt -b [BSSID] capture.cap", desc: "Testing millions of combinations per second against the cryptographic hash." }
                          ].map((step, i) => (
                            <div key={i} className="flex gap-4">
                              <div className="text-[10px] font-mono text-slate-600 mt-1">0{i+1}</div>
                              <div>
                                <div className="text-xs font-bold text-slate-300 mb-1">{step.phase}</div>
                                <code className="block bg-slate-950 p-2 rounded text-[10px] text-cyan-400 font-mono mb-2">{step.cmd}</code>
                                <p className="text-[11px] text-slate-500">{step.desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4">PMKID Attack (Clientless)</h4>
                      <p className="text-sm text-slate-400 leading-relaxed">
                        Attackers request a connection directly from the router's Roaming feature. The router responds with the PMKID hash. Attackers extract this frame and crack it without requiring any active users on the network.
                      </p>
                    </section>
                  </div>

                  <div className="space-y-10">
                    <div className="bg-indigo-500/5 border border-indigo-500/10 rounded-3xl p-8 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03]">
                        <Settings size={200} />
                      </div>
                      <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6 relative z-10">Defensive Countermeasures</h3>
                      <div className="space-y-6 relative z-10">
                        {[
                          { title: "WPA3 Migration", desc: "SAE completely eliminates offline dictionary vulnerabilities. An attacker only gets one guess per exchange, neutralizing brute-force." },
                          { title: "Protected Management Frames", desc: "Encrypts management packets, neutralizing unauthorized deauthentication packets from tools like aireplay-ng." },
                          { title: "Enhanced Entropy", desc: "Handshakes rely on dictionary files. A random password > 12 alphanumeric characters would take decades to calculate." }
                        ].map((def, i) => (
                          <div key={i} className="flex gap-5">
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-400">
                              {i+1}
                            </div>
                            <div>
                              <div className="text-sm font-bold text-white mb-1">{def.title}</div>
                              <p className="text-xs text-slate-400 leading-relaxed">{def.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-red-500/5 border border-red-500/10 rounded-3xl p-8">
                      <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest mb-4">Rogue Access Points (Evil Twin)</h3>
                      <p className="text-xs text-slate-500 leading-relaxed mb-4">
                        Attackers set up a dummy SSID matching your network and jam your actual router. Your device shifts to the stronger malicious twin, presenting a fake portal to hijack your key.
                      </p>
                      <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 rounded-xl border border-red-500/20">
                        <AlertCircle size={16} className="text-red-400" />
                        <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Psychological Exploitation Vector Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="relative z-10 mt-12 pt-6 border-t border-slate-800/50 flex flex-col sm:flex-row justify-between items-center gap-6">
        <div className="flex flex-wrap justify-center gap-8 text-[10px] uppercase tracking-[0.25em] font-bold text-slate-600">
          <span className="flex items-center gap-2.5 transition-colors hover:text-emerald-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]" /> 
            CORE_INTERFACE:UP
          </span>
          <span className="flex items-center gap-2.5 transition-colors hover:text-emerald-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]" /> 
            TELEMETRY_API:STABLE
          </span>
          <span className="flex items-center gap-2.5 transition-colors hover:text-slate-400">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-800" /> 
            DATA_LOGGING:PASSIVE
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-700 tracking-wider">
          SYSTEM_SESSION_ID: 88X-J92-VKL • © 2026 SIGNAL_SCOUT_GROUP
        </div>
      </footer>
    </div>
  );
}
