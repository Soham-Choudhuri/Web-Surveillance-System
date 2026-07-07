"use client";
import React, { useState, useEffect, useMemo } from 'react';

export default function Dashboard() {
  const [state, setState] = useState({
    monitoring: false,
    threat_level: "Waiting...",
    object_count: 0,
    latest_report: null,
    history: [],
    is_analyzing: false
  });
  
  const [source, setSource] = useState("cam_0");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedVideoPath, setUploadedVideoPath] = useState<string | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [activeConfig, setActiveConfig] = useState<any>({ provider: "Loading...", model_name: "...", alerts_enabled: false });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  const [cameras, setCameras] = useState<any[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [newCamName, setNewCamName] = useState("");
  const [newCamUrl, setNewCamUrl] = useState("");

  const fetchCameras = async () => {
    try {
      const res = await fetch(`/api/cameras`);
      setCameras(await res.json());
    } catch(e) {}
  };

  useEffect(() => {
    fetchCameras();
    fetch(`/api/config`)
      .then(res => res.json())
      .then(data => setActiveConfig(data))
      .catch(() => {});
      
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/state`);
        const data = await res.json();
        setState(data);
      } catch (err) {
        // Silent fail on fetch error
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setErrorMsg(null);
    const formData = new FormData();
    formData.append("interval", intervalSeconds.toString());
    
    if (source === "Upload Video") {
      formData.append("source", "Upload Video");
      if (uploadedVideoPath) formData.append("video_path", uploadedVideoPath);
    } else if (source.startsWith("cam_")) {
      formData.append("source", "Camera");
      formData.append("camera_url", source.replace("cam_", ""));
    } else {
      formData.append("source", source);
    }
    
    try {
      const res = await fetch(`/api/start`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.message || "Failed to start stream.");
      }
    } catch (e) {
      setErrorMsg("Failed to connect to the backend server.");
    }
  };

  const handleStop = async () => {
    setErrorMsg(null);
    await fetch(`/api/stop`, { method: 'POST' });
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-indigo-500/30">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-neutral-950/50 backdrop-blur-xl">
        <div className="w-full mx-auto px-4 sm:px-6 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">AwareX</h1>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 sm:space-x-0">
             <div className="flex items-center space-x-2 text-xs sm:text-sm font-medium bg-white/5 sm:bg-transparent px-2 py-1 sm:p-0 rounded-lg">
               <span className="relative flex h-2.5 w-2.5 sm:h-3 sm:w-3">
                 <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${state.monitoring ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                 <span className={`relative inline-flex rounded-full h-2.5 w-2.5 sm:h-3 sm:w-3 ${state.monitoring ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
               </span>
               <span className="text-neutral-300">{state.monitoring ? 'System Online' : 'System Offline'}</span>
             </div>
             <a href="/logs" className="text-xs sm:text-sm font-medium text-neutral-400 hover:text-white transition-colors">Logs Database</a>
             <a href="/admin" className="text-xs sm:text-sm font-medium text-neutral-400 hover:text-white transition-colors">Admin Portal</a>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3 space-y-6">
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 shadow-2xl backdrop-blur-sm">
            <h2 className="text-lg font-medium mb-4 flex items-center text-neutral-200">
              <svg className="w-5 h-5 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
              Control Panel
            </h2>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider block">Input Source</label>
                  <button onClick={() => setShowCameraModal(true)} className="text-[10px] bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 px-2 py-0.5 rounded flex items-center font-bold transition-colors">
                    <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    MANAGE CAMERAS
                  </button>
                </div>
                <select 
                  value={source} 
                  onChange={(e) => { setSource(e.target.value); setErrorMsg(null); }}
                  className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none text-white mb-2"
                >
                  <optgroup label="Live CCTV Cameras">
                    {cameras.map(c => <option key={c.id} value={`cam_${c.url}`}>🎥 {c.name}</option>)}
                  </optgroup>
                  <option value="Upload Video">📁 Upload Video File...</option>
                </select>
              </div>

              {source === "Upload Video" && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 block">Upload File</label>
                  <input 
                    type="file" 
                    accept="video/mp4,video/avi,video/mov" 
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const selectedFile = e.target.files[0];
                        setFile(selectedFile);
                        setIsUploading(true);
                        const formData = new FormData();
                        formData.append("file", selectedFile);
                        try {
                          const res = await fetch(`/api/upload`, {
                            method: 'POST',
                            body: formData
                          });
                          const data = await res.json();
                          if (data.video_path) {
                            setUploadedVideoPath(data.video_path);
                          }
                        } catch (err) {
                          console.error(err);
                        }
                        setIsUploading(false);
                      }
                    }} 
                    className="w-full text-sm text-neutral-400 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20 cursor-pointer transition-all" 
                  />
                </div>
              )}

              <div className="pt-2">
                <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Analysis Interval</span>
                  <span className="text-indigo-400 font-mono">{intervalSeconds}s</span>
                </label>
                <input 
                  type="range" 
                  min="1" max="60" 
                  value={intervalSeconds} 
                  onChange={(e) => setIntervalSeconds(parseInt(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-between">
                <div>
                  <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider block">Twilio Alerts</label>
                  <p className="text-[10px] text-neutral-500">Send SMS/WhatsApp on incident</p>
                </div>
                <button 
                  onClick={async () => {
                    const newState = !activeConfig.alerts_enabled;
                    setActiveConfig({...activeConfig, alerts_enabled: newState});
                    await fetch(`/api/config`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({...activeConfig, alerts_enabled: newState})
                    });
                  }}
                  className={`w-11 h-6 rounded-full transition-colors relative ${activeConfig.alerts_enabled ? 'bg-indigo-500' : 'bg-neutral-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${activeConfig.alerts_enabled ? 'left-6' : 'left-1'}`}></div>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={handleStart} 
                  disabled={state.monitoring || isUploading || (source === "Upload Video" && !uploadedVideoPath)} 
                  className="relative overflow-hidden group bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-xl font-medium text-sm transition-all"
                >
                  <span className="relative z-10">{isUploading ? 'Extracting Audio...' : 'Start Stream'}</span>
                </button>
                <button onClick={handleStop} disabled={!state.monitoring} className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-xl font-medium text-sm transition-all">
                  Stop Stream
                </button>
              </div>

              {errorMsg && (
                <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium flex items-start animate-in fade-in slide-in-from-top-2 duration-300">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="pt-4 border-t border-white/5">
                <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Active Intelligence</span>
                  {activeConfig.alerts_enabled ? (
                    <span className="bg-rose-500/10 text-rose-400 text-[10px] px-2 py-0.5 rounded-full font-bold">ALERTS ON</span>
                  ) : (
                    <span className="bg-neutral-800 text-neutral-500 text-[10px] px-2 py-0.5 rounded-full font-bold">MUTED</span>
                  )}
                </p>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 flex items-center">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mr-2 animate-pulse"></div>
                  <span className="text-sm text-indigo-300 font-medium capitalize">
                    {activeConfig.provider} ({activeConfig.model_name})
                  </span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-9 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-2xl overflow-hidden bg-neutral-900 border border-white/5 shadow-2xl relative flex items-center justify-center group min-h-[250px] md:min-h-[400px] max-h-[75vh]">
              {useMemo(() => state.monitoring ? (
                <img src={`/api/video_feed?t=${Date.now()}`} alt="Live Feed" className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-neutral-500 py-24">
                  <svg className="w-12 h-12 mx-auto mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <p className="text-sm font-medium">Camera Offline</p>
                </div>
              ), [state.monitoring])}
              
              {state.monitoring && (
                <div className="absolute top-4 left-4 flex space-x-2">
                  <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 flex items-center space-x-2 text-xs font-mono">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                    <span>LIVE</span>
                  </div>
                  <div className="bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-xs font-mono">
                    Objects: {state.object_count}
                  </div>
                </div>
              )}

              {(state as any).is_analyzing && (
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10 transition-all">
                  <div className="bg-neutral-900/90 border border-white/10 px-6 py-4 rounded-2xl flex items-center space-x-4 shadow-2xl">
                    <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Analyzing Feed</h3>
                      <p className="text-xs text-neutral-400">Please wait while the VLM processes the incident...</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 shadow-2xl h-full flex flex-col">
                <h2 className="text-lg font-medium mb-6 flex items-center text-neutral-200">
                  <svg className="w-5 h-5 mr-2 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Intelligence Hub
                </h2>
                
                <div className="mb-6">
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-1">Current Threat Level</p>
                  <div className={`text-2xl font-bold tracking-tight ${state.threat_level.includes('CRITICAL') ? 'text-rose-400' : state.threat_level.includes('MEDIUM') ? 'text-amber-400' : state.threat_level === 'Waiting...' ? 'text-neutral-500' : 'text-emerald-400'}`}>
                    {state.threat_level}
                  </div>
                </div>

                <div className="flex-1 bg-neutral-900/50 rounded-xl border border-white/5 p-4 overflow-y-auto max-h-[300px]">
                  <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">AI Incident Report</p>
                  {state.latest_report ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:items-center sm:space-x-4">
                        <p><span className="text-neutral-400">Class:</span> <span className="font-medium text-white">{(state.latest_report as any).classification}</span></p>
                        {(state.latest_report as any).confidence_score && (
                          <div className="flex items-center space-x-2">
                             <span className="text-neutral-400 text-xs uppercase tracking-wider">Confidence:</span>
                             <div className="w-24 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                               <div 
                                 className={`h-full rounded-full ${(state.latest_report as any).confidence_score > 80 ? 'bg-emerald-500' : (state.latest_report as any).confidence_score > 50 ? 'bg-amber-500' : 'bg-rose-500'}`} 
                                 style={{ width: `${(state.latest_report as any).confidence_score}%` }}
                               ></div>
                             </div>
                             <span className="text-xs font-mono text-neutral-300">{(state.latest_report as any).confidence_score}%</span>
                          </div>
                        )}
                      </div>
                      <p className="text-neutral-300 leading-relaxed"><span className="text-neutral-400">Analysis:</span> {(state.latest_report as any).description}</p>
                      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3 mt-4">
                        <p className="text-indigo-300 font-medium mb-1">Recommendation</p>
                        <p className="text-indigo-200/80">{(state.latest_report as any).recommendation}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-neutral-500 text-center mt-8">Awaiting analysis...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* History Section */}
          <div className="lg:col-span-12 mt-8">
            <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium flex items-center text-neutral-200">
                  <svg className="w-5 h-5 mr-2 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Analysis History & Logs
                </h2>
                <a href="/logs" className="text-xs font-medium bg-neutral-800 hover:bg-neutral-700 text-white px-3 py-1.5 rounded-lg transition-colors border border-white/5">Manage Full Database</a>
              </div>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {state.history.length === 0 ? (
                  <p className="text-neutral-500 text-sm text-center py-8">No historical reports available yet.</p>
                ) : (
                  state.history.map((log: any, idx) => (
                    <details key={idx} className="group bg-neutral-900/50 rounded-xl border border-white/5 overflow-hidden">
                      <summary className="flex items-start sm:items-center justify-between p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors list-none gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 sm:space-x-0">
                          <span className={`w-fit px-2.5 py-1 rounded-md text-xs font-bold tracking-wide ${log.Severity === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : log.Severity === 'MEDIUM' ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                            {log.Severity}
                          </span>
                          <span className="text-sm font-medium text-white break-words">{log.Type}</span>
                          <span className="text-xs text-neutral-400">{log.Time}</span>
                        </div>
                        <svg className="w-5 h-5 text-neutral-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </summary>
                      <div className="p-4 pt-0 border-t border-white/5 mt-2 text-sm text-neutral-300">
                        <p className="mb-4">{log.Summary}</p>
                        {log.Details?.recommendation && (
                           <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-3">
                             <p className="text-indigo-300 font-medium mb-1">Action Recommendation</p>
                             <p className="text-indigo-200/80">{log.Details.recommendation}</p>
                           </div>
                        )}
                      </div>
                    </details>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Camera Modal */}
        {showCameraModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-6 border-b border-white/5 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center"><span className="text-indigo-400 mr-2">🎥</span> CCTV Cameras</h3>
                <button onClick={() => setShowCameraModal(false)} className="text-neutral-500 hover:text-white">&times;</button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
                  {cameras.length === 0 && <p className="text-sm text-neutral-500 text-center py-4">No cameras configured.</p>}
                  {cameras.map(c => (
                    <div key={c.id} className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5 group hover:border-white/10 transition-colors">
                      <div className="overflow-hidden">
                        <p className="text-sm font-bold text-white truncate">{c.name}</p>
                        <p className="text-xs text-neutral-500 truncate">{c.url}</p>
                      </div>
                      <button 
                        onClick={async () => {
                          await fetch(`/api/cameras/${c.id}`, { method: 'DELETE' });
                          fetchCameras();
                        }}
                        className="text-neutral-600 hover:text-rose-400 p-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        title="Remove Camera"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Add New RTSP / CCTV Feed</p>
                  <input type="text" placeholder="Camera Name (e.g. Front Door)" value={newCamName} onChange={e => setNewCamName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none" />
                  <input type="text" placeholder="URL/RTSP Link (or 0 for local webcam)" value={newCamUrl} onChange={e => setNewCamUrl(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:ring-1 focus:ring-indigo-500 outline-none" />
                  <button 
                    onClick={async () => {
                      if(!newCamName || !newCamUrl) return;
                      await fetch(`/api/cameras`, {
                        method: 'POST',
                        body: JSON.stringify({ name: newCamName, url: newCamUrl })
                      });
                      setNewCamName(""); setNewCamUrl(""); fetchCameras();
                    }}
                    disabled={!newCamName || !newCamUrl}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-2 rounded-lg text-sm transition-colors"
                  >
                    Save Camera
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
