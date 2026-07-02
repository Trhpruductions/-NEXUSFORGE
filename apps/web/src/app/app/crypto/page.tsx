"use client";

import { useState, useEffect } from "react";
import { 
  TrendingUp, 
  ArrowRightLeft, 
  BarChart3, 
  ShieldCheck, 
  Activity, 
  Zap, 
  Cpu, 
  Globe, 
  Lock, 
  ArrowDownUp,
  AlertCircle,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCrypto, CryptoAsset } from "@/hooks/use-crypto";
import { useEconomy } from "@/hooks/use-economy";

export default function CryptoTerminal() {
  const { assets, loading, error, executeSwap, refresh } = useCrypto();
  const { data: economy } = useEconomy("current");
  
  const [selectedAsset, setSelectedAsset] = useState<CryptoAsset | null>(null);
  const [swapAmount, setSwapAmount] = useState<string>("");
  const [swapping, setSwapping] = useState(false);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  useEffect(() => {
    if (assets.length > 0 && !selectedAsset) {
      setSelectedAsset(assets[0]);
    }
  }, [assets, selectedAsset]);

  const handleSwap = async () => {
    if (!selectedAsset || !swapAmount || isNaN(Number(swapAmount))) return;
    
    setSwapping(true);
    const result = await executeSwap("NC", selectedAsset.symbol, swapAmount);
    if (result) {
      setLastTxId(result.txId);
      setSwapAmount("");
      setTimeout(() => setLastTxId(null), 10000);
    }
    setSwapping(false);
  };

  return (
      <div className="cinematic-stage metal-corners flex select-none flex-col gap-4 font-sans text-slate-100 nf-content-rhythm">
         <div className="cinematic-particles" />
         <div className="forge-frame relative flex items-center justify-between gap-4 overflow-hidden rounded-[28px] p-6 backdrop-blur-xl md:p-8">
         <div className="absolute -z-10 h-64 w-64 top-0 right-0 bg-sky-200/20 blur-[100px]" />
         <div className="space-y-1">
            <div className="flex items-center gap-3">
               <div className="h-1 w-8 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]" />
               <span className="nf-type-eyebrow text-slate-300">Crypto</span>
            </div>
            <h1 className="nf-type-title text-slate-100">
               Crypto terminal
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="forge-panel flex flex-col items-end rounded-2xl px-6 py-3">
               <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500 opacity-80">Network latency</span>
               <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-widest text-sky-300">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.6)]" /> 12ms stable
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
         <div className="forge-frame col-span-12 relative overflow-hidden rounded-[24px] p-4">
            <div className="flex gap-12 animate-[ticker_30s_linear_infinite] whitespace-nowrap items-center">
               {[...assets, ...assets].map((asset, i) => (
                  <div key={i} className="flex items-center gap-4">
                     <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{asset.symbol}</span>
                     <span className="text-sm font-semibold text-slate-100">${asset.price.toLocaleString()}</span>
                     <span className={cn(
                        "text-[10px] font-semibold",
                        asset.volatility > 0.05 ? "text-rose-400" : "text-sky-300"
                     )}>
                        {asset.volatility > 0.05 ? "DOWN" : "UP"} {(asset.volatility * 10).toFixed(2)}%
                     </span>
                  </div>
               ))}
            </div>
         </div>

         <div className="col-span-12 lg:col-span-8 space-y-1">
            <div className="forge-frame relative overflow-hidden rounded-[28px] p-8 backdrop-blur-2xl md:p-10">
               <div className="pointer-events-none absolute top-0 right-0 p-8 opacity-[0.04]">
                  <BarChart3 className="w-64 h-64 text-sky-300" />
               </div>

               <div className="flex flex-col space-y-10 relative z-10">
                  <div className="flex justify-between items-end">
                     <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 opacity-70">Exchange</p>
                        <h2 className="text-3xl font-semibold tracking-tight text-slate-100">Asset exchange</h2>
                     </div>
                     <div className="text-right">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Liquidity pool</p>
                        <p className="text-xl font-semibold text-amber-300">{(economy?.balance || 0).toLocaleString()} NC</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                     <div className="forge-panel space-y-4 rounded-[28px] p-6">
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                           <span>From</span>
                           <span>Nexus coin</span>
                        </div>
                        <input 
                           type="text" 
                           value={swapAmount}
                           onChange={(e) => setSwapAmount(e.target.value)}
                           className="w-full bg-transparent text-4xl font-semibold tracking-tight text-slate-100 outline-none placeholder:text-slate-300 font-mono"
                           placeholder="0,000"
                        />
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 opacity-60">Fee: 0.5%</p>
                     </div>

                     <div className="flex justify-center">
                        <div className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-slate-700/70 bg-slate-900 shadow-sm transition-transform hover:rotate-180 nf-interact">
                           <ArrowRightLeft className="w-6 h-6 text-slate-300" />
                        </div>
                     </div>

                     <div className="forge-panel space-y-4 rounded-[28px] p-6">
                        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                           <label htmlFor="asset-select">To</label>
                           <select 
                              id="asset-select"
                              title="Select Target Crypto Asset"
                              className="cursor-pointer bg-transparent text-slate-100 outline-none"
                              value={selectedAsset?.symbol || ""}
                              onChange={(e) => setSelectedAsset(assets.find(a => a.symbol === e.target.value) || null)}
                           >
                              {assets.map(a => <option key={a.symbol} value={a.symbol} className="bg-slate-900">{a.symbol}</option>)}
                           </select>
                        </div>
                        <div className="flex items-baseline gap-2">
                           <span className="text-4xl font-semibold tracking-tight text-sky-300">
                              {selectedAsset && swapAmount ? (Number(swapAmount) / selectedAsset.price * 0.995).toFixed(4) : "0.0000"}
                           </span>
                           <span className="text-xs font-semibold text-slate-500">{selectedAsset?.symbol}</span>
                        </div>
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 opacity-60">Estimated value: ${(selectedAsset?.price || 0).toLocaleString()}</p>
                     </div>
                  </div>

                  {lastTxId && (
                     <div className="flex items-center gap-4 rounded-[24px] border border-sky-400/40 bg-sky-500/10 p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ShieldCheck className="w-6 h-6 text-sky-300" />
                        <div className="space-y-0.5">
                           <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-300">Transaction complete</p>
                           <p className="text-xs font-mono text-slate-200 opacity-90">Hash: {lastTxId}</p>
                        </div>
                     </div>
                  )}

                  <button 
                     disabled={swapping || !swapAmount}
                     onClick={handleSwap}
                     className={cn(
                        "group relative w-full overflow-hidden rounded-[24px] py-6 text-lg font-semibold uppercase tracking-[0.28em] transition-all",
                        swapping || !swapAmount ? "bg-slate-800 text-slate-500" : "bg-amber-500 text-slate-950 hover:bg-amber-400 nf-interact"
                     )}
                  >
                     {swapping ? (
                        <div className="flex items-center justify-center gap-4">
                           <Loader2 className="w-6 h-6 animate-spin" />
                           Processing swap...
                        </div>
                     ) : (
                        "Initiate exchange"
                     )}
                     <div className="absolute top-0 right-0 h-full w-32 -skew-x-[45deg] translate-x-32 bg-slate-900/20 transition-transform duration-700 group-hover:translate-x-[-400px]" />
                  </button>
               </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
               {assets.map(asset => (
                  <div key={asset.symbol} className="forge-frame group cursor-pointer space-y-6 rounded-[28px] p-8 transition-colors hover:bg-slate-900 nf-interact" onClick={() => setSelectedAsset(asset)}>
                     <div className="flex items-start justify-between">
                        <div className="space-y-1">
                           <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 opacity-60">{asset.symbol}</span>
                           <h4 className="text-2xl font-semibold tracking-tight text-slate-100 transition-colors group-hover:text-sky-600">{asset.name}</h4>
                        </div>
                        <div className={cn(
                           "rounded-full border px-2 py-1 text-[9px] font-semibold uppercase",
                           asset.volatility > 0.05 ? "border-rose-400/50 text-rose-300" : "border-sky-400/50 text-sky-300"
                        )}>
                           {asset.volatility > 0.05 ? "Volatile" : "Stable"}
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="flex items-end justify-between">
                           <span className="text-[10px] font-semibold uppercase text-slate-500">Unit price</span>
                           <span className="text-2xl font-semibold tracking-tight text-slate-100">${asset.price.toLocaleString()}</span>
                        </div>
                        <div className="relative h-1 overflow-hidden bg-slate-700/70">
                           <div 
                              className={cn(
                                 "absolute inset-y-0 left-0 bg-sky-500 transition-all duration-1000",
                                 asset.volatility > 0.8 ? "w-[20%]" : 
                                 asset.volatility > 0.6 ? "w-[40%]" :
                                 asset.volatility > 0.4 ? "w-[60%]" :
                                 asset.volatility > 0.2 ? "w-[80%]" : "w-[95%]"
                              )}
                           />
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <div className="col-span-12 lg:col-span-4 space-y-1">
            <div className="forge-frame relative flex h-full flex-col space-y-10 overflow-hidden rounded-[28px] p-8 backdrop-blur-xl">
               <div className="absolute bottom-0 right-0 h-64 w-64 -z-10 bg-sky-200/20 blur-[80px]" />
               
               <div className="space-y-6">
                  <div className="flex items-center gap-3">
                     <Activity className="w-5 h-5 text-sky-500" />
                     <span className="text-[12px] font-semibold uppercase tracking-[0.3em] text-slate-300">Network pulse</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     {[
                        { label: "Stability", val: "99.98%", color: "text-sky-300" },
                        { label: "Verified", val: "4.2B", color: "text-amber-300" },
                        { label: "Relays", val: "144", color: "text-violet-300" },
                        { label: "Phase", val: "Final", color: "text-slate-100" },
                     ].map(item => (
                        <div key={item.label} className="forge-panel space-y-1.5 rounded-2xl p-4">
                           <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">{item.label}</p>
                           <p className={cn("text-lg font-semibold", item.color)}>{item.val}</p>
                        </div>
                     ))}
                  </div>
               </div>

                  <div className="space-y-6">
                  <div className="flex items-center gap-3">
                     <Globe className="w-5 h-5 text-sky-500" />
                     <span className="text-[12px] font-semibold uppercase tracking-[0.3em] text-slate-300">Global inventory</span>
                  </div>
                     <div className="space-y-1">
                     {assets.map(asset => (
                        <div key={asset.symbol} className="forge-panel group flex items-center justify-between rounded-2xl p-4 nf-interact">
                           <div className="flex flex-col">
                              <span className="text-[10px] font-semibold tracking-widest text-slate-100">{asset.symbol}</span>
                              <span className="text-[8px] font-semibold uppercase text-slate-500">{asset.name.split(' ')[0]}</span>
                           </div>
                           <div className="text-right">
                              <p className="text-sm font-semibold text-slate-100">{(Number(asset.currentSupply)/1000000).toFixed(1)}M</p>
                              <div className="mt-1 h-1 w-16 bg-slate-700/70">
                                 <div 
                                    className={cn(
                                       "h-full bg-sky-500 transition-all",
                                       Number(asset.currentSupply)/Number(asset.supplyLimit) > 0.8 ? "w-[80%]" :
                                       Number(asset.currentSupply)/Number(asset.supplyLimit) > 0.6 ? "w-[60%]" :
                                       Number(asset.currentSupply)/Number(asset.supplyLimit) > 0.4 ? "w-[40%]" :
                                       Number(asset.currentSupply)/Number(asset.supplyLimit) > 0.2 ? "w-[20%]" : "w-[5%]"
                                    )} 
                                 />
                              </div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="mt-auto space-y-6">
                  <div className="space-y-4 rounded-2xl border border-violet-400/40 bg-violet-500/10 p-6">
                     <div className="flex items-center gap-3 text-violet-300">
                        <Lock className="w-4 h-4" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest">Protocol security</span>
                     </div>
                     <p className="text-[10px] font-medium leading-relaxed text-slate-300 uppercase tracking-tighter">
                        Transactions still use strong hashing and proof checks, but the experience stays visually quiet.
                     </p>
                  </div>
                  <button className="w-full rounded-full border border-slate-700/70 bg-slate-900 py-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-200 transition-colors hover:bg-slate-900/70 nf-interact">
                     View registry
                  </button>
               </div>
            </div>
         </div>
      </div>

      <style jsx global>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
