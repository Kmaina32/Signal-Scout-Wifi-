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
  Info
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
  const [view, setView] = useState<'dashboard' | 'heatmap'>('dashboard');
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch Logic
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/wifi');
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
    const interval = setInterval(fetchStats, 1500);
    return () => clearInterval(interval);
  }, [previousSignal]);

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
        const gradient = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, 60);
        let color = point.strength > 75 ? '16, 185, 129' : point.strength > 40 ? '245, 158, 11' : '239, 68, 68';
        gradient.addColorStop(0, `rgba(${color}, 0.5)`);
        gradient.addColorStop(1, `rgba(${color}, 0)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 60, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgb(${color})`;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '10px JetBrains Mono';
        ctx.fillText(`${point.strength}%`, point.x + 8, point.y + 4);
      });
    }
  }, [view, heatmap]);

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
          </div>
          <div className="hidden md:block text-right font-mono text-[10px] text-slate-500 leading-relaxed uppercase">
            REFRESH RATE: 1500MS<br/>
            SOURCE: NETSH_INTERFACE
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
                
                <div className="mt-12 w-full bg-slate-900/40 border border-slate-800/60 p-6 rounded-2xl backdrop-blur-md shadow-xl">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold mb-4">Navigation Guidance</div>
                  <div className="flex items-center gap-5">
                    <motion.div 
                      key={direction}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        "w-14 h-14 rounded-full border-2 flex items-center justify-center shadow-lg",
                        direction === 'better' ? "border-emerald-500 shadow-emerald-500/20" : 
                        direction === 'worse' ? "border-red-500 shadow-red-500/20" : 
                        "border-slate-700 shadow-black/20"
                      )}
                    >
                      <motion.div
                        animate={direction === 'better' ? { y: [2, -2, 2] } : direction === 'worse' ? { y: [-2, 2, -2] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        {direction === 'better' ? (
                          <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[14px] border-b-emerald-500" />
                        ) : direction === 'worse' ? (
                          <div className="w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[14px] border-t-red-500" />
                        ) : (
                          <Wifi size={24} className="text-slate-500" />
                        )}
                      </motion.div>
                    </motion.div>
                    <div>
                      <p className={cn(
                        "font-bold uppercase tracking-wide text-sm mb-1",
                        direction === 'better' ? "text-emerald-400" : 
                        direction === 'worse' ? "text-red-400" : 
                        "text-slate-400"
                      )}>
                        {direction === 'better' ? "Signal Enrichment" : 
                         direction === 'worse' ? "Link Degradation" : 
                         "Steady Vector"}
                      </p>
                      <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px]">
                        {direction === 'better' ? "Signal gain detected. Maintain current vector." : 
                         direction === 'worse' ? "Signal loss encountered. Recalibrate direction." : 
                         "Stability confirmed. Hold position for telemetry sync."}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 w-full p-4 bg-cyan-950/10 border border-cyan-800/30 rounded-xl">
                  <div className="flex gap-4">
                    <div className="p-2 bg-slate-900 rounded-lg h-unit text-cyan-400 border border-slate-800">
                      <Settings size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-cyan-500 tracking-wider mb-1">Recommended Configuration</p>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Use Channel {data.channel} to minimize co-channel interference. BSSID {data.bssid} identified as primary upstream node.
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
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-[0.2em]">Signal Telemetry Feed</div>
                    <div className="flex gap-5 font-mono text-[9px] uppercase tracking-widest">
                      <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500" /> Linked: OK</span>
                      <span className="flex items-center gap-1.5 text-slate-400"><div className="w-1.5 h-1.5 rounded-full bg-slate-700" /> Buffer: 20s</span>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-h-[220px]">
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
                          domain={[0, 100]} 
                          stroke="#475569" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#020617', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '10px' }}
                          itemStyle={{ color: '#22d3ee' }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="signal" 
                          stroke="#22d3ee" 
                          strokeWidth={2} 
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
          ) : (
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
                  
                  <canvas 
                    ref={canvasRef}
                    onClick={addHeatPoint}
                    className="bg-black/40 rounded-2xl border border-slate-800/50 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-shadow duration-500 group-hover:shadow-[0_0_60px_rgba(34,211,238,0.05)] w-full max-w-[800px] h-auto aspect-[8/5]"
                  />
                  
                  {heatmap.length === 0 && (
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
