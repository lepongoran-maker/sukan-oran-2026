import React, { useEffect, useState, useMemo, useRef } from 'react';
import { HouseStats, HouseColor, WinnerProfile, PointsConfig, EventType, Gender, SystemConfig } from '../types';
import { HOUSE_CONFIG, DEFAULT_SYSTEM_CONFIG } from '../constants';
import { activeEvents, getHouseName } from '../utils/systemConfig';
import { generateSportsCommentary } from '../services/geminiService';
import { Mic2, Trophy, Crown, Medal, TrendingUp, Sparkles, ChevronDown, ChevronUp, User, Star, Timer, Sun, Moon, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  stats: HouseStats[];
  results: Record<string, WinnerProfile[]>;
  pointsConfig: PointsConfig;
  systemConfig?: SystemConfig;
}

interface AthleteStats {
  id: string; name: string; house: HouseColor; className: string;
  gold: number; silver: number; bronze: number; fourth: number; fifth: number; sixth: number;
  score: number; totalPointsContributed: number;
  events: Array<{ eventName: string; medal: 'Emas'|'Perak'|'Gangsa'|'Tempat Ke-4'|'Tempat Ke-5'|'Tempat Ke-6'; points: number }>;
  breakdown: { indivGold:number; indivSilver:number; indivBronze:number; indivFourth:number; indivFifth:number; indivSixth:number; relayGold:number; relaySilver:number; relayBronze:number; relayFourth:number; relayFifth:number; relaySixth:number };
}

const HS: Record<HouseColor, { hex: string; glow: string; short: string }> = {
  [HouseColor.MERAH]:  { hex: '#ef4444', glow: 'rgba(239,68,68,0.35)',   short: 'MRH' },
  [HouseColor.BIRU]:   { hex: '#3b82f6', glow: 'rgba(59,130,246,0.35)',  short: 'BRU' },
  [HouseColor.HIJAU]:  { hex: '#22c55e', glow: 'rgba(34,197,94,0.35)',   short: 'HJU' },
  [HouseColor.KUNING]: { hex: '#eab308', glow: 'rgba(234,179,8,0.35)',   short: 'KNG' },
  [HouseColor.UNGU]:   { hex: '#a855f7', glow: 'rgba(168,85,247,0.35)',  short: 'UGU' },
  [HouseColor.OREN]:   { hex: '#f97316', glow: 'rgba(249,115,22,0.35)',  short: 'ORN' },
};

const EVENT_DATE = new Date('2026-05-09T07:00:00');

function useCountdown() {
  const [t, setT] = useState({ days:0, hours:0, minutes:0, seconds:0, started:false });
  useEffect(() => {
    const tick = () => {
      const diff = EVENT_DATE.getTime() - Date.now();
      if (diff <= 0) { setT({ days:0,hours:0,minutes:0,seconds:0,started:true }); return; }
      setT({ days:Math.floor(diff/86400000), hours:Math.floor((diff%86400000)/3600000), minutes:Math.floor((diff%3600000)/60000), seconds:Math.floor((diff%60000)/1000), started:false });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

const CCOLORS = ['#f59e0b','#ef4444','#3b82f6','#22c55e','#a855f7','#f97316','#fff','#fbbf24'];

function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(() => Array.from({length:80},(_,i)=>({
    id:i, left:Math.random()*100, size:6+Math.random()*8,
    delay:Math.random()*2, color:CCOLORS[Math.floor(Math.random()*CCOLORS.length)], isCircle:Math.random()>0.5
  })),[]);
  if (!active) return null;
  return (
    <>
      {pieces.map(p => (
        <motion.div key={p.id}
          initial={{ y:-20, x:0, opacity:1, rotate:0 }}
          animate={{ y:'110vh', x:(Math.random()-0.5)*300, opacity:[1,1,0], rotate:Math.random()*720 }}
          transition={{ duration:3+Math.random()*2, delay:p.delay, ease:'easeIn' }}
          style={{ position:'fixed', left:`${p.left}%`, top:0, width:p.size, height:p.size, background:p.color, zIndex:9999, pointerEvents:'none', borderRadius:p.isCircle?'50%':2 }}
        />
      ))}
    </>
  );
}

// Progress bar untuk berita - auto advance 10 saat
const NewsProgress: React.FC<{onComplete:()=>void}> = ({onComplete}) => {
  useEffect(()=>{
    const id = setTimeout(onComplete, 10000);
    return ()=>clearTimeout(id);
  },[onComplete]);
  return (
    <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5">
      <motion.div initial={{width:0}} animate={{width:'100%'}} transition={{duration:10,ease:'linear'}}
        className="h-full" style={{background:'linear-gradient(90deg,#f59e0b,#fbbf24)'}}/>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ stats, results, pointsConfig, systemConfig = DEFAULT_SYSTEM_CONFIG }) => {
  const [commentary, setCommentary] = useState("Sistem AI sedang menganalisis keputusan terkini...");
  const [showFullLeaderboard, setShowFullLeaderboard] = useState(false);
  const [expandedAthletes, setExpandedAthletes] = useState<Record<string,boolean>>({});
  const [newsFeed, setNewsFeed] = useState<string[]>([]);
  const [newsIdx, setNewsIdx] = useState(0);
  const [confetti, setConfetti] = useState(false);
  const [prevLeader, setPrevLeader] = useState<HouseColor|null>(null);
  const [activeYear, setActiveYear] = useState(1);
  const [isDark, setIsDark] = useState(true);
  const isMounted = useRef(false);
  const countdown = useCountdown();

  const sortedStats = useMemo(() => [...stats].sort((a,b)=>b.totalPoints-a.totalPoints), [stats]);
  const leader = sortedStats[0];
  const maxPts = leader?.totalPoints || 1;

  useEffect(() => {
    if (leader?.totalPoints > 0) {
      if (prevLeader && prevLeader !== leader.house) {
        setConfetti(true);
        setTimeout(() => setConfetti(false), 5000);
      }
      setPrevLeader(leader.house);
    }
  }, [leader?.house]);

  useEffect(() => {
    const id = setTimeout(() => handleGenerateCommentary(), 6000);
    if (!isMounted.current) isMounted.current = true;
    return () => clearTimeout(id);
  }, [stats]);

  const handleGenerateCommentary = async () => {
    const text = await generateSportsCommentary(stats);
    setCommentary(text);
  };

  const topAthletes = useMemo(() => {
    const cats: Record<string,Record<string,AthleteStats>> = {};
    [1,2,3,4,5,6].forEach(y => [Gender.LELAKI,Gender.PEREMPUAN].forEach(g => { cats[`${y}_${g}`]={}; }));
    const allEvts = activeEvents(systemConfig);
    (Object.entries(results) as [string,WinnerProfile[]][]).forEach(([key,winners]) => {
      const parts = key.split('_');
      const gStr = parts.pop(); const yStr = parts.pop();
      const year = parseInt(yStr||'0'); const gender = gStr as Gender;
      const eventId = parts.join('_');
      const evDef = allEvts.find(e=>e.id===eventId);
      const evName = evDef?evDef.name:eventId;
      if (year===0||!cats[`${year}_${gender}`]) return;
      const isRelay = evDef?.type===EventType.RELAY;
      const isTT = evDef?.id==='khas_tariktali';
      const isKhusus = evDef?.type===EventType.KHUSUS;
      // Skip semua acara KHUSUS (sukantara, tarik tali, dll) — hanya kira individu & relay
      if (isKhusus) return;
      let ps = pointsConfig.individu;
      if (isRelay) ps=pointsConfig.relay;
      if (isTT) ps=pointsConfig.tarikTali;
      winners.forEach((w,idx) => {
        let aps: {name:string;className:string;house:HouseColor}[] = [];
        if (w.teamMembers?.length>0) aps=w.teamMembers.map(m=>({name:m.name,className:m.className,house:w.house}));
        else { if(!w.name||w.name.startsWith('Pasukan ')||w.name.startsWith('Wakil ')||w.name.includes('Tanpa Nama')||w.name.startsWith('Rumah ')) return; aps.push({name:w.name,className:w.className,house:w.house}); }
        const ap = ps[idx]||0;
        aps.forEach(ao => {
          const sn=ao.name.trim(); const sc=(ao.className||'').trim();
          const aid=`${sn.toLowerCase()}_${ao.house}`;
          if (!cats[`${year}_${gender}`][aid]) {
            cats[`${year}_${gender}`][aid]={id:aid,name:sn,house:ao.house,className:sc,gold:0,silver:0,bronze:0,fourth:0,fifth:0,sixth:0,score:0,totalPointsContributed:0,events:[],breakdown:{indivGold:0,indivSilver:0,indivBronze:0,indivFourth:0,indivFifth:0,indivSixth:0,relayGold:0,relaySilver:0,relayBronze:0,relayFourth:0,relayFifth:0,relaySixth:0}};
          } else {
            const ec=cats[`${year}_${gender}`][aid].className;
            if (sc&&ec&&!ec.includes(sc)) cats[`${year}_${gender}`][aid].className=`${ec} / ${sc}`;
            else if (!ec&&sc) cats[`${year}_${gender}`][aid].className=sc;
          }
          const ath=cats[`${year}_${gender}`][aid];
          let medal:AthleteStats['events'][0]['medal']|null=null;
          if(idx===0){ath.gold++;medal='Emas';if(isRelay)ath.breakdown.relayGold++;else ath.breakdown.indivGold++;}
          else if(idx===1){ath.silver++;medal='Perak';if(isRelay)ath.breakdown.relaySilver++;else ath.breakdown.indivSilver++;}
          else if(idx===2){ath.bronze++;medal='Gangsa';if(isRelay)ath.breakdown.relayBronze++;else ath.breakdown.indivBronze++;}
          else if(idx===3){ath.fourth++;medal='Tempat Ke-4';if(isRelay)ath.breakdown.relayFourth++;else ath.breakdown.indivFourth++;}
          else if(idx===4){ath.fifth++;medal='Tempat Ke-5';if(isRelay)ath.breakdown.relayFifth++;else ath.breakdown.indivFifth++;}
          else if(idx===5){ath.sixth++;medal='Tempat Ke-6';if(isRelay)ath.breakdown.relaySixth++;else ath.breakdown.indivSixth++;}
          ath.score=(ath.breakdown.indivGold*1e18)+(ath.breakdown.indivSilver*1e15)+(ath.breakdown.indivBronze*1e12)+(ath.breakdown.indivFourth*1e9)+(ath.breakdown.indivFifth*1e6)+(ath.breakdown.indivSixth*1e3)+(ath.breakdown.relayGold*100)+(ath.breakdown.relaySilver*10)+ath.breakdown.relayBronze;
          ath.totalPointsContributed+=ap;
          if(medal) ath.events.push({eventName:evName,medal,points:ap});
        });
      });
    });
    const sc: Record<string,AthleteStats[]>={};
    Object.entries(cats).forEach(([k,v])=>{ sc[k]=Object.values(v).sort((a,b)=>b.score-a.score).slice(0,10); });
    return sc;
  }, [results, pointsConfig, systemConfig]);




  useEffect(()=>{
    const items:string[]=[];
    if(sortedStats.length>0){
      items.push(`PENDAHULU: Rumah ${getHouseName(systemConfig, sortedStats[0].house)} memimpin dengan ${sortedStats[0].totalPoints} mata!`);
      if(sortedStats.length>1){const d=sortedStats[0].totalPoints-sortedStats[1].totalPoints;if(d<50)items.push(`PERSAINGAN SENGIT! Rumah ${getHouseName(systemConfig, sortedStats[1].house)} hanya ${d} mata di belakang!`);}
    }
    const allTop:AthleteStats[]=[];
    Object.values(topAthletes as Record<string,AthleteStats[]>).forEach(l=>{if(l.length>0)allTop.push(l[0]);});
    if(allTop.length>0){[...allTop].sort(()=>0.5-Math.random()).slice(0,2).forEach(a=>{if(a.gold>0)items.push(`ATLET TUMPUAN: ${a.name} (${getHouseName(systemConfig, a.house)}) — ${a.gold} Emas!`);});}
    const rk=Object.keys(results);
    if(rk.length>0){const k=rk[Math.floor(Math.random()*rk.length)];const w=results[k];if(w?.length>0){const parts=k.split('_');const eid=parts.slice(0,parts.length-2).join('_');const ed=activeEvents(systemConfig).find(e=>e.id===eid);items.push(`KEPUTUSAN: ${w[0].name} (${getHouseName(systemConfig, w[0].house)}) memenangi Emas dalam ${ed?.name||'Acara'}!`);}}
    if(commentary&&!commentary.includes("sedang menganalisis")&&!commentary.includes("Ralat"))items.push(`ULASAN AI: "${commentary}"`);
    else items.push("SISTEM: Data dikemaskini secara langsung...");
    // Ulasan menarik kejohanan - pelbagai kategori
    const ulasanSuasana = [
      "🔥 SUASANA MERIAH — Padang olahraga hari ini dipenuhi dengan semangat juang yang membara! Sorak sorei penonton memecah kesunyian pagi, memberikan tenaga tambahan kepada para atlet yang beraksi.",
      "🏟️ GEGAK GEMPITA — Kejohanan Olahraga Tahunan SEPUTRA 2026 semakin sengit! Setiap acara yang berlangsung menyaksikan persaingan yang amat ketat antara rumah-rumah sukan terbaik sekolah.",
      "🌅 SEMANGAT MEMBARA — Sejak awal pagi lagi, para atlet telah menunjukkan komitmen dan dedikasi yang luar biasa. Latihan keras selama berbulan-bulan kini terbayar di pentas kejohanan!",
    ];
    const ulasanPersaingan = [
      "⚡ PERSAINGAN MEMBARA — Perbezaan mata antara rumah-rumah sukan teratas amat tipis! Setiap acara yang belum selesai boleh mengubah keseluruhan kedudukan. Jangan lepaskan pandangan dari papan mata!",
      "🎯 DETIK KRITIKAL — Dengan berbaki beberapa acara lagi, mana-mana rumah sukan masih berpeluang mengubah nasib mereka. Satu kemenangan boleh membawa perbezaan besar dalam kiraan akhir!",
      "🏆 PERTARUNGAN SENGIT — Rumah-rumah sukan terkemuka terus bersaing sengit demi merebut takhta juara keseluruhan. Semua mata tertumpu kepada mereka yang akan muncul sebagai jaguh pada penghujung hari!",
    ];
    const ulasanAtlet = [
      "💪 KESUNGGUHAN ATLET — Para atlet muda SK ORAN membuktikan bahawa latihan yang berdisiplin menghasilkan prestasi cemerlang. Tahniah kepada semua peserta yang telah berani bertanding!",
      "🌟 BAKAT MASA DEPAN — Kejohanan ini bukan sahaja tentang pingat, tetapi tentang melahirkan atlet-atlet berbakat yang akan mewakili sekolah pada peringkat yang lebih tinggi pada masa hadapan.",
      "🎖️ SEMANGAT SUKAN — Nilai-nilai murni sukan seperti semangat berpasukan, disiplin diri, dan sportifniti telah dipamerkan oleh semua peserta. Inilah hakikat sebenar kejohanan yang bermakna!",
    ];
    const ulasanGuru = [
      "👨‍🏫 SOKONGAN GURU — Para guru pengiring dan jurulatih telah memberikan bimbingan tanpa jemu kepada anak-anak didik mereka. Dedikasi mereka adalah tunjang kejayaan para atlet di padang hari ini.",
      "📣 SEMANGAT BERPASUKAN — Rumah sukan yang berjaya bukan sekadar bergantung kepada atlet terbaik, tetapi kepada semangat kolektif seluruh ahli pasukan. Bersama kita teguh, bercerai kita roboh!",
    ];
    const allUlasan = [...ulasanSuasana, ...ulasanPersaingan, ...ulasanAtlet, ...ulasanGuru];
    // Tambah 3 ulasan berbeza setiap kali
    const shuffled = [...allUlasan].sort(()=>0.5-Math.random());
    shuffled.slice(0,3).forEach(u => items.push(u));
    setNewsFeed(Array.from(new Set(items)));
  },[stats,results,topAthletes,commentary,systemConfig]);

  useEffect(()=>{
    if(newsFeed.length<=1)return;
    const id=setInterval(()=>setNewsIdx(p=>(p+1)%newsFeed.length),10000);
    return ()=>clearInterval(id);
  },[newsFeed.length]);

  const curNews=newsFeed[newsIdx]||"Memuatkan berita terkini...";

  // Medal label helpers
  const medalLabel = (idx:number) => ['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣'][idx]||`${idx+1}`;

  return (
    <div className={`min-h-screen overflow-x-hidden relative font-sans transition-colors duration-500 ${isDark?'bg-[#06080f] text-slate-100':'bg-[#f0f4f8] text-slate-800'}`}>
      <Confetti active={confetti}/>

      {/* AMBIENT BG */}
      <div className={`fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-500 ${isDark?'opacity-100':'opacity-30'}`}>
        <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-yellow-600/5 rounded-full blur-[150px]"/>
        <div className="absolute bottom-1/3 right-0 w-[400px] h-[400px] bg-amber-500/4 rounded-full blur-[120px]"/>
        {[...Array(15)].map((_,i)=>(
          <motion.div key={i} animate={{opacity:[0,0.5,0],y:[0,-40,-80]}} transition={{duration:5+Math.random()*4,delay:Math.random()*8,repeat:Infinity}}
            className="absolute w-0.5 h-0.5 bg-yellow-400 rounded-full" style={{left:`${Math.random()*100}%`,top:`${Math.random()*100}%`}}/>
        ))}
      </div>

      <div className="relative z-10 max-w-[1600px] mx-auto px-3 sm:px-4 lg:px-8 py-4 lg:py-6 space-y-5">

        {/* ═══ HERO HEADER — INSPIRED BY PDF STYLE ═══ */}
        <motion.div initial={{opacity:0,y:-30}} animate={{opacity:1,y:0}} transition={{duration:0.7}}
          className="relative rounded-2xl lg:rounded-3xl overflow-hidden"
          style={{background:'linear-gradient(160deg,#071020 0%,#0c1a30 50%,#071020 100%)'}}>

          {/* Jalur 6 warna rumah atas */}
          <div className="absolute top-0 left-0 right-0 flex h-[4px] z-10">
            {['#ef4444','#3b82f6','#22c55e','#eab308','#a855f7','#f97316'].map((c,i)=>(
              <motion.div key={i} initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.3+i*0.08,duration:0.5}}
                className="flex-1 origin-left" style={{background:c}}/>
            ))}
          </div>

          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.02]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',backgroundSize:'30px 30px'}}/>

          {/* Glow ambient */}
          <div className="absolute top-0 left-1/4 w-64 h-64 rounded-full blur-[80px] opacity-10" style={{background:'#3b82f6'}}/>
          <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full blur-[80px] opacity-8" style={{background:'#f59e0b'}}/>

          <div className="relative flex flex-col lg:flex-row pt-1">

            {/* ── LEFT: Sekolah + Event ── */}
            <div className="flex-1 flex flex-col">

              {/* Row 1: Nama kejohanan + Live + Toggle */}
              <div className="flex items-center justify-between gap-3 px-5 lg:px-8 pt-5 pb-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-6 rounded-full flex-shrink-0" style={{background:'linear-gradient(180deg,#f59e0b,#ef4444)'}}/>
                  <p className="text-xs sm:text-base lg:text-xl font-black uppercase tracking-widest text-white">Kejohanan Olahraga Tahunan</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"/>Live
                  </span>
                  <button onClick={()=>setIsDark(!isDark)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all"
                    style={{background:isDark?'rgba(251,191,36,0.1)':'rgba(59,130,246,0.15)',border:isDark?'1px solid rgba(251,191,36,0.3)':'1px solid rgba(59,130,246,0.4)'}}>
                    {isDark?(<><Sun className="w-3.5 h-3.5 text-yellow-400"/><span className="text-[10px] font-black text-yellow-400 hidden sm:block">Day</span></>):(<><Moon className="w-3.5 h-3.5 text-blue-400"/><span className="text-[10px] font-black text-blue-400 hidden sm:block">Night</span></>)}
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-5 lg:mx-8 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)'}}/>

              {/* Row 2: Logo + Nama sekolah + Edisi */}
              <div className="flex items-center gap-3 px-4 lg:px-8 py-3 lg:py-5">
                <motion.div initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}} transition={{delay:0.3,type:'spring',stiffness:150}} className="relative flex-shrink-0">
                  <div className="w-14 h-14 sm:w-20 sm:h-20 lg:w-28 lg:h-28 rounded-full overflow-hidden flex items-center justify-center"
                    style={{background:'rgba(255,255,255,0.08)',border:'2px solid rgba(255,255,255,0.15)',boxShadow:'0 0 20px rgba(59,130,246,0.2)'}}>
                    <img src="/logo-sekolah-oran-transparent.png?v=2" alt="Logo SK ORAN" className="w-full h-full object-contain p-1" onError={e=>{e.currentTarget.style.display='none';}}/>
                  </div>
                  <motion.div animate={{rotate:360}} transition={{duration:15,repeat:Infinity,ease:'linear'}}
                    className="absolute -inset-1 rounded-full border border-dashed opacity-30" style={{borderColor:'#3b82f6'}}/>
                </motion.div>
                <div className="flex-1">
                  <h1 className="text-lg sm:text-2xl lg:text-4xl font-black uppercase tracking-wide text-white leading-tight" style={{textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>SK ORAN</h1>
                  <div className="hidden sm:flex items-center gap-2 mt-1.5">
                    <div className="h-px w-5" style={{background:'#f59e0b'}}/>
                    <p className="text-sm font-semibold italic" style={{color:'#fbbf24'}}>Berilmu, Berusaha, Berbakti</p>
                    <div className="h-px w-5" style={{background:'#f59e0b'}}/>
                  </div>
                </div>
                <div className="flex-shrink-0 text-center rounded-xl px-2 sm:px-4 py-2" style={{background:'rgba(245,158,11,0.1)',border:'1.5px solid rgba(245,158,11,0.4)',boxShadow:'0 0 12px rgba(245,158,11,0.15)'}}>
                  <div className="text-xs font-black uppercase tracking-widest" style={{color:'#fbbf24'}}>Edisi</div>
                  <div className="text-2xl lg:text-4xl font-black leading-none" style={{color:'#fbbf24',textShadow:'0 0 15px rgba(245,158,11,0.5)'}}>2026</div>
                </div>
              </div>

              {/* Divider */}
              <div className="mx-5 lg:mx-8 h-px" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)'}}/>

              {/* Row 3: Siaran besar */}
              <div className="px-5 lg:px-8 py-4 flex-1 flex flex-col justify-center">
                <div className="relative rounded-2xl overflow-hidden flex items-stretch h-full min-h-[80px]"
                  style={{background:'rgba(0,0,0,0.35)',border:'1px solid rgba(255,255,255,0.08)',backdropFilter:'blur(8px)',minHeight:'64px'}}>
                  {/* Label */}
                  <div className="flex flex-col items-center justify-center px-4 gap-1.5 flex-shrink-0"
                    style={{borderRight:'1px solid rgba(255,255,255,0.07)',background:'linear-gradient(180deg,rgba(245,158,11,0.12),rgba(245,158,11,0.05))'}}>
                    <Mic2 className="w-4 h-4 text-yellow-400 animate-pulse"/>
                    <span className="text-xs font-black uppercase tracking-widest" style={{color:'rgba(251,191,36,0.8)'}}>Siaran</span>
                  </div>
                  {/* Teks berita */}
                  <div className="flex-1 px-5 flex items-center overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.p key={newsIdx}
                        initial={{x:30,opacity:0}} animate={{x:0,opacity:1}} exit={{x:-30,opacity:0}}
                        transition={{duration:0.4}}
                        className="text-xs lg:text-sm font-medium text-slate-200 leading-snug">
                        {curNews}
                      </motion.p>
                    </AnimatePresence>
                  </div>
                  {/* Butang next + counter */}
                  <div className="flex flex-col items-center justify-center px-3 gap-2 flex-shrink-0"
                    style={{borderLeft:'1px solid rgba(255,255,255,0.07)'}}>
                    <button onClick={()=>setNewsIdx(p=>(p+1)%newsFeed.length)}
                      className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-yellow-500/20"
                      style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)'}}>
                      <ChevronRight className="w-4 h-4 text-yellow-400"/>
                    </button>
                    <span className="text-[9px] font-bold text-slate-600">{newsIdx+1}/{newsFeed.length||1}</span>
                  </div>
                  {/* Progress bar bawah */}
                  <NewsProgress key={newsIdx} onComplete={()=>setNewsIdx(p=>(p+1)%newsFeed.length)}/>
                </div>
              </div>

              {/* Jalur 6 warna bawah kiri */}
              <div className="flex h-[3px]">
                {['#ef4444','#3b82f6','#22c55e','#eab308','#a855f7','#f97316'].map((c,i)=>(
                  <motion.div key={i} initial={{scaleX:0}} animate={{scaleX:1}} transition={{delay:0.8+i*0.05}} className="flex-1 origin-left" style={{background:c}}/>
                ))}
              </div>
            </div>

            {/* ── RIGHT: Countdown + Pendahulu ── */}
            <div className="lg:w-[380px] flex flex-col border-t lg:border-t-0 lg:border-l" style={{borderColor:'rgba(255,255,255,0.06)'}}>

              {/* Countdown */}
              <div className="p-4 lg:p-5 border-b" style={{borderColor:'rgba(255,255,255,0.06)'}}>
                <div className="flex items-center gap-2 mb-3">
                  <Timer className="w-3.5 h-3.5 text-yellow-400"/>
                  <span className="text-[10px] font-black tracking-[0.3em] uppercase" style={{color:'rgba(251,191,36,0.7)'}}>
                    {countdown.started?'Sedang Berlangsung!':'Countdown Kejohanan'}
                  </span>
                </div>
                {!countdown.started?(
                  <div className="grid grid-cols-4 gap-2">
                    {[{v:countdown.days,l:'Hari'},{v:countdown.hours,l:'Jam'},{v:countdown.minutes,l:'Minit'},{v:countdown.seconds,l:'Saat'}].map(({v,l})=>(
                      <div key={l} className="text-center rounded-xl p-2" style={{background:'rgba(15,24,41,0.8)',border:'1px solid rgba(245,158,11,0.2)'}}>
                        <motion.div key={v} initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}}
                          className="text-xl lg:text-2xl font-black text-white" style={{fontVariantNumeric:'tabular-nums',textShadow:'0 0 15px rgba(245,158,11,0.3)'}}>
                          {String(v).padStart(2,'0')}
                        </motion.div>
                        <div className="text-[8px] font-bold uppercase tracking-wider mt-0.5" style={{color:'rgba(245,158,11,0.5)'}}>{l}</div>
                      </div>
                    ))}
                  </div>
                ):(
                  <motion.div animate={{scale:[1,1.03,1]}} transition={{duration:1,repeat:Infinity}} className="text-center py-2 text-lg font-black text-yellow-400">🏆 SEDANG BERLANGSUNG!</motion.div>
                )}
                <div className="text-center mt-2 text-[10px]" style={{color:'rgba(100,116,139,0.8)'}}>9 Mei 2026 • SK ORAN</div>
              </div>

              {/* ── PENDAHULU — warna ikut rumah ── */}
              <div className="flex-1 relative overflow-hidden">
                {/* Dynamic background ikut rumah pemimpin */}
                <AnimatePresence>
                  {leader?.totalPoints>0&&(
                    <motion.div key={leader.house}
                      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.8}}
                      className="absolute inset-0">
                      {/* Solid gradient background warna rumah */}
                      <div className="absolute inset-0" style={{background:`linear-gradient(135deg,${HS[leader.house].hex}30,${HS[leader.house].hex}15,rgba(7,16,32,0.95))`}}/>
                      {/* Radial glow tengah */}
                      <motion.div animate={{scale:[1,1.3,1],opacity:[0.3,0.6,0.3]}} transition={{duration:3,repeat:Infinity}}
                        className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 60%,${HS[leader.house].hex}35,transparent 65%)`}}/>
                      {/* Shimmer sweep */}
                      <motion.div animate={{x:['-100%','200%']}} transition={{duration:3,repeat:Infinity,repeatDelay:2,ease:'easeInOut'}}
                        className="absolute inset-y-0 w-1/2" style={{background:`linear-gradient(90deg,transparent,${HS[leader.house].hex}10,transparent)`}}/>
                      {/* Border kiri warna rumah */}
                      <div className="absolute left-0 top-0 bottom-0 w-1" style={{background:`linear-gradient(180deg,transparent,${HS[leader.house].hex},transparent)`}}/>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative z-10 flex flex-col items-center justify-center text-center p-5 h-full gap-3">
                  {/* Badge label */}
                  <motion.div initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} transition={{delay:0.5}}
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full"
                    style={{background:'rgba(0,0,0,0.4)',border:'1px solid rgba(255,255,255,0.1)',backdropFilter:'blur(8px)'}}>
                    <Crown className="w-3.5 h-3.5 text-yellow-400 animate-pulse"/>
                    <span className="text-[10px] font-black tracking-[0.25em] uppercase text-slate-200">Pendahulu Keseluruhan</span>
                  </motion.div>

                  {leader?.totalPoints>0?(
                    <>
                      {/* Nama rumah besar */}
                      <motion.div key={`name-${leader.house}`}
                        initial={{scale:0.7,opacity:0,y:10}} animate={{scale:1,opacity:1,y:0}}
                        transition={{type:'spring',stiffness:200,damping:15}}
                        className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase tracking-tight text-white"
                        style={{textShadow:`0 0 30px ${HS[leader.house].hex}, 0 4px 8px rgba(0,0,0,0.5)`}}>
                        {getHouseName(systemConfig, leader.house)}
                      </motion.div>

                      {/* Kotak mata — berwarna ikut rumah */}
                      <motion.div key={`pts-${leader.house}`}
                        initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}
                        transition={{delay:0.2,type:'spring'}}
                        className="w-full relative rounded-2xl overflow-hidden"
                        style={{background:`linear-gradient(135deg,${HS[leader.house].hex}25,${HS[leader.house].hex}10)`,border:`1.5px solid ${HS[leader.house].hex}60`,boxShadow:`0 4px 24px ${HS[leader.house].glow},inset 0 1px 0 ${HS[leader.house].hex}30`}}>
                        {/* Animated border glow */}
                        <motion.div animate={{opacity:[0.4,0.9,0.4]}} transition={{duration:2,repeat:Infinity}}
                          className="absolute inset-0 rounded-2xl pointer-events-none"
                          style={{boxShadow:`inset 0 0 20px ${HS[leader.house].hex}20`}}/>
                        {/* Shimmer dalam kotak */}
                        <motion.div animate={{x:['-100%','200%']}} transition={{duration:2.5,repeat:Infinity,repeatDelay:1.5,ease:'easeInOut'}}
                          className="absolute inset-y-0 w-1/2 pointer-events-none"
                          style={{background:`linear-gradient(90deg,transparent,${HS[leader.house].hex}15,transparent)`}}/>
                        <div className="relative flex items-baseline justify-center gap-2 py-4 px-6">
                          <motion.span key={leader.totalPoints}
                            initial={{opacity:0,scale:1.5,y:-10}} animate={{opacity:1,scale:1,y:0}}
                            transition={{type:'spring',stiffness:300}}
                            className="text-4xl sm:text-5xl lg:text-6xl font-black text-white"
                            style={{textShadow:`0 0 40px ${HS[leader.house].hex}, 0 0 80px ${HS[leader.house].hex}50`}}>
                            {leader.totalPoints}
                          </motion.span>
                          <span className="text-base font-bold uppercase tracking-[0.2em] mb-1" style={{color:`${HS[leader.house].hex}cc`}}>Mata</span>
                        </div>
                        {/* Bar progress bawah dalam kotak */}
                        <div className="h-1 bg-black/20">
                          <motion.div initial={{width:0}} animate={{width:'100%'}} transition={{duration:1.5,delay:0.5}}
                            className="h-full" style={{background:`linear-gradient(90deg,${HS[leader.house].hex}60,${HS[leader.house].hex})`}}/>
                        </div>
                      </motion.div>
                    </>
                  ):(
                    <div className="flex flex-col items-center gap-3 opacity-30 py-4">
                      <Trophy className="w-12 h-12 text-slate-500"/>
                      <div className="text-lg font-black text-slate-400 uppercase tracking-widest">Belum Bermula</div>
                    </div>
                  )}
                </div>

                {/* Jalur warna bawah pendahulu */}
                {leader?.totalPoints>0&&(
                  <motion.div key={`bar-${leader.house}`} initial={{scaleX:0}} animate={{scaleX:1}} transition={{duration:0.8}}
                    className="absolute bottom-0 left-0 right-0 h-[3px] origin-left"
                    style={{background:`linear-gradient(90deg,${HS[leader.house].hex},${HS[leader.house].hex}80,transparent)`,boxShadow:`0 0 8px ${HS[leader.house].glow}`}}/>
                )}
              </div>
            </div>
          </div>

          {/* Jalur 6 warna bawah keseluruhan */}
          <div className="flex h-[3px]">
            {['#ef4444','#3b82f6','#22c55e','#eab308','#a855f7','#f97316'].map((c,i)=>(
              <div key={i} className="flex-1" style={{background:c}}/>
            ))}
          </div>
        </motion.div>



        {/* ═══ LEADERBOARD — HORIZONTAL BAR PREMIUM ═══ */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.3}}
          className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(135deg,#0a0f1e,#0d1424)',border:'1px solid rgba(245,158,11,0.12)'}}>
          <div className="px-5 py-4 border-b border-yellow-500/10 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-yellow-400"/>
            <h2 className="text-sm font-black uppercase tracking-widest text-white">Kedudukan Rumah Sukan</h2>
            <div className="ml-auto flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"/>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live</span>
            </div>
          </div>
          <div className="p-4 lg:p-5 space-y-2.5">
            {sortedStats.map((hs,i)=>{
              const s=HS[hs.house]; const isL=i===0; const pct=maxPts>0?(hs.totalPoints/maxPts)*100:0;
              const rankColors=['#f59e0b','#94a3b8','#f97316','#475569','#475569','#475569'];
              return (
                <motion.div key={hs.house}
                  initial={{x:-60,opacity:0}} animate={{x:0,opacity:1}}
                  transition={{delay:i*0.1,duration:0.5,ease:'easeOut'}}
                  className="relative rounded-2xl overflow-hidden group"
                  style={{
                    background:isL?`linear-gradient(135deg,${s.hex}22,${s.hex}0a,#0a0f1e)`:'linear-gradient(135deg,#0d1628,#0a0f1e)',
                    border:isL?`1px solid ${s.hex}50`:'1px solid rgba(255,255,255,0.06)',
                    boxShadow:isL?`0 4px 30px ${s.glow},inset 0 1px 0 ${s.hex}20`:'none',
                  }}>
                  {isL&&<div className="absolute top-0 left-0 right-0 h-[2px]" style={{background:`linear-gradient(90deg,transparent,${s.hex},${s.hex}80,transparent)`}}/>}
                  <motion.div animate={{x:['-100%','200%']}} transition={{duration:3,delay:i*0.3+1.5,repeat:Infinity,repeatDelay:5,ease:'easeInOut'}}
                    className="absolute inset-y-0 w-1/3 pointer-events-none" style={{background:`linear-gradient(90deg,transparent,${s.hex}08,transparent)`,zIndex:1}}/>
                  <div className="relative z-10 flex items-center gap-3 lg:gap-4 px-4 py-3 lg:py-3.5">
                    <motion.div initial={{scale:0}} animate={{scale:1}} transition={{delay:i*0.1+0.3,type:'spring',stiffness:200}}
                      className="flex-shrink-0 w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center font-black text-xl lg:text-2xl"
                      style={{background:isL?`linear-gradient(135deg,${s.hex}40,${s.hex}20)`:'rgba(255,255,255,0.05)',color:rankColors[i],border:isL?`1.5px solid ${s.hex}60`:'1px solid rgba(255,255,255,0.08)',boxShadow:isL?`0 0 12px ${s.glow}`:'none',fontStyle:'italic'}}>
                      {i+1}
                    </motion.div>
                    <div className="flex-shrink-0 w-24 lg:w-32">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-black uppercase tracking-tight leading-none ${isL?'text-xl lg:text-2xl text-white':'text-lg text-slate-300'}`} style={isL?{textShadow:`0 0 20px ${s.hex}`}:{}}>
                          {getHouseName(systemConfig, hs.house)}
                        </span>
                        {isL&&<Crown className="w-4 h-4 text-yellow-400 animate-pulse flex-shrink-0" style={{filter:'drop-shadow(0 0 4px #fbbf24)'}}/>}
                      </div>
                      <div className="flex gap-1.5">
                        <span className="text-[10px] font-bold text-yellow-400/80">🥇{hs.gold}</span>
                        <span className="text-[10px] font-bold text-slate-400/80">🥈{hs.silver}</span>
                        <span className="text-[10px] font-bold text-orange-400/80">🥉{hs.bronze}</span>
                      </div>
                    </div>
                    <div className="flex-1 relative">
                      <div className="h-9 lg:h-11 rounded-xl overflow-hidden relative" style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.05)'}}>
                        <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:1.5,delay:i*0.12+0.5,ease:[0.34,1.2,0.64,1]}}
                          className="absolute inset-y-0 left-0 rounded-xl"
                          style={{background:`linear-gradient(90deg,${s.hex}bb,${s.hex},${s.hex}dd)`,boxShadow:`0 0 20px ${s.glow},inset 0 1px 0 rgba(255,255,255,0.2)`,minWidth:pct>0?'2rem':'0'}}>
                          <motion.div animate={{x:['-100%','200%']}} transition={{duration:2,delay:i*0.15+2,repeat:Infinity,repeatDelay:4}}
                            className="absolute inset-0" style={{background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)'}}/>
                          <div className="absolute inset-0 opacity-10" style={{backgroundImage:'radial-gradient(circle,rgba(255,255,255,0.8) 1px,transparent 1px)',backgroundSize:'12px 12px'}}/>
                        </motion.div>
                        {[25,50,75].map(tick=>(
                          <div key={tick} className="absolute top-0 bottom-0 w-px opacity-10" style={{left:`${tick}%`,background:'rgba(255,255,255,0.5)'}}/>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right w-14 lg:w-20">
                      <motion.div key={hs.totalPoints} initial={{scale:1.3,opacity:0}} animate={{scale:1,opacity:1}} transition={{delay:i*0.1+0.8}}
                        className={`font-black tracking-tighter leading-none ${isL?'text-3xl lg:text-4xl text-white':'text-2xl lg:text-3xl text-slate-300'}`}
                        style={isL?{textShadow:`0 0 20px ${s.hex}`}:{}}>
                        {hs.totalPoints}
                      </motion.div>
                      <div className="text-[9px] text-slate-600 uppercase tracking-widest font-bold mt-0.5">Mata</div>
                    </div>
                  </div>
                  <div className="h-0.5 bg-white/5">
                    <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:1.5,delay:i*0.12+0.5,ease:'easeOut'}}
                      className="h-full" style={{background:s.hex,boxShadow:`0 0 4px ${s.hex}`}}/>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* ═══ JAGUH PINGAT ═══ */}
        <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.4}}
          className="rounded-2xl overflow-hidden" style={{background:'linear-gradient(135deg,#0a0f1e,#0d1424)',border:'1px solid rgba(245,158,11,0.1)'}}>
          <div className="px-5 py-4 border-b border-yellow-500/10 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 flex-1">
              <Star className="w-5 h-5 text-yellow-400"/>
              <h2 className="text-sm font-black uppercase tracking-widest" style={{background:'linear-gradient(90deg,#fbbf24,#f59e0b)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
                Jaguh Pingat Terunggul
              </h2>
            </div>
            <div className="flex gap-1 flex-wrap">
              {[1,2,3,4,5,6].map(y=>(
                <button key={y} onClick={()=>setActiveYear(y)}
                  className="px-2.5 py-1 rounded-lg text-xs font-black transition-all"
                  style={activeYear===y?{background:'rgba(245,158,11,0.2)',color:'#fbbf24',border:'1px solid rgba(245,158,11,0.4)'}:{background:'rgba(255,255,255,0.04)',color:'#475569',border:'1px solid rgba(255,255,255,0.06)'}}>
                  TAHUN {y}
                </button>
              ))}
            </div>
          </div>
          <div className="p-4 lg:p-5">
            <AnimatePresence mode="wait">
              <motion.div key={activeYear} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.25}}
                className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[Gender.LELAKI, Gender.PEREMPUAN].map(gender=>{
                  const key=`${activeYear}_${gender}`;
                  const athletes=topAthletes[key]||[];
                  const displayed=showFullLeaderboard?athletes:athletes.slice(0,5);
                  return (
                    <div key={key} className="rounded-xl overflow-hidden" style={{background:'linear-gradient(135deg,#0f1829,#0a0f1e)',border:'1px solid rgba(255,255,255,0.06)'}}>
                      <div className="px-4 py-3 flex items-center gap-2 border-b border-white/5" style={{background:'linear-gradient(135deg,#1a2744,#111827)'}}>
                        <User className="w-3.5 h-3.5 text-slate-400"/>
                        <span className="text-xs font-black uppercase tracking-widest text-slate-300">{gender===Gender.LELAKI?'Lelaki':'Perempuan'}</span>
                        <span className="ml-auto text-[10px] text-slate-600">{athletes.length} atlet</span>
                      </div>
                      <div className="p-3 space-y-2">
                        {athletes.length===0?(
                          <div className="flex flex-col items-center py-6 gap-2 opacity-40">
                            <Trophy className="w-8 h-8 text-slate-600"/>
                            <p className="text-xs text-slate-600 italic">Tiada rekod lagi.</p>
                          </div>
                        ):(
                          displayed.map((ath,idx)=>{
                            const rank=idx+1; const hs2=HS[ath.house]; const isExp=expandedAthletes[ath.id];
                            const rs=rank===1?{bg:'rgba(234,179,8,0.2)',color:'#fbbf24',border:'rgba(234,179,8,0.4)'}:rank===2?{bg:'rgba(148,163,184,0.15)',color:'#94a3b8',border:'rgba(148,163,184,0.3)'}:rank===3?{bg:'rgba(249,115,22,0.15)',color:'#fb923c',border:'rgba(249,115,22,0.3)'}:{bg:'rgba(255,255,255,0.04)',color:'#475569',border:'rgba(255,255,255,0.07)'};
                            return (
                              <div key={idx} className="rounded-xl overflow-hidden cursor-pointer transition-all"
                                style={{background:`${hs2.hex}06`,border:`1px solid ${hs2.hex}18`}}
                                onClick={()=>setExpandedAthletes(p=>({...p,[ath.id]:!p[ath.id]}))}>
                                <div className="flex items-center justify-between p-3">
                                  <div className="flex items-center gap-2.5 overflow-hidden">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                                      style={{background:rs.bg,color:rs.color,border:`1px solid ${rs.border}`}}>{rank}</div>
                                    <div className="min-w-0">
                                      <div className="text-sm font-bold text-white truncate">{ath.name}</div>
                                      <div className="text-xs font-bold uppercase truncate" style={{color:hs2.hex}}>{getHouseName(systemConfig, ath.house)} • {ath.className||'-'}</div>
                                    </div>
                                  </div>
                                  <div className="flex gap-1 flex-shrink-0">
                                    {ath.gold>0&&<span className="text-[11px] font-black px-2 py-0.5 rounded" style={{background:'rgba(234,179,8,0.12)',color:'#fbbf24',border:'1px solid rgba(234,179,8,0.2)'}}>{ath.gold}🥇</span>}
                                    {ath.silver>0&&<span className="text-[11px] font-black px-2 py-0.5 rounded" style={{background:'rgba(148,163,184,0.1)',color:'#94a3b8',border:'1px solid rgba(148,163,184,0.15)'}}>{ath.silver}🥈</span>}
                                    {ath.bronze>0&&<span className="text-[11px] font-black px-2 py-0.5 rounded" style={{background:'rgba(249,115,22,0.1)',color:'#fb923c',border:'1px solid rgba(249,115,22,0.15)'}}>{ath.bronze}🥉</span>}
                                  </div>
                                </div>
                                <AnimatePresence>
                                  {isExp&&(
                                    <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} className="overflow-hidden">
                                      <div className="px-3 pb-2.5 pt-1.5 space-y-1.5 border-t border-white/5">
                                        {ath.events.map((ev,ei)=>(
                                          <div key={ei} className="flex items-center justify-between text-[10px]">
                                            <span className="text-slate-500 truncate mr-2">{ev.eventName}</span>
                                            <span className="px-1.5 py-0.5 rounded font-black uppercase flex-shrink-0" style={ev.medal==='Emas'?{background:'rgba(234,179,8,0.1)',color:'#fbbf24'}:ev.medal==='Perak'?{background:'rgba(148,163,184,0.1)',color:'#94a3b8'}:ev.medal==='Gangsa'?{background:'rgba(249,115,22,0.1)',color:'#fb923c'}:{background:'rgba(59,130,246,0.1)',color:'#60a5fa'}}>
                                              {ev.medal}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
            <div className="mt-4 flex justify-center">
              <button onClick={()=>setShowFullLeaderboard(!showFullLeaderboard)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all"
                style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',color:'#fbbf24'}}>
                {showFullLeaderboard?<><ChevronUp className="w-3.5 h-3.5"/>Sembunyikan</>:<><ChevronDown className="w-3.5 h-3.5"/>Lihat Top 10</>}
              </button>
            </div>
          </div>
        </motion.div>


      </div>
    </div>
  );
};

const RotateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/>
  </svg>
);

export default Dashboard;
