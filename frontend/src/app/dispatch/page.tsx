"use client";
import React, { useState, useEffect, useRef } from 'react';

export default function DispatchCenter() {
  const [state, setState] = useState<any>(null);
  const [acknowledgedId, setAcknowledgedId] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  
  const notifiedSet = useRef(new Set<string>());
  
  const audioRefs = {
    CRITICAL: useRef<HTMLAudioElement | null>(null),
    HIGH: useRef<HTMLAudioElement | null>(null),
    MEDIUM: useRef<HTMLAudioElement | null>(null),
    LOW: useRef<HTMLAudioElement | null>(null)
  };

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/state`);
        const data = await res.json();
        setState(data);
      } catch (err) {
        // Silent fail
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleStart = () => {
    setHasStarted(true);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const latestReport = state?.latest_report;
  const currentIncidentKey = latestReport?.description;
  const rawSeverity = latestReport?.severity?.toUpperCase() || (state?.threat_level?.toUpperCase()) || "LOW";
  
  // Normalize severity to one of our 4 audio tracks
  let normalizedSeverity = "LOW";
  if (rawSeverity.includes("CRITICAL")) normalizedSeverity = "CRITICAL";
  else if (rawSeverity.includes("HIGH")) normalizedSeverity = "HIGH";
  else if (rawSeverity.includes("MEDIUM")) normalizedSeverity = "MEDIUM";
  
  const isAlarming = currentIncidentKey && currentIncidentKey !== acknowledgedId && latestReport?.classification !== "Safe/No Threat";

  useEffect(() => {
    if (!hasStarted) return;

    if (isAlarming && currentIncidentKey) {
      // Trigger Notification
      if ("Notification" in window && Notification.permission === "granted") {
        if (!notifiedSet.current.has(currentIncidentKey)) {
          new Notification(`[${normalizedSeverity}] AwareX Incident Detected`, {
            body: currentIncidentKey,
            icon: "/favicon.ico"
          });
          notifiedSet.current.add(currentIncidentKey);
        }
      }

      // Play Audio
      Object.values(audioRefs).forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });
      
      const targetAudio = audioRefs[normalizedSeverity as keyof typeof audioRefs]?.current;
      if (targetAudio) {
        targetAudio.loop = true; // Real incidents loop continuously
        targetAudio.play().catch(e => console.log("Audio play prevented:", e));
      }
    } else {
      // Stop all audio when acknowledged or safe
      Object.values(audioRefs).forEach(ref => {
        if (ref.current) {
          ref.current.pause();
          ref.current.currentTime = 0;
        }
      });
    }
  }, [isAlarming, currentIncidentKey, normalizedSeverity, hasStarted]);

  const handleAcknowledge = () => {
    setAcknowledgedId(currentIncidentKey);
    // Audio stops automatically via the useEffect when isAlarming becomes false
  };

  const testAudio = (severity: string) => {
    // Stop all audio first
    Object.values(audioRefs).forEach(ref => {
      if (ref.current) {
        ref.current.pause();
        ref.current.currentTime = 0;
      }
    });
    
    if (severity !== 'STOP') {
      const target = audioRefs[severity as keyof typeof audioRefs]?.current;
      if (target) {
        target.loop = false; // Test buttons only play once
        target.play().catch(e => console.log("Test play failed:", e));
      }
    }
  };

  if (!hasStarted) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center text-white p-6">
        <svg className="w-24 h-24 text-indigo-500 mb-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        <h1 className="text-4xl md:text-6xl font-black uppercase tracking-widest text-center mb-4">Dispatch Locked</h1>
        <p className="text-neutral-400 text-center max-w-lg mb-12 text-lg">Modern browsers require your explicit interaction before they allow this dashboard to play emergency sirens and trigger push notifications.</p>
        <button 
          onClick={handleStart}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-12 py-6 rounded-2xl text-2xl font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(79,70,229,0.4)]"
        >
          Start Dispatch Monitoring
        </button>
      </div>
    );
  }

  // Determine background color based on severity
  let bgClass = "bg-neutral-950";
  if (isAlarming) {
    if (normalizedSeverity === "CRITICAL") bgClass = "bg-rose-900 animate-[pulse_1s_ease-in-out_infinite]";
    else if (normalizedSeverity === "HIGH") bgClass = "bg-orange-900 animate-[pulse_1s_ease-in-out_infinite]";
    else if (normalizedSeverity === "MEDIUM") bgClass = "bg-yellow-900 animate-[pulse_2s_ease-in-out_infinite]";
    else bgClass = "bg-indigo-900";
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 flex flex-col font-sans ${bgClass} text-white`}>
      {/* Hidden Audio Elements */}
      <audio ref={audioRefs.CRITICAL} src="/sounds/critical.mp3" preload="auto" />
      <audio ref={audioRefs.HIGH} src="/sounds/high.mp3" preload="auto" />
      <audio ref={audioRefs.MEDIUM} src="/sounds/medium.mp3" preload="auto" />
      <audio ref={audioRefs.LOW} src="/sounds/low.mp3" preload="auto" />

      <header className="border-b border-white/10 bg-black/50 backdrop-blur-xl p-4 md:p-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-center md:text-left">
            <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">Central Dispatch Center</h1>
            <p className="text-sm md:text-base text-white/70 mt-1">Live Threat Monitoring</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4">
             <div className="flex items-center space-x-2 text-xs md:text-sm font-bold bg-black/30 px-3 md:px-4 py-2 rounded-lg">
               <span className="relative flex h-3 w-3">
                 <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${state?.monitoring ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                 <span className={`relative inline-flex rounded-full h-3 w-3 ${state?.monitoring ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
               </span>
               <span>{state?.monitoring ? 'FEED ACTIVE' : 'FEED OFFLINE'}</span>
             </div>
             <a href="/" className="text-xs md:text-sm text-white/50 hover:text-white transition-colors underline">Return to Dashboard</a>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-8 flex flex-col items-center justify-center">
        {isAlarming ? (
          <div className="bg-black/60 backdrop-blur-2xl border border-white/20 p-6 md:p-12 rounded-2xl md:rounded-3xl max-w-4xl w-full text-center shadow-2xl">
            <svg className={`w-20 h-20 md:w-32 md:h-32 text-white mx-auto mb-4 md:mb-6 ${normalizedSeverity === 'CRITICAL' || normalizedSeverity === 'HIGH' ? 'animate-bounce' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-3xl md:text-6xl font-black mb-2 md:mb-4 tracking-tight drop-shadow-lg uppercase">{normalizedSeverity} INCIDENT DETECTED</h2>
            <div className="bg-black/40 p-4 md:p-6 rounded-xl border border-white/10 mb-6 md:mb-8">
                <p className="text-lg md:text-2xl font-medium mb-1 md:mb-2">{latestReport?.classification}</p>
                <p className="text-base md:text-xl text-neutral-300">{latestReport?.description}</p>
            </div>
            <button 
              onClick={handleAcknowledge}
              className="w-full md:w-auto bg-white text-black hover:bg-neutral-200 px-6 py-4 md:px-12 md:py-6 rounded-xl md:rounded-2xl text-lg md:text-2xl font-black uppercase tracking-widest transition-transform hover:scale-105 active:scale-95 shadow-xl"
            >
              Acknowledge & Dispatch Units
            </button>
          </div>
        ) : (
          <div className="text-center opacity-50 px-4">
             <svg className="w-16 h-16 md:w-24 md:h-24 mx-auto mb-4 md:mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
             <h2 className="text-2xl md:text-3xl font-medium tracking-widest uppercase">All Clear</h2>
             <p className="text-base md:text-lg mt-2 font-light">Monitoring active feeds for critical events...</p>
             
             {/* Audio Test Controls */}
             <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button onClick={() => testAudio('CRITICAL')} className="text-xs font-bold tracking-wider bg-rose-900/50 hover:bg-rose-800/80 px-4 py-2 rounded-lg border border-rose-500/30 transition-colors">TEST CRITICAL</button>
                <button onClick={() => testAudio('HIGH')} className="text-xs font-bold tracking-wider bg-orange-900/50 hover:bg-orange-800/80 px-4 py-2 rounded-lg border border-orange-500/30 transition-colors">TEST HIGH</button>
                <button onClick={() => testAudio('MEDIUM')} className="text-xs font-bold tracking-wider bg-yellow-900/50 hover:bg-yellow-800/80 px-4 py-2 rounded-lg border border-yellow-500/30 transition-colors">TEST MEDIUM</button>
                <button onClick={() => testAudio('LOW')} className="text-xs font-bold tracking-wider bg-indigo-900/50 hover:bg-indigo-800/80 px-4 py-2 rounded-lg border border-indigo-500/30 transition-colors">TEST LOW</button>
                <button onClick={() => testAudio('STOP')} className="text-xs font-bold tracking-wider bg-neutral-800 hover:bg-neutral-700 px-4 py-2 rounded-lg border border-neutral-500/30 transition-colors">MUTE TEST</button>
             </div>
             <p className="text-xs mt-4 text-neutral-400 max-w-lg mx-auto leading-relaxed">
               <strong>Supported Format:</strong> <code className="bg-black/30 px-1 rounded text-rose-300">.mp3</code><br/>
               Place files in <code className="bg-black/30 px-1 rounded text-rose-300">frontend/public/sounds/</code>.<br/>
               Real alarms loop endlessly until an operator manually clicks the Acknowledge button.
             </p>
             {latestReport && (
                 <div className="mt-8 md:mt-12 bg-white/5 border border-white/10 p-4 md:p-6 rounded-xl md:rounded-2xl max-w-2xl mx-auto text-left">
                     <p className="text-xs md:text-sm font-bold uppercase tracking-wider text-neutral-500 mb-2">Last Logged Event</p>
                     <p className="text-sm md:text-base text-neutral-300">{latestReport.description}</p>
                 </div>
             )}
          </div>
        )}
      </main>
    </div>
  );
}
