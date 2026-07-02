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
    <div className="flex flex-col gap-1 select-none font-sans">
      {/* INDUSTRIAL HEADER */}
      <div className="p-8 border border-white/10 bg-black/60 flex items-center justify-between nexus-corner-tick relative overflow-hidden backdrop-blur-xl">
         <div className="absolute top-0 right-0 w-64 h-64 bg-nexus-purple/10 blur-[100px] -z-10" />
         <div className="space-y-1">
            <div className="flex items-center gap-3">
               <div className="w-8 h-1 bg-nexus-purple shadow-[0_0_10px_#a855f7]" />
               <span className="text-[10px] font-black text-nexus-purple uppercase tracking-[0.4em]">Crypto_Operations_Core</span>
            </div>
            <h1 className="text-4xl font-black uppercase text-white italic tracking-tighter drop-shadow-lg">
               Industrial_<span className="text-nexus-purple nexus-text-vibrant">Terminal_v2.0</span>
            </h1>
         </div>
         <div className="flex gap-4">
            <div className="px-6 py-3 border border-white/10 bg-white/5 flex flex-col items-end nexus-corner-tick">
               <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest opacity-80">Network_Latency</span>
               <span className="text-[12px] text-nexus-cyan font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="w-2 h-2 bg-nexus-cyan animate-pulse shadow-[0_0_8px_#00f2ff]" /> 12MS_STABLE
               </span>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-12 gap-1">
         {/* ASSET TICKER TAPE */}
         <div className="col-span-12 p-4 border border-white/10 bg-black/40 overflow-hidden relative">
            <div className="flex gap-12 animate-[ticker_30s_linear_infinite] whitespace-nowrap items-center">
               {[...assets, ...assets].map((asset, i) => (
                  <div key={i} className="flex items-center gap-4">
                     <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{asset.symbol}</span>
                     <span className="text-sm font-black text-white italic">${asset.price.toLocaleString()}</span>
                     <span className={cn(
                        "text-[10px] font-black",
                        asset.volatility > 0.05 ? "text-nexus-crimson" : "text-nexus-cyan"
                     )}>
                        {asset.volatility > 0.05 ? "⇣" : "⇡"} {(asset.volatility * 10).toFixed(2)}%
                     </span>
                  </div>
               ))}
            </div>
         </div>

         {/* TRADING CORE */}
         <div className="col-span-12 lg:col-span-8 space-y-1">
            <div className="p-10 border border-white/10 bg-black/60 relative overflow-hidden nexus-corner-tick backdrop-blur-2xl">
               <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
                  <BarChart3 className="w-64 h-64 text-nexus-purple" />
               </div>

               <div className="flex flex-col space-y-10 relative z-10">
                  <div className="flex justify-between items-end">
                     <div className="space-y-2">
                        <p className="text-[11px] text-nexus-purple font-black uppercase tracking-widest opacity-70">Execute_Market_Order</p>
                        <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter">Asset_Exchange</h2>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Liquidity_Pool</p>
                        <p className="text-xl font-black text-nexus-gold italic">{(economy?.balance || 0).toLocaleString()} NC</p>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 items-center">
                     {/* FROM: NC */}
                     <div className="p-8 bg-white/5 border border-white/10 nexus-corner-tick space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest">
                           <span>From</span>
                           <span>Nexus_Coin</span>
                        </div>
                        <input 
                           type="text" 
                           value={swapAmount}
                           onChange={(e) => setSwapAmount(e.target.value)}
                           className="w-full bg-transparent text-4xl font-black text-white italic tracking-tighter outline-none placeholder:text-white/10"
                           placeholder="0,000"
                        />
                        <p className="text-[10px] font-black text-nexus-purple opacity-60">FEE: 0.5% INDUSTRIAL_LEVEE</p>
                     </div>

                     <div className="flex justify-center">
                        <div className="w-12 h-12 rounded-none bg-nexus-purple border border-nexus-purple shadow-[0_0_20px_rgba(168,85,247,0.4)] flex items-center justify-center transition-transform hover:rotate-180 cursor-pointer">
                           <ArrowRightLeft className="text-black w-6 h-6" />
                        </div>
                     </div>

                     {/* TO: ASSET */}
                     <div className="p-8 bg-white/5 border border-white/10 nexus-corner-tick space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-500 tracking-widest">
                           <label htmlFor="asset-select">To</label>
                           <select 
                              id="asset-select"
                              title="Select Target Crypto Asset"
                              className="bg-transparent text-white outline-none cursor-pointer"
                              value={selectedAsset?.symbol || ""}
                              onChange={(e) => setSelectedAsset(assets.find(a => a.symbol === e.target.value) || null)}
                           >
                              {assets.map(a => <option key={a.symbol} value={a.symbol} className="bg-black">{a.symbol}</option>)}
                           </select>
                        </div>
                        <div className="flex items-baseline gap-2">
                           <span className="text-4xl font-black text-nexus-cyan italic tracking-tighter">
                              {selectedAsset && swapAmount ? (Number(swapAmount) / selectedAsset.price * 0.995).toFixed(4) : "0.0000"}
                           </span>
                           <span className="text-xs font-black text-slate-500">{selectedAsset?.symbol}</span>
                        </div>
                        <p className="text-[10px] font-black text-nexus-cyan opacity-60">ESTIMATED_VALUE: ${(selectedAsset?.price || 0).toLocaleString()}</p>
                     </div>
                  </div>

                  {lastTxId && (
                     <div className="p-6 bg-nexus-cyan/10 border border-nexus-cyan/30 nexus-corner-tick flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ShieldCheck className="text-nexus-cyan w-6 h-6" />
                        <div className="space-y-0.5">
                           <p className="text-[10px] font-black text-nexus-cyan uppercase tracking-widest">Transaction_Finalized</p>
                           <p className="text-xs font-mono text-white opacity-80">HASH: {lastTxId}</p>
                        </div>
                     </div>
                  )}

                  <button 
                     disabled={swapping || !swapAmount}
                     onClick={handleSwap}
                     className={cn(
                        "w-full py-8 text-xl font-black uppercase italic tracking-[0.4em] transition-all relative overflow-hidden group",
                        swapping || !swapAmount ? "bg-slate-800 text-slate-500" : "bg-nexus-purple text-white hover:bg-white hover:text-black shadow-[0_0_40px_rgba(168,85,247,0.2)]"
                     )}
                  >
                     {swapping ? (
                        <div className="flex items-center justify-center gap-4">
                           <Loader2 className="w-6 h-6 animate-spin" />
                           PROCESSING_INDUSTRIAL_SWAP...
                        </div>
                     ) : (
                        "INITIATE_EXCHANGE_PROTOCOL"
                     )}
                     <div className="absolute top-0 right-0 w-32 h-full bg-white/10 -skew-x-[45deg] translate-x-32 group-hover:translate-x-[-400px] transition-transform duration-700" />
                  </button>
               </div>
            </div>

            {/* ASSET GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
               {assets.map(asset => (
                  <div key={asset.symbol} className="p-8 border border-white/10 bg-black/60 nexus-corner-tick space-y-6 group hover:bg-white/5 transition-all cursor-pointer" onClick={() => setSelectedAsset(asset)}>
                     <div className="flex justify-between items-start">
                        <div className="space-y-1">
                           <span className="text-[10px] text-nexus-purple font-black uppercase tracking-widest opacity-60">{asset.symbol}_INDEX</span>
                           <h4 className="text-2xl font-black text-white uppercase italic tracking-tighter group-hover:text-nexus-purple transition-colors">{asset.name}</h4>
                        </div>
                        <div className={cn(
                           "px-2 py-1 text-[9px] font-black border",
                           asset.volatility > 0.05 ? "border-nexus-crimson/30 text-nexus-crimson" : "border-nexus-cyan/30 text-nexus-cyan"
                        )}>
                           {asset.volatility > 0.05 ? "VOLATILE" : "STABLE"}
                        </div>
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-end">
                           <span className="text-[10px] font-black text-slate-500 uppercase">Unit_Price</span>
                           <span className="text-2xl font-black text-white italic tracking-tighter">${asset.price.toLocaleString()}</span>
                        </div>
                        <div className="h-1 bg-white/5 relative overflow-hidden">
                           <div 
                              className={cn(
                                 "absolute inset-y-0 left-0 bg-nexus-purple transition-all duration-1000",
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

         {/* SIDE TELEMETRY */}
         <div className="col-span-12 lg:col-span-4 space-y-1">
            <div className="p-8 border border-white/10 bg-black/60 h-full nexus-corner-tick backdrop-blur-xl space-y-10 flex flex-col relative overflow-hidden">
               <div className="absolute bottom-0 right-0 w-64 h-64 bg-nexus-cyan/5 blur-[80px] -z-10" />
               
               <div className="space-y-6">
                  <div className="flex items-center gap-3">
                     <Activity className="w-5 h-5 text-nexus-purple" />
                     <span className="text-[12px] font-black text-white uppercase tracking-[0.3em]">Network_Pulse_Diagnostics</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                     {[
                        { label: "Stability", val: "99.98%", color: "text-nexus-cyan" },
                        { label: "Verified", val: "4.2B", color: "text-nexus-gold" },
                        { label: "Relays", val: "144", color: "text-nexus-purple" },
                        { label: "Phase", val: "FINAL", color: "text-white" },
                     ].map(item => (
                        <div key={item.label} className="p-4 border border-white/5 bg-white/5 space-y-1.5 nexus-corner-tick">
                           <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest">{item.label}</p>
                           <p className={cn("text-lg font-black italic", item.color)}>{item.val}</p>
                        </div>
                     ))}
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="flex items-center gap-3">
                     <Globe className="w-5 h-5 text-nexus-cyan" />
                     <span className="text-[12px] font-black text-white uppercase tracking-[0.3em]">Global_Inventory</span>
                  </div>
                  <div className="space-y-1">
                     {assets.map(asset => (
                        <div key={asset.symbol} className="p-4 border border-white/5 bg-black/40 flex justify-between items-center group">
                           <div className="flex flex-col">
                              <span className="text-[10px] font-black text-white tracking-widest">{asset.symbol}</span>
                              <span className="text-[8px] font-black text-slate-500 uppercase">{asset.name.split(' ')[0]}</span>
                           </div>
                           <div className="text-right">
                              <p className="text-sm font-black text-white italic">{(Number(asset.currentSupply)/1000000).toFixed(1)}M</p>
                              <div className="w-16 h-1 bg-white/10 mt-1">
                                 <div 
                                    className={cn(
                                       "h-full bg-nexus-purple transition-all",
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
                  <div className="p-6 bg-nexus-purple/5 border border-nexus-purple/20 space-y-4 nexus-corner-tick">
                     <div className="flex items-center gap-3 text-nexus-purple">
                        <Lock className="w-4 h-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Protocol_Security</span>
                     </div>
                     <p className="text-[10px] text-slate-400 font-medium leading-relaxed uppercase tracking-tighter">
                        NexusForge Industrial Terminal utilizes SHA-512 cryptographic hashing and zero-knowledge proofs for every transaction pulse.
                     </p>
                  </div>
                  <button className="w-full py-5 border border-white/10 text-white font-black uppercase tracking-[0.2em] text-[10px] hover:bg-white hover:text-black transition-all">
                     View_Full_Registry
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
