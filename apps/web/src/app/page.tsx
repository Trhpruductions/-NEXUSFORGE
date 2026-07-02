import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Shield, Globe, Terminal, Box, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="h-screen w-screen overflow-y-auto overflow-x-hidden bg-[#050207] text-[#e2e2e2] selection:bg-amber-500 selection:text-black scroll-smooth">
      {/* Decorative Grid Overlay */}
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none" />

      <header className="fixed top-0 left-0 right-0 h-[80px] z-50 bg-black/40 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto h-full px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 border border-amber-500/30 flex items-center justify-center p-2 nexus-corner-tick bg-amber-500/5 group">
                <Image 
                  src="/app-images/all-images/nexusforge-logo.png" 
                  alt="Nexus" 
                  width={24} 
                  height={24} 
                  className="filter brightness-125" 
                />
             </div>
             <span className="text-[12px] font-black uppercase tracking-[0.4em] text-white">Nexus_Forge</span>
          </div>
          <nav className="hidden md:flex items-center gap-10">
            {["Engine", "Telemetry", "Privacy", "Docs"].map(n => (
              <Link key={n} href={`/${n.toLowerCase()}`} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-colors">
                {n}
              </Link>
            ))}
          </nav>
          <Link href="/app" className="px-6 py-3 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition-all shadow-[0_0_30px_rgba(251,191,36,0.2)]">
            Initialize Deck
          </Link>
        </div>
      </header>

      <main className="relative pt-[180px] px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-24 items-center mb-32">
          <div className="space-y-12">
            <div className="flex items-center gap-4">
               <div className="w-12 h-[1px] bg-amber-500 shadow-[0_0_10px_rgba(251,191,36,0.6)]" />
               <span className="text-[10px] font-black text-amber-500 uppercase tracking-[0.5em]">Protocol_V2 Ready</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black uppercase leading-tight italic tracking-tighter text-white">
              Industrial <br/> <span className="text-amber-500">Command</span> <br/> Architecture.
            </h1>
            
            <p className="max-w-xl text-lg text-slate-400 leading-relaxed uppercase tracking-wide font-medium">
              A high-precision command deck for squads and studios. <br/>
              Zero clutter. Hardened security. Infinite scalability.
            </p>

            <div className="flex flex-wrap gap-6">
               <Link href="/app" className="group flex items-center gap-4 px-10 py-6 bg-white text-black font-black uppercase tracking-widest text-[11px] hover:bg-amber-500 transition-all shadow-[0_0_50px_rgba(255,255,255,0.1)]">
                  Enter Command Node
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
               </Link>
               <Link href="/pricing" className="flex items-center gap-4 px-10 py-6 border border-white/10 text-white font-black uppercase tracking-widest text-[11px] hover:bg-white/5 transition-all">
                  Access Core+
               </Link>
            </div>

            <div className="flex items-center gap-10 pt-8 opacity-40 grayscale hover:grayscale-0 transition-all">
               <Image src="/app-images/all-images/intel-logo.png" alt="Intel" width={80} height={20} className="object-contain" />
               <Image src="/app-images/all-images/nvidia-logo.png" alt="Nvidia" width={80} height={20} className="object-contain" />
               <Image src="/app-images/all-images/amd-logo.png" alt="AMD" width={80} height={20} className="object-contain" />
            </div>
          </div>

          <div className="relative aspect-square">
             <div className="absolute inset-0 border border-amber-500/20 rotate-12 scale-90" />
             <div className="absolute inset-0 border border-white/5 -rotate-12 scale-95" />
             <div className="relative w-full h-full bg-[#0d0a13] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.8)] flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 scanline-overlay pointer-events-none opacity-20" />
                <div className="z-10 text-center space-y-8">
                   <div className="w-24 h-24 mx-auto border-2 border-amber-500 p-4 animate-pulse">
                      <Terminal className="w-full h-full text-amber-500" />
                   </div>
                   <div className="space-y-2">
                      <p className="text-[12px] font-black text-white uppercase tracking-[0.5em]">Auth_Tunnel</p>
                      <p className="text-[10px] font-mono text-emerald-500">0xNexus_Initialized_v2</p>
                   </div>
                </div>
             </div>
          </div>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-1 px-1 bg-white/5 border border-white/5 mb-40">
           {[
             { title: "Hardened Privacy", desc: "One-way IP hashing & AES-256 data mesh.", icon: Shield },
             { title: "Grid Performance", desc: "React 19 + Turbopack industrial-ready engine.", icon: Zap },
             { title: "Module Ecosystem", desc: "Deploy servers, voice pods, and asset vaults.", icon: Box },
           ].map(f => (
             <div key={f.title} className="p-12 bg-[#050207] space-y-6 hover:bg-black transition-colors group">
                <div className="w-10 h-10 flex items-center justify-center border border-white/10 text-slate-500 group-hover:border-amber-500/50 group-hover:text-amber-500 transition-all">
                   <f.icon className="w-5 h-5" />
                </div>
                <h3 className="text-[13px] font-black text-white uppercase tracking-widest">{f.title}</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-loose">{f.desc}</p>
             </div>
           ))}
        </section>
      </main>

      <footer className="py-20 border-t border-white/5 px-8">
         <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex items-center gap-4">
                <div className="w-8 h-8 border border-white/10 flex items-center justify-center text-[10px] font-black rotate-45">
                   <span className="-rotate-45">NF</span>
                </div>
                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.4em]">Integrated_Command &copy; 2026</p>
            </div>
            <div className="flex gap-8">
               {["Terms", "Privacy", "Support", "Status"].map(l => (
                  <Link key={l} href="#" className="text-[9px] font-black text-slate-600 hover:text-white uppercase tracking-widest transition-colors">{l}</Link>
               ))}
            </div>
         </div>
      </footer>
    </div>
  );
}
