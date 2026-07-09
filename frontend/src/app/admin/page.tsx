"use client";
import React, { useState, useEffect, useRef } from 'react';

export default function AdminPortal() {
  const [access, setAccess] = useState<boolean | null>(null);
  const [config, setConfig] = useState({
    active_mode: "local",
    provider: "ollama",
    model_name: "moondream",
    cloud_models: [] as any[],
    ollama_models_path: "",
    twilio_sid: "",
    twilio_auth: "",
    twilio_type: "SMS",
    twilio_from: "",
    twilio_to: "",
    allowed_origins: [] as string[]
  });
  const [newOrigin, setNewOrigin] = useState("");
  const [saving, setSaving] = useState(false);
  
  const [ollamaModels, setOllamaModels] = useState<any[]>([]);
  const [downloadModelName, setDownloadModelName] = useState("");
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [apiStats, setApiStats] = useState<any>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDownloading) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDownloading]);

  const fetchModels = async () => {
    try {
      const res = await fetch("/api/ollama/tags");
      const data = await res.json();
      if (data.models) setOllamaModels(data.models);
    } catch (e) {}
  };

  useEffect(() => {
    fetch(`/api/admin_check`)
      .then(res => res.json())
      .then(data => setAccess(data.access))
      .catch(() => setAccess(false));
      
    fetch(`/api/config`)
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(() => {});
      
    fetchModels();

    const statsInterval = setInterval(() => {
      fetch(`/api/state`)
        .then(res => res.json())
        .then(data => {
            if (data.api_stats) setApiStats(data.api_stats);
        })
        .catch(() => {});
    }, 2000);

    return () => clearInterval(statsInterval);
  }, []);

  const saveConfig = async (newConfig: any) => {
    setConfig(newConfig);
    await fetch(`/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    });
  };

  const handleModeChange = (mode: string) => {
    let newConfig = { ...config };
    if (mode === "local") {
      newConfig = {...newConfig, active_mode: "local", provider: "ollama", model_name: "moondream"};
    } else {
      newConfig = {...newConfig, active_mode: "cloud"};
    }
    saveConfig(newConfig);
  };

  const handleProviderChange = (provider: string) => {
    let defaultModel = "";
    if (provider === "gemini") defaultModel = "gemini-1.5-flash";
    else if (provider === "groq") defaultModel = "llama3-8b-8192";
    else if (provider === "huggingface") defaultModel = "Salesforce/blip-image-captioning-large";
    else if (provider === "ollama") defaultModel = "moondream";
    
    saveConfig({...config, provider: provider, model_name: defaultModel});
  };

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    setTimeout(() => setSaving(false), 800);
  };

  const handleDeleteModel = async (name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      await fetch("/api/ollama/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      fetchModels();
    } catch (e) {}
  };

  const handlePullModel = async () => {
    if (!downloadModelName) return;
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadStatus("Starting...");
    
    abortControllerRef.current = new AbortController();
    
    try {
      const res = await fetch("/api/ollama/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: downloadModelName, stream: true }),
        signal: abortControllerRef.current.signal
      });
      
      if (!res.body) throw new Error("No body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (!line) continue;
          try {
            const data = JSON.parse(line);
            if (data.status) setDownloadStatus(data.status);
            if (data.completed && data.total) {
              setDownloadProgress((data.completed / data.total) * 100);
            }
          } catch(e) {}
        }
      }
      setDownloadStatus("Download complete!");
      setDownloadModelName("");
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadStatus("");
        setDownloadProgress(0);
        fetchModels();
      }, 2000);
      
    } catch (e: any) {
      if (e.name === 'AbortError') {
        setDownloadStatus("Download cancelled.");
      } else {
        setDownloadStatus("Download failed.");
      }
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadStatus("");
        setDownloadProgress(0);
      }, 2000);
    }
  };

  const handleCancelDownload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  if (access === null) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-white">Loading...</div>;
  if (access === false) return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white">
      <div className="w-16 h-16 bg-rose-500/10 text-rose-500 flex items-center justify-center rounded-2xl mb-4">
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
      </div>
      <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
      <p className="text-neutral-400">Missing .admin_access token.</p>
      <a href="/" className="mt-6 text-indigo-400 hover:text-indigo-300 font-medium">Return to Dashboard</a>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans">
      <header className="border-b border-white/10 bg-neutral-950/50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-0 sm:h-16 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center space-x-3 text-rose-400">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             <h1 className="text-xl font-semibold">AwareX Administration</h1>
          </div>
          {isDownloading ? (
            <span className="text-sm font-medium text-neutral-600 cursor-not-allowed" title="Cannot exit during download">Exit Admin</span>
          ) : (
            <a href="/" className="text-sm font-medium text-neutral-400 hover:text-white transition-colors">Exit Admin</a>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="p-6 sm:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl">
          <h2 className="text-2xl font-bold mb-2">Model Configuration</h2>
          <p className="text-neutral-400 mb-8 text-sm">Select and configure the visual language model powering the intelligence hub.</p>

          <div className="space-y-6">
            <div>
              <label className="text-sm font-medium text-neutral-300 block mb-2">Execution Mode</label>
              <div className="flex bg-neutral-900 rounded-xl p-1 border border-white/5 max-w-sm">
                  <button disabled={isDownloading} onClick={() => handleModeChange("local")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${config.active_mode === "local" ? 'bg-indigo-500 text-white shadow' : 'text-neutral-400 hover:text-neutral-200'} disabled:opacity-50`}>Local Edge</button>
                  <button disabled={isDownloading} onClick={() => handleModeChange("cloud")} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${config.active_mode === "cloud" ? 'bg-indigo-500 text-white shadow' : 'text-neutral-400 hover:text-neutral-200'} disabled:opacity-50`}>Cloud API</button>
              </div>
            </div>

            {config.active_mode === "local" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-neutral-300 block mb-2">Local Provider</label>
                  <select 
                    value={config.provider} 
                    onChange={e => handleProviderChange(e.target.value)}
                    disabled={isDownloading}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none text-white disabled:opacity-50"
                  >
                    <option value="ollama">Ollama</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-300 block mb-2">Model Name</label>
                  <select 
                    value={config.model_name}
                    onChange={e => saveConfig({...config, model_name: e.target.value})}
                    disabled={isDownloading}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none text-white disabled:opacity-50"
                  >
                    {Array.from(new Set([
                      config.model_name,
                      ...ollamaModels.map(m => m.name.replace(/:latest$/, ''))
                    ])).filter(Boolean).map(mName => (
                      <option key={mName} value={mName}>{mName}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2 mt-2">
                  <label className="text-sm font-medium text-neutral-300 block mb-2">
                    Models Directory Path (Optional)
                    <span className="block text-xs text-neutral-500 font-normal mt-0.5">Absolute path to override default Ollama storage. Saving will restart the local AI engine.</span>
                  </label>
                  <input 
                    type="text" 
                    value={(config as any).ollama_models_path || ""}
                    onChange={e => setConfig({...config, ollama_models_path: e.target.value})}
                    disabled={isDownloading}
                    placeholder="e.g. C:\System\Dev\Ollama\models"
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white disabled:opacity-50"
                  />
                </div>
              </div>
            )}

            {config.active_mode === "cloud" && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-medium text-neutral-300 block">Cloud Models</label>
                  <button 
                    onClick={() => {
                      const newModel = { id: Date.now().toString(), provider: "gemini", model: "gemini-1.5-flash", api_key: "", base_url: "", is_primary: config.cloud_models.length === 0 };
                      setConfig({...config, cloud_models: [...config.cloud_models, newModel]});
                    }}
                    className="text-xs bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 px-3 py-1.5 rounded-lg transition-colors font-medium"
                  >
                    + Add Model
                  </button>
                </div>
                
                {config.cloud_models?.length === 0 ? (
                  <div className="text-sm text-neutral-500 py-4 text-center border border-dashed border-white/10 rounded-xl bg-white/[0.01]">
                    No cloud models configured. Add one to get started.
                  </div>
                ) : (
                  config.cloud_models?.map((model: any, index: number) => (
                    <div key={model.id} className={`p-4 rounded-xl border transition-all ${model.is_primary ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/10 bg-neutral-900/50'}`}>
                      <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                        <label className="flex items-center space-x-3 cursor-pointer">
                          <input 
                            type="radio" 
                            name="primary_model" 
                            checked={model.is_primary}
                            onChange={() => {
                              const newModels = config.cloud_models.map((m: any) => ({...m, is_primary: m.id === model.id}));
                              saveConfig({...config, cloud_models: newModels});
                            }}
                            className="w-4 h-4 text-indigo-500 bg-neutral-900 border-white/20 focus:ring-indigo-500 focus:ring-offset-neutral-900" 
                          />
                          <span className={`text-sm font-medium ${model.is_primary ? 'text-indigo-400' : 'text-neutral-500 hover:text-neutral-300 transition-colors'}`}>
                            {model.is_primary ? 'Active Model' : 'Set as Active'}
                          </span>
                        </label>
                        <button 
                          onClick={() => {
                            const newModels = config.cloud_models.filter((m: any) => m.id !== model.id);
                            if (model.is_primary && newModels.length > 0) newModels[0].is_primary = true;
                            setConfig({...config, cloud_models: newModels});
                          }}
                          className="text-neutral-500 hover:text-rose-400 transition-colors"
                          title="Remove model"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-neutral-400 block mb-1.5">Provider</label>
                          <select 
                            value={model.provider} 
                            onChange={e => {
                              const val = e.target.value;
                              const newModels = [...config.cloud_models];
                              newModels[index].provider = val;
                              if (val === "gemini") newModels[index].model = "gemini-1.5-flash";
                              else if (val === "groq") newModels[index].model = "llama3-8b-8192";
                              else if (val === "huggingface") newModels[index].model = "Salesforce/blip-image-captioning-large";
                              else if (val === "mistral") newModels[index].model = "pixtral-12b";
                              else if (val === "custom") newModels[index].model = "";
                              setConfig({...config, cloud_models: newModels});
                            }}
                            className="w-full bg-neutral-950 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-white"
                          >
                            <option value="gemini">Google Gemini</option>
                            <option value="groq">Groq</option>
                            <option value="huggingface">Hugging Face</option>
                            <option value="mistral">Mistral La Plateforme</option>
                            <option value="custom">Custom API (OpenAI Compatible)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-xs font-medium text-neutral-400 block mb-1.5">Model ID</label>
                          <input 
                            type="text" 
                            value={model.model}
                            onChange={e => {
                              const newModels = [...config.cloud_models];
                              newModels[index].model = e.target.value;
                              setConfig({...config, cloud_models: newModels});
                            }}
                            placeholder="e.g. gemini-1.5-flash"
                            className="w-full bg-neutral-950 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-white"
                          />
                        </div>
                        
                        <div className={model.provider === "custom" || model.provider === "mistral" ? "md:col-span-1" : "md:col-span-2"}>
                          <label className="text-xs font-medium text-neutral-400 block mb-1.5">API Key</label>
                          <input 
                            type="password" 
                            value={model.api_key}
                            onChange={e => {
                              const newModels = [...config.cloud_models];
                              newModels[index].api_key = e.target.value;
                              setConfig({...config, cloud_models: newModels});
                            }}
                            placeholder="Enter secret key"
                            className="w-full bg-neutral-950 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-white"
                          />
                        </div>
                        
                        {(model.provider === "custom" || model.provider === "mistral") && (
                          <div>
                            <label className="text-xs font-medium text-neutral-400 block mb-1.5">
                              Base URL {model.provider === "custom" && <span className="text-indigo-400/80 ml-1 font-normal">(Required)</span>}
                            </label>
                            <input 
                              type="text" 
                              value={model.base_url}
                              onChange={e => {
                                const newModels = [...config.cloud_models];
                                newModels[index].base_url = e.target.value;
                                setConfig({...config, cloud_models: newModels});
                              }}
                              placeholder={model.provider === "mistral" ? "https://api.mistral.ai/v1" : "e.g. https://api.together.xyz/v1/"}
                              className="w-full bg-neutral-950 border border-white/5 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50 text-white"
                            />
                            {model.provider === "custom" && (
                              <p className="text-[10px] text-neutral-500 mt-1">Must be an OpenAI-compatible /chat/completions endpoint. Check your AI provider's API documentation to find their specific URL.</p>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* API Usage Progress Bar */}
                      {(() => {
                        const providerStats = apiStats[model.provider] || { rpm_used: 0, rpm_limit: (model.provider==='gemini'?5:(model.provider==='huggingface'?20:30)), status: 'Active' };
                        const pct = Math.min(100, Math.max(0, (providerStats.rpm_used / providerStats.rpm_limit) * 100));
                        const isWarning = pct > 75;
                        const isCooldown = providerStats.status === 'Cooldown';
                        const barColor = isCooldown ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';
                        return (
                          <div className="mt-5 pt-4 border-t border-white/5">
                              <div className="flex justify-between text-[11px] mb-2 uppercase tracking-wider">
                                  <span className="text-neutral-500 font-bold">Live API Usage</span>
                                  <span className={`${isCooldown ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'} font-bold flex items-center gap-1`}>
                                      {isCooldown && <span className="animate-pulse">●</span>}
                                      {providerStats.rpm_used} / {providerStats.rpm_limit} RPM {isCooldown && '(COOLDOWN)'}
                                  </span>
                              </div>
                              <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                                  <div className={`${barColor} h-1.5 rounded-full transition-all duration-700 ease-out`} style={{ width: `${pct}%` }}></div>
                              </div>
                          </div>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            )}
            
            {/* Ollama Model Manager Section */}
            {config.active_mode === "local" && (
            <div className="pt-8 mt-8 border-t border-white/5 animate-in fade-in">
              <h2 className="text-xl font-bold mb-2">Local Model Manager</h2>
              <p className="text-neutral-400 mb-6 text-sm">Download, view, and manage your local Ollama vision and language models directly from the UI.</p>
              
              <div className="bg-neutral-900 border border-white/5 rounded-xl p-6 mb-6">
                 <h3 className="text-sm font-medium text-white mb-4">Installed Models</h3>
                 {ollamaModels.length === 0 ? (
                    <div className="text-sm text-neutral-500 py-4 text-center">No models installed or Ollama engine is not running.</div>
                 ) : (
                    <div className="space-y-3">
                      {ollamaModels.map(model => (
                        <div key={model.name} className="flex items-center justify-between bg-black/40 px-4 py-3 rounded-lg border border-white/5">
                           <div>
                              <div className="text-sm font-medium text-white">{model.name}</div>
                              <div className="text-xs text-neutral-500">{(model.size / 1024 / 1024 / 1024).toFixed(2)} GB</div>
                           </div>
                           <button 
                             onClick={() => handleDeleteModel(model.name)}
                             className="text-neutral-500 hover:text-rose-500 transition-colors p-2"
                             title="Delete Model"
                           >
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                           </button>
                        </div>
                      ))}
                    </div>
                 )}
              </div>
              
              <div className="bg-neutral-900 border border-white/5 rounded-xl p-6">
                 <h3 className="text-sm font-medium text-white mb-4">Pull New Model</h3>
                 <div className="flex gap-4">
                    <input 
                      type="text" 
                      value={downloadModelName}
                      onChange={e => setDownloadModelName(e.target.value)}
                      disabled={isDownloading}
                      placeholder="e.g. llama3.2-vision:latest"
                      className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white disabled:opacity-50"
                    />
                    <button 
                      onClick={handlePullModel}
                      disabled={isDownloading || !downloadModelName}
                      className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap"
                    >
                      {isDownloading ? 'Pulling...' : 'Download Model'}
                    </button>
                    {isDownloading && (
                      <button 
                        onClick={handleCancelDownload}
                        className="bg-rose-600 hover:bg-rose-500 text-white px-6 py-3 rounded-xl font-medium text-sm transition-all whitespace-nowrap"
                      >
                        Cancel
                      </button>
                    )}
                 </div>
                 
                 {isDownloading && (
                   <div className="mt-4">
                      <div className="flex justify-between text-xs text-neutral-400 mb-1">
                        <span>{downloadStatus}</span>
                        <span>{Math.round(downloadProgress)}%</span>
                      </div>
                      <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden">
                         <div 
                           className="bg-indigo-500 h-2.5 rounded-full transition-all duration-300 ease-out" 
                           style={{ width: `${downloadProgress}%` }}
                         ></div>
                      </div>
                   </div>
                 )}
              </div>
            </div>
            )}

            <div className="pt-8 mt-8 border-t border-white/5">
              <h2 className="text-xl font-bold mb-2">Communications & Alerts</h2>
              <p className="text-neutral-400 mb-6 text-sm">Configure Twilio credentials for SMS and WhatsApp incident alerting.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-neutral-300 block mb-2">Twilio Account SID</label>
                  <input 
                    type="text" 
                    value={(config as any).twilio_sid || ""}
                    onChange={e => setConfig({...config, twilio_sid: e.target.value})}
                    placeholder="AC..."
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-300 block mb-2">Auth Token</label>
                  <input 
                    type="password" 
                    value={(config as any).twilio_auth || ""}
                    onChange={e => setConfig({...config, twilio_auth: e.target.value})}
                    placeholder="Enter secret token"
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-300 block mb-2">Message Type</label>
                  <select 
                    value={(config as any).twilio_type || "SMS"}
                    onChange={e => setConfig({...config, twilio_type: e.target.value})}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none text-white"
                  >
                    <option value="SMS">Standard SMS</option>
                    <option value="WhatsApp">WhatsApp Message</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-300 block mb-2">Sender Number (Twilio)</label>
                  <input 
                    type="text" 
                    value={(config as any).twilio_from || ""}
                    onChange={e => setConfig({...config, twilio_from: e.target.value})}
                    placeholder="+1234567890"
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-neutral-300 block mb-2">Receiver Authority Number</label>
                  <input 
                    type="text" 
                    value={(config as any).twilio_to || ""}
                    onChange={e => setConfig({...config, twilio_to: e.target.value})}
                    placeholder="+1234567890"
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-white"
                  />
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 flex items-center justify-start">
              <a href="https://www.twilio.com/login" target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors font-medium flex items-center gap-1">
                 Twilio Developer Dashboard
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          </div>
        </div>

        {/* Security: Allowed Origins */}
        <div className="mt-8 p-6 sm:p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <svg className="w-32 h-32" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Security: Allowed Origins</h2>
          <p className="text-neutral-400 mb-8 text-sm">Manage which IP addresses or Tailscale URLs are allowed to access the system remotely. Next.js will hot-reload automatically when you save changes.</p>
          
          <div className="space-y-4 mb-6">
            {(config.allowed_origins || []).map((origin, idx) => (
              <div key={idx} className="flex items-center justify-between bg-neutral-900 border border-white/10 rounded-xl px-4 py-3">
                <span className="text-sm font-mono text-emerald-400 break-all pr-4">{origin}</span>
                <button 
                  onClick={() => {
                    const updated = [...config.allowed_origins];
                    updated.splice(idx, 1);
                    setConfig({...config, allowed_origins: updated});
                  }}
                  className="text-rose-500 hover:text-rose-400 text-sm font-medium transition-colors flex-shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input 
              type="text" 
              value={newOrigin}
              onChange={e => setNewOrigin(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newOrigin.trim()) {
                  e.preventDefault();
                  setConfig({...config, allowed_origins: [...(config.allowed_origins || []), newOrigin.trim()]});
                  setNewOrigin("");
                }
              }}
              placeholder="e.g. 100.85.22.14 or awarex.ts.net"
              className="flex-1 bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-white font-mono"
            />
            <button 
              type="button"
              onClick={() => {
                if(newOrigin.trim()) {
                  setConfig({...config, allowed_origins: [...(config.allowed_origins || []), newOrigin.trim()]});
                  setNewOrigin("");
                }
              }}
              className="w-full sm:w-auto bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600/30 px-6 py-3 rounded-xl font-medium text-sm transition-all"
            >
              Add Origin
            </button>
          </div>
          
          <div className="pt-6 mt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-end">
             <button 
                onClick={handleSave} 
                disabled={isDownloading || saving}
                className="w-full sm:w-auto justify-center bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:border-white/5 disabled:shadow-none px-6 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 flex items-center shadow-[0_0_15px_rgba(99,102,241,0.15)] hover:shadow-[0_0_25px_rgba(99,102,241,0.3)]"
              >
                {saving ? 'Applying Security Rules...' : 'Save All Configurations'}
              </button>
          </div>
        </div>

      </main>
    </div>
  );
}
