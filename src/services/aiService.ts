import { GoogleGenAI } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY not configured in environment.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

export interface DiagnosticResult {
  analysis: string;
  recommendations: string[];
  severity: 'low' | 'medium' | 'high';
}

export async function getNetworkDiagnostics(
  history: { time: string; signal: number }[],
  currentNetwork: any,
  spectralData: string
): Promise<DiagnosticResult> {
  const ai = getAI();
  
  const historyStr = history.map(h => `${h.time}: ${h.signal}%`).join('\n');
  
  const prompt = `
    As a Professional Wi-Fi Network Diagnostic Consultant, analyze the following telemetry data and provide a detailed report.
    
    Current Network State:
    - SSID: ${currentNetwork.ssid}
    - Channel: ${currentNetwork.channel}
    - Radio: ${currentNetwork.radio}
    - RX/TX Rate: ${currentNetwork.rx_rate}/${currentNetwork.tx_rate} Mbps
    
    Signal History (Last 20 samples):
    ${historyStr}
    
    Spectral Environment Data (Nearby Networks):
    ${spectralData}
    
    Please provide your response in valid JSON format with the following structure:
    {
      "analysis": "A detailed technical analysis of the current signal quality and stability.",
      "recommendations": ["Recommendation 1", "Recommendation 2", ...],
      "severity": "low" | "medium" | "high"
    }
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (e) {
    return {
      analysis: response.text || "Analysis failed to parse.",
      recommendations: ["Ensure you are within range of the router.", "Check for physical obstructions."],
      severity: "medium"
    };
  }
}
