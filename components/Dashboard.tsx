import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Clock,
  Crown,
  Flame,
  Medal,
  Shield,
  Star,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { EventType, Gender, HouseColor, HouseStats, PointsConfig, SystemConfig, WinnerProfile } from '../types';
import { DEFAULT_SYSTEM_CONFIG } from '../constants';
import { activeEvents, getHouseName } from '../utils/systemConfig';
import { generateSportsCommentary } from '../services/geminiService';

interface DashboardProps {
  stats: HouseStats[];
  results: Record<string, WinnerProfile[]>;
  pointsConfig: PointsConfig;
  systemConfig?: SystemConfig;
}

interface AthleteStanding {
  id: string;
  name: string;
  className: string;
  house: HouseColor;
  gold: number;
  silver: number;
  bronze: number;
  totalPoints: number;
  score: number;
}

interface RecentResult {
  key: string;
  eventName: string;
  year: number;
  gender: Gender;
  winner: WinnerProfile;
}

const EVENT_DATE = new Date('2026-05-09T07:00:00');

const HOUSE_THEME: Record<HouseColor, { hex: string; dark: string; glow: string; soft: string; label: string }> = {
  [HouseColor.MERAH]: { hex: '#ff3b45', dark: '#7f111b', glow: '255,59,69', soft: '#ff6b73', label: 'MERAH' },
  [HouseColor.BIRU]: { hex: '#2f8cff', dark: '#0b3a94', glow: '47,140,255', soft: '#67b3ff', label: 'BIRU' },
  [HouseColor.HIJAU]: { hex: '#65d84e', dark: '#166422', glow: '101,216,78', soft: '#94ee73', label: 'HIJAU' },
  [HouseColor.KUNING]: { hex: '#ffc727', dark: '#8a5200', glow: '255,199,39', soft: '#ffe066', label: 'KUNING' },
  [HouseColor.UNGU]: { hex: '#a855f7', dark: '#4c1d95', glow: '168,85,247', soft: '#c084fc', label: 'UNGU' },
  [HouseColor.OREN]: { hex: '#ff7a1a', dark: '#8f3100', glow: '255,122,26', soft: '#ffad61', label: 'OREN' },
};

const formatGender = (gender: Gender) => {
  if (gender === Gender.LELAKI) return 'Lelaki';
  if (gender === Gender.PEREMPUAN) return 'Perempuan';
  return 'Campuran';
};

const useCountdown = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, started: false });

  useEffect(() => {
    const tick = () => {
      const diff = EVENT_DATE.getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, started: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        started: false,
      });
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  return timeLeft;
};

const Dashboard: React.FC<DashboardProps> = ({
  stats,
  results,
  pointsConfig,
  systemConfig = DEFAULT_SYSTEM_CONFIG,
}) => {
  const countdown = useCountdown();
  const [tickerIndex, setTickerIndex] = useState(0);
  const [commentary, setCommentary] = useState('Siaran keputusan sedang dikemas kini secara langsung.');

  const events = useMemo(() => activeEvents(systemConfig), [systemConfig]);
  const resultEntries = useMemo(() => Object.entries(results) as [string, WinnerProfile[]][], [results]);
  const sortedStats = useMemo(() => [...stats].sort((a, b) => b.totalPoints - a.totalPoints), [stats]);
  const leader = sortedStats[0];
  const runnerUp = sortedStats[1];
  const maxPoints = Math.max(leader?.totalPoints || 0, 1);
  const leadGap = leader && runnerUp ? leader.totalPoints - runnerUp.totalPoints : leader?.totalPoints || 0;
  const completedEvents = resultEntries.filter(([, positions]) => positions.length > 0).length;

  const recentResults = useMemo<RecentResult[]>(() => {
    return resultEntries
      .filter(([, positions]) => positions.length > 0)
      .slice(-5)
      .reverse()
      .map(([key, positions]) => {
        const parts = key.split('_');
        const gender = parts.pop() as Gender;
        const yearText = parts.pop() || '0';
        const eventId = parts.join('_');
        const eventDef = events.find((event) => event.id === eventId);

        return {
          key,
          eventName: eventDef?.name || eventId,
          year: Number(yearText),
          gender,
          winner: positions[0],
        };
      });
  }, [events, resultEntries]);

  const topAthletes = useMemo(() => {
    const athletes: Record<string, AthleteStanding> = {};

    resultEntries.forEach(([key, positions]) => {
      const parts = key.split('_');
      const gender = parts.pop() as Gender;
      const yearText = parts.pop();
      const eventId = parts.join('_');
      const eventDef = events.find((event) => event.id === eventId);
      if (!eventDef || !yearText || !gender || eventDef.type === EventType.KHUSUS) return;

      const pointSet = eventDef.type === EventType.RELAY ? pointsConfig.relay : pointsConfig.individu;

      positions.forEach((winner, index) => {
        if (!winner) return;
        const points = pointSet[index] || 0;
        const medalScore = index === 0 ? 1000 : index === 1 ? 100 : index === 2 ? 10 : 1;
        const members = winner.teamMembers?.length
          ? winner.teamMembers.map((member) => ({ ...member, house: winner.house }))
          : winner.name
            ? [{ name: winner.name, className: winner.className, house: winner.house }]
            : [];

        members.forEach((member) => {
          const name = member.name?.trim();
          if (!name || name.startsWith('Pasukan ') || name.startsWith('Rumah ')) return;

          const id = `${name.toLowerCase()}_${member.house}`;
          if (!athletes[id]) {
            athletes[id] = {
              id,
              name,
              className: member.className || '-',
              house: member.house,
              gold: 0,
              silver: 0,
              bronze: 0,
              totalPoints: 0,
              score: 0,
            };
          }

          if (index === 0) athletes[id].gold += 1;
          if (index === 1) athletes[id].silver += 1;
          if (index === 2) athletes[id].bronze += 1;
          athletes[id].totalPoints += points;
          athletes[id].score += medalScore + points;
        });
      });
    });

    return Object.values(athletes)
      .sort((a, b) => b.score - a.score || b.totalPoints - a.totalPoints)
      .slice(0, 5);
  }, [events, pointsConfig, resultEntries]);

  const tickerItems = useMemo(() => {
    const items = [
      leader
        ? `Rumah ${getHouseName(systemConfig, leader.house)} mendahului dengan ${leader.totalPoints} mata, pertarungan makin sengit.`
        : 'Keputusan pertama akan dipaparkan sebaik sahaja admin memasukkan data.',
      runnerUp && leadGap > 0
        ? `${getHouseName(systemConfig, runnerUp.house)} mengejar pendahulu dengan jurang ${leadGap} mata.`
        : 'Semua rumah sukan masih berpeluang naik ke kedudukan teratas.',
      completedEvents > 0 ? `${completedEvents} keputusan acara telah direkodkan setakat ini.` : '',
      topAthletes[0] ? `${topAthletes[0].name} menjadi atlet tumpuan dengan ${topAthletes[0].gold} emas.` : '',
      commentary,
    ];

    return items.filter(Boolean);
  }, [commentary, completedEvents, leadGap, leader, runnerUp, systemConfig, topAthletes]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setTickerIndex((current) => (current + 1) % Math.max(tickerItems.length, 1));
    }, 6500);

    return () => window.clearInterval(intervalId);
  }, [tickerItems.length]);

  useEffect(() => {
    let mounted = true;
    const timeoutId = window.setTimeout(async () => {
      const text = await generateSportsCommentary(stats);
      if (mounted && text) setCommentary(text);
    }, 2400);

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [stats]);

  const countdownBlocks = [
    { label: 'Hari', value: countdown.days },
    { label: 'Jam', value: countdown.hours },
    { label: 'Minit', value: countdown.minutes },
    { label: 'Saat', value: countdown.seconds },
  ];

  return (
    <div className="min-h-screen bg-[#020711] text-white">
      <style>{`
        @keyframes neonPulse {
          0%, 100% { opacity: .75; filter: drop-shadow(0 0 8px rgba(255,59,69,.55)); }
          50% { opacity: 1; filter: drop-shadow(0 0 18px rgba(255,59,69,.9)); }
        }

        @keyframes runnerDash {
          0% { transform: translateX(0); opacity: .45; }
          50% { transform: translateX(-14px); opacity: .9; }
          100% { transform: translateX(0); opacity: .45; }
        }

        @keyframes lineGlow {
          0%, 100% { opacity: .8; }
          50% { opacity: 1; }
        }

        @keyframes titleSweep {
          0% { background-position: -220% 50%; transform: translateY(0) skewX(-8deg); }
          45% { background-position: 40% 50%; transform: translateY(-2px) skewX(-8deg); }
          100% { background-position: 220% 50%; transform: translateY(0) skewX(-8deg); }
        }

        @keyframes titleGlow {
          0%, 100% { filter: drop-shadow(0 0 8px rgba(255,255,255,.22)); }
          50% { filter: drop-shadow(0 0 22px rgba(255,199,39,.42)); }
        }

        .broadcast-panel {
          background:
            radial-gradient(circle at top left, rgba(47,140,255,.18), transparent 34%),
            linear-gradient(135deg, rgba(7,22,42,.96), rgba(1,8,20,.96));
          border: 1px solid rgba(125, 196, 255, .28);
          box-shadow: 0 0 32px rgba(47,140,255,.13), inset 0 1px 0 rgba(255,255,255,.08);
        }

        .broadcast-card {
          background: linear-gradient(135deg, rgba(5,20,42,.92), rgba(1,8,20,.95));
          border: 1px solid rgba(125, 196, 255, .24);
          box-shadow: 0 18px 38px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.07);
        }

        .hero-title {
          font-family: "Arial Black", "Impact", "Bahnschrift Condensed", "Segoe UI Black", sans-serif;
          font-size: clamp(3.7rem, 9vw, 7.9rem);
          letter-spacing: -0.055em;
          background: linear-gradient(105deg, #f8fafc 0%, #f8fafc 34%, #ffd84a 45%, #ffffff 52%, #f8fafc 64%, #dbeafe 100%);
          background-size: 220% 100%;
          color: transparent;
          -webkit-background-clip: text;
          background-clip: text;
          text-shadow: 0 7px 0 rgba(255,255,255,.07), 0 0 30px rgba(255,255,255,.18);
          -webkit-text-stroke: 1px rgba(255,255,255,.22);
          animation: titleSweep 4.8s ease-in-out infinite, titleGlow 3.5s ease-in-out infinite;
          will-change: background-position, transform, filter;
        }

        .hero-copy {
          max-width: min(980px, 100%);
        }

        .school-crest {
          filter: drop-shadow(0 18px 30px rgba(0,0,0,.5));
        }

        .event-kicker {
          font-family: "Bahnschrift", "Segoe UI", sans-serif;
          text-shadow: 0 0 14px rgba(255,199,39,.22);
        }

        .event-eyebrow {
          font-family: "Bahnschrift", "Segoe UI", sans-serif;
          text-shadow: 0 0 14px rgba(255,199,39,.24);
        }

        .neon-rule {
          box-shadow: 0 0 20px rgba(47,140,255,.8), 0 0 28px rgba(255,59,69,.55);
        }

        @media (max-width: 900px) {
          .desktop-grid { grid-template-columns: 1fr !important; }
          .hero-copy { grid-template-columns: 116px minmax(0, 1fr) !important; gap: 18px !important; }
          .hero-art { min-height: 190px; }
          .results-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 430px) {
          .hero-topline { align-items: flex-start; flex-direction: column; }
          .hero-mini-countdown { align-self: flex-end; }
        }

        @media (max-width: 560px) {
          .score-shell { padding: 12px !important; }
          .hero-copy { grid-template-columns: 1fr !important; text-align: center; }
          .school-crest-wrap { justify-content: center !important; }
          .hero-title { font-size: clamp(3rem, 17vw, 4.4rem) !important; letter-spacing: -0.065em; }
          .event-kicker { justify-content: center; }
          .ticker-text { font-size: 15px !important; }
          .countdown-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .leader-row { grid-template-columns: 44px 1fr 56px !important; }
          .leader-name { font-size: 22px !important; }
        }
      `}</style>

      <main className="score-shell mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <HeroBanner
          countdownBlocks={countdownBlocks}
          ticker={tickerItems[tickerIndex % Math.max(tickerItems.length, 1)]}
        />

        <div className="desktop-grid mt-5 grid grid-cols-[1.45fr_.9fr] gap-5">
          <div className="space-y-5">
            <CountdownStrip countdownBlocks={countdownBlocks} />
            <CurrentStandings stats={sortedStats} maxPoints={maxPoints} systemConfig={systemConfig} />
            <TrendPanel stats={sortedStats.slice(0, 4)} maxPoints={maxPoints} systemConfig={systemConfig} />
            <RecentResults results={recentResults} systemConfig={systemConfig} />
          </div>

          <div className="space-y-5">
            <TopAthletes athletes={topAthletes} systemConfig={systemConfig} />
            <PowerGap stats={sortedStats} systemConfig={systemConfig} />
          </div>
        </div>
      </main>
    </div>
  );
};

const HeroBanner: React.FC<{
  countdownBlocks: Array<{ label: string; value: number }>;
  ticker: string;
}> = ({ ticker }) => (
  <section className="relative overflow-hidden rounded-[30px] border border-cyan-300/20 bg-[#031126] px-4 py-5 shadow-2xl sm:px-7 lg:px-8">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(47,140,255,.22),transparent_32%),radial-gradient(circle_at_12%_10%,rgba(255,59,69,.12),transparent_24%)]" />
    <div className="absolute inset-0 opacity-[.13] bg-[linear-gradient(rgba(255,255,255,.25)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.16)_1px,transparent_1px)] bg-[size:42px_42px]" />
    <RunnerGraphic />

    <div className="relative">
      <div className="hero-topline h-1" />

      <div className="hero-copy mt-7 grid grid-cols-[132px_minmax(0,1fr)] items-center gap-6 lg:grid-cols-[160px_minmax(0,1fr)] lg:gap-8">
        <div className="school-crest-wrap flex justify-start">
          <div className="school-crest relative h-28 w-28 rounded-[28px] border border-yellow-300/20 bg-white/[.06] p-2 sm:h-32 sm:w-32 lg:h-40 lg:w-40">
            <div className="absolute inset-0 rounded-[28px] bg-[radial-gradient(circle,#facc15_0%,transparent_62%)] opacity-20 blur-xl" />
            <div className="absolute inset-2 rounded-[22px] border border-white/10" />
            <img src="/logo-sekolah-oran-transparent.png?v=2" alt="Logo SK ORAN" className="relative h-full w-full object-contain" />
          </div>
        </div>

        <div className="min-w-0">
          <div className="event-eyebrow mb-4 text-sm font-black uppercase italic tracking-[0.2em] text-yellow-300 sm:text-xl sm:tracking-[0.24em]">
            Kejohanan Olahraga Tahunan
          </div>
          <h1 className="hero-title whitespace-nowrap uppercase italic leading-[0.86] text-stone-100">
            SK ORAN
          </h1>
          <div className="event-kicker mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-black uppercase italic tracking-[0.18em] text-yellow-300 sm:text-xl sm:tracking-[0.22em]">
            <span className="rounded-full border border-yellow-300/35 bg-yellow-300/10 px-3 py-1 text-xs tracking-[0.2em] text-yellow-100 sm:text-sm">
              Edisi 2026
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-red-400/55 bg-red-500/15 px-3 py-1 text-xs tracking-[0.18em] text-red-100 shadow-[0_0_18px_rgba(255,59,69,.32)] sm:text-sm">
              <span className="h-2 w-2 rounded-full bg-red-300 shadow-[0_0_12px_rgba(255,255,255,.85)]" />
              Live
            </span>
          </div>
          <div className="mt-3 h-1 w-40 rounded-full bg-[linear-gradient(90deg,#ff3b45,#ffc727,#65d84e,#2f8cff,#a855f7)] shadow-[0_0_16px_rgba(47,140,255,.7)] max-[560px]:mx-auto" />
        </div>
      </div>

      <div className="neon-rule mt-7 h-1 rounded-full bg-[linear-gradient(90deg,#ff3b45,#ffc727,#65d84e,#2f8cff,#a855f7)]" />

      <div className="mt-5 flex overflow-hidden rounded-xl border border-yellow-400/35 bg-black/35 shadow-[0_0_28px_rgba(255,199,39,.16)]">
        <div className="flex items-center gap-3 border-r border-yellow-400/20 bg-yellow-400/10 px-4 py-3 text-lg font-black uppercase tracking-wider text-yellow-300">
          <Zap className="h-6 w-6" />
          Terkini
        </div>
        <div className="ticker-text flex min-h-[58px] flex-1 items-center px-4 text-xl font-bold text-stone-100">
          <Flame className="mr-3 h-6 w-6 shrink-0 text-orange-400" />
          {ticker}
        </div>
      </div>
    </div>
  </section>
);

const RunnerGraphic: React.FC = () => (
  <div className="hero-art pointer-events-none absolute bottom-0 right-0 top-0 hidden w-[46%] overflow-hidden opacity-80 lg:block">
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 520 260" preserveAspectRatio="none">
      {Array.from({ length: 28 }).map((_, index) => {
        const y = 15 + index * 9;
        const hue = index % 4 === 0 ? '#ff3b45' : index % 4 === 1 ? '#2f8cff' : index % 4 === 2 ? '#65d84e' : '#a855f7';
        return (
          <path
            key={index}
            d={`M${130 + index * 5} ${y} C ${250 + index * 2} ${y + 25}, ${330 + index * 3} ${y - 35}, 520 ${y + 5}`}
            stroke={hue}
            strokeWidth={index % 5 === 0 ? 2 : 1}
            opacity={0.38}
            fill="none"
          />
        );
      })}
    </svg>
    <div className="absolute right-28 top-14 h-40 w-40 opacity-60" style={{ animation: 'runnerDash 3s ease-in-out infinite' }}>
      <RunnerSilhouette color="#2f8cff" />
    </div>
    <div className="absolute right-0 top-8 h-48 w-48 opacity-90" style={{ animation: 'runnerDash 2.7s ease-in-out infinite reverse' }}>
      <RunnerSilhouette color="#a855f7" />
    </div>
  </div>
);

const RunnerSilhouette: React.FC<{ color: string }> = ({ color }) => (
  <svg viewBox="0 0 180 180" className="h-full w-full" fill="none">
    <circle cx="112" cy="30" r="17" fill={color} opacity=".95" />
    <path d="M96 52 L67 88 L99 91 L129 128" stroke={color} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
    <path d="M74 86 L42 114" stroke={color} strokeWidth="17" strokeLinecap="round" opacity=".72" />
    <path d="M99 91 L76 141" stroke={color} strokeWidth="17" strokeLinecap="round" opacity=".72" />
    <path d="M102 60 L147 73" stroke={color} strokeWidth="15" strokeLinecap="round" opacity=".65" />
    <path d="M81 66 L42 45" stroke={color} strokeWidth="14" strokeLinecap="round" opacity=".55" />
  </svg>
);

const PanelHeader: React.FC<{ icon: React.ReactNode; title: string; action?: string }> = ({ icon, title, action }) => (
  <div className="mb-4 flex items-center justify-between gap-3">
    <div className="flex items-center gap-3">
      <div className="text-yellow-300">{icon}</div>
      <h2 className="text-xl font-black uppercase tracking-wide text-stone-100">{title}</h2>
    </div>
    {action && (
      <span className="rounded-full border border-yellow-400/35 bg-yellow-400/10 px-4 py-1 text-sm font-black uppercase tracking-wider text-yellow-300">
        {action}
      </span>
    )}
  </div>
);

function CountdownStrip({ countdownBlocks }: { countdownBlocks: Array<{ label: string; value: number }> }) {
  return (
  <section className="broadcast-panel rounded-[26px] p-4 sm:p-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-yellow-300/35 bg-yellow-300/10 text-yellow-300 shadow-[0_0_18px_rgba(255,199,39,.18)]">
          <Timer className="h-7 w-7" />
        </div>
        <div>
          <div className="text-xl font-black uppercase tracking-wide text-stone-100">Countdown Kejohanan</div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">9 Mei 2026 - SK ORAN</div>
        </div>
      </div>

      <div className="countdown-grid grid w-full min-w-0 grid-cols-4 gap-2 lg:max-w-[430px]">
        {countdownBlocks.map((block, index) => (
          <div
            key={block.label}
            className="min-w-0 rounded-xl border bg-[#071527]/90 px-2 py-3 text-center shadow-inner sm:px-3"
            style={{ borderColor: index % 2 === 0 ? 'rgba(255,59,69,.55)' : 'rgba(47,140,255,.55)' }}
          >
            <div className="text-2xl font-black leading-none tabular-nums text-white sm:text-4xl">
              {String(block.value).padStart(2, '0')}
            </div>
            <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
              {block.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
  );
}

const CurrentStandings: React.FC<{ stats: HouseStats[]; maxPoints: number; systemConfig: SystemConfig }> = ({
  stats,
  maxPoints,
  systemConfig,
}) => (
  <section className="broadcast-panel rounded-[26px] p-4 sm:p-5">
    <PanelHeader icon={<Trophy className="h-7 w-7" />} title="Kedudukan Semasa" />
    <div className="space-y-3">
      {stats.map((house, index) => {
        const theme = HOUSE_THEME[house.house];
        const pct = Math.max((house.totalPoints / maxPoints) * 100, house.totalPoints > 0 ? 6 : 0);
        return (
          <div
            key={house.house}
            className="leader-row grid grid-cols-[72px_1fr_92px] items-center gap-3 rounded-2xl border p-3"
            style={{
              borderColor: `rgba(${theme.glow}, .32)`,
              background: `linear-gradient(90deg, rgba(${theme.glow}, .12), rgba(255,255,255,.025))`,
              boxShadow: index === 0 ? `0 0 22px rgba(${theme.glow}, .18)` : undefined,
            }}
          >
            <div
              className="flex h-14 items-center justify-center rounded-xl text-3xl font-black text-white"
              style={{
                background: `linear-gradient(135deg, ${theme.hex}, ${theme.dark})`,
                boxShadow: `0 0 18px rgba(${theme.glow}, .45)`,
              }}
            >
              {index + 1}
            </div>
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <Shield className="h-10 w-10 shrink-0" style={{ color: theme.hex, filter: `drop-shadow(0 0 8px rgba(${theme.glow}, .55))` }} />
                <div className="leader-name truncate text-3xl font-black uppercase tracking-wide" style={{ color: theme.hex }}>
                  {getHouseName(systemConfig, house.house)}
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full border border-white/10 bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${theme.hex}, ${theme.soft})`,
                    boxShadow: `0 0 16px rgba(${theme.glow}, .7)`,
                  }}
                />
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black text-white">{house.totalPoints}</div>
              <div className="text-lg font-medium text-slate-400">mata</div>
            </div>
          </div>
        );
      })}
    </div>
  </section>
);

const TrendPanel: React.FC<{ stats: HouseStats[]; maxPoints: number; systemConfig: SystemConfig }> = ({
  stats,
  maxPoints,
  systemConfig,
}) => {
  const width = 700;
  const height = 260;
  const left = 54;
  const top = 18;
  const chartWidth = width - 92;
  const chartHeight = height - 62;
  const times = ['8:00', '9:00', '10:00', '11:00', '12:00', '1:00', '2:00', '3:00', '4:00', '5:00'];

  const makePoints = (total: number, houseIndex: number) => {
    return times.map((_, index) => {
      const ratio = (index + 1) / times.length;
      const wobble = Math.sin(index * 0.9 + houseIndex) * Math.max(total * 0.035, 1);
      const value = Math.max(0, Math.round(total * ratio + wobble));
      const x = left + (chartWidth / (times.length - 1)) * index;
      const y = top + chartHeight - (value / Math.max(maxPoints, 1)) * chartHeight;
      return { x, y, value };
    });
  };

  return (
    <section className="broadcast-panel rounded-[26px] p-4 sm:p-5">
      <PanelHeader icon={<BarChart3 className="h-7 w-7" />} title="Trend Mata Rumah" />
      <div className="mb-2 flex flex-wrap gap-4">
        {stats.map((house) => {
          const theme = HOUSE_THEME[house.house];
          return (
            <div key={house.house} className="flex items-center gap-2 text-xs font-bold uppercase text-slate-300">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.hex, boxShadow: `0 0 9px rgba(${theme.glow}, .65)` }} />
              {getHouseName(systemConfig, house.house)}
            </div>
          );
        })}
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px]">
          <defs>
            <linearGradient id="chartFade" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(47,140,255,.2)" />
              <stop offset="100%" stopColor="rgba(47,140,255,0)" />
            </linearGradient>
          </defs>
          <rect x={left} y={top} width={chartWidth} height={chartHeight} fill="rgba(255,255,255,.02)" rx="8" />
          {Array.from({ length: 6 }).map((_, index) => {
            const y = top + (chartHeight / 5) * index;
            return <line key={index} x1={left} y1={y} x2={left + chartWidth} y2={y} stroke="rgba(255,255,255,.08)" />;
          })}
          {times.map((time, index) => {
            const x = left + (chartWidth / (times.length - 1)) * index;
            return (
              <g key={time}>
                <line x1={x} y1={top} x2={x} y2={top + chartHeight} stroke="rgba(255,255,255,.05)" />
                <text x={x} y={height - 18} textAnchor="middle" fill="rgba(255,255,255,.55)" fontSize="12" fontWeight="700">
                  {time}
                </text>
              </g>
            );
          })}
          <text x="8" y={top + 6} fill="rgba(255,255,255,.65)" fontSize="12" fontWeight="900">
            MATA
          </text>
          <text x={left + chartWidth / 2} y={height - 1} textAnchor="middle" fill="rgba(255,255,255,.65)" fontSize="12" fontWeight="900">
            MASA
          </text>
          {stats.map((house, houseIndex) => {
            const theme = HOUSE_THEME[house.house];
            const points = makePoints(house.totalPoints, houseIndex);
            const d = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
            const last = points[points.length - 1];
            return (
              <g key={house.house}>
                <path d={d} fill="none" stroke={theme.hex} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter={`drop-shadow(0 0 6px rgba(${theme.glow}, .75))`} />
                {points.map((point, index) => (
                  <circle key={index} cx={point.x} cy={point.y} r="5" fill={theme.hex} stroke="#071527" strokeWidth="2" />
                ))}
                <rect x={last.x + 8} y={last.y - 14} width="42" height="28" rx="7" fill={theme.hex} />
                <text x={last.x + 29} y={last.y + 5} textAnchor="middle" fill="white" fontSize="16" fontWeight="900">
                  {house.totalPoints}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
};

const CountdownCard: React.FC<{ countdownBlocks: Array<{ label: string; value: number }> }> = ({ countdownBlocks }) => (
  <section className="broadcast-card rounded-[26px] p-4 sm:p-5">
    <PanelHeader icon={<Timer className="h-7 w-7" />} title="Countdown Kejohanan" />
    <div className="countdown-grid grid grid-cols-4 gap-3 rounded-2xl border border-white/10 bg-black/25 p-3">
      {countdownBlocks.map((block, index) => (
        <div
          key={block.label}
          className="rounded-xl border bg-[#071527] px-2 py-4 text-center"
          style={{ borderColor: index % 2 === 0 ? 'rgba(255,59,69,.65)' : 'rgba(47,140,255,.65)' }}
        >
          <div className="text-4xl font-black tabular-nums text-white drop-shadow-md">{String(block.value).padStart(2, '0')}</div>
          <div className="mt-2 text-sm font-black uppercase text-slate-400">{block.label}</div>
        </div>
      ))}
    </div>
    <div className="mt-4 text-center text-base font-black uppercase tracking-[0.18em] text-slate-500">
      9 Mei 2026 - SK ORAN
    </div>
  </section>
);

const TopAthletes: React.FC<{ athletes: AthleteStanding[]; systemConfig: SystemConfig }> = ({ athletes, systemConfig }) => (
  <section className="broadcast-card rounded-[26px] p-4 sm:p-5">
    <PanelHeader icon={<Star className="h-7 w-7" />} title="Atlet Tumpuan" action="Top 5" />
    <div className="space-y-3">
      {athletes.length > 0 ? (
        athletes.map((athlete, index) => {
          const theme = HOUSE_THEME[athlete.house];
          return (
            <div
              key={athlete.id}
              className="grid grid-cols-[58px_1fr_70px] items-center gap-3 rounded-xl border p-3"
              style={{
                background: `linear-gradient(90deg, rgba(${theme.glow}, .16), rgba(255,255,255,.025))`,
                borderColor: `rgba(${theme.glow}, .32)`,
              }}
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 text-2xl font-black"
                style={{
                  color: index === 0 ? '#ffc727' : index === 1 ? '#cbd5e1' : index === 2 ? '#ff8b3d' : theme.hex,
                  borderColor: theme.hex,
                  background: `rgba(${theme.glow}, .16)`,
                }}
              >
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xl font-black text-white">{athlete.name}</div>
                <div className="truncate text-sm font-medium text-slate-400">
                  {getHouseName(systemConfig, athlete.house)} - {athlete.className}
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black text-yellow-300">{athlete.totalPoints}</div>
                <div className="text-sm text-slate-400">mata</div>
              </div>
            </div>
          );
        })
      ) : (
        <EmptyBox text="Atlet tumpuan akan dipaparkan selepas keputusan dimasukkan." />
      )}
    </div>
  </section>
);

const RecentResults: React.FC<{ results: RecentResult[]; systemConfig: SystemConfig }> = ({ results, systemConfig }) => (
  <section className="broadcast-panel rounded-[26px] p-4 sm:p-5">
    <PanelHeader icon={<Clock className="h-7 w-7" />} title="Keputusan Terkini" action={`${results.length} Acara`} />
    <div className="space-y-3">
      {results.length > 0 ? (
        results.map((item, index) => {
          const theme = HOUSE_THEME[item.winner.house];
          return (
            <div key={item.key} className="results-grid grid grid-cols-[62px_1fr_130px] items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-full border text-2xl font-black"
                style={{ borderColor: theme.hex, color: index < 3 ? '#ffc727' : '#9cc9ff', backgroundColor: `rgba(${theme.glow}, .12)` }}
              >
                {index + 1}
              </div>
              <div className="min-w-0">
                <div className="truncate text-lg font-black text-white">{item.eventName}</div>
                <div className="truncate text-sm text-slate-400">
                  {item.winner.name || getHouseName(systemConfig, item.winner.house)} - {item.year > 0 ? `Tahun ${item.year}` : 'Terbuka'} {formatGender(item.gender)}
                </div>
              </div>
              <div
                className="rounded-full border px-4 py-2 text-center text-lg font-black uppercase"
                style={{ borderColor: theme.hex, color: theme.hex, backgroundColor: `rgba(${theme.glow}, .1)` }}
              >
                {getHouseName(systemConfig, item.winner.house)}
              </div>
            </div>
          );
        })
      ) : (
        <EmptyBox text="Keputusan terkini akan dipaparkan di sini." />
      )}
    </div>
  </section>
);

const PowerGap: React.FC<{ stats: HouseStats[]; systemConfig: SystemConfig }> = ({ stats, systemConfig }) => {
  const comparisons = stats.slice(0, 4).map((house, index) => {
    const next = stats[index + 1];
    if (!next) return null;
    return { house, next, gap: house.totalPoints - next.totalPoints };
  }).filter(Boolean) as Array<{ house: HouseStats; next: HouseStats; gap: number }>;

  return (
    <section className="rounded-[26px] border border-red-400/40 bg-[linear-gradient(135deg,rgba(255,59,69,.12),rgba(1,8,20,.95))] p-4 sm:p-5 shadow-[0_0_32px_rgba(255,59,69,.16)]">
      <PanelHeader icon={<Zap className="h-7 w-7" />} title="Jurang Kuasa" />
      <div className="mb-4 text-base text-slate-400">Perbezaan mata antara rumah</div>
      <div className="space-y-3">
        {comparisons.length > 0 ? (
          comparisons.map(({ house, next, gap }) => {
            const themeA = HOUSE_THEME[house.house];
            const themeB = HOUSE_THEME[next.house];
            const pct = Math.min(Math.max((gap / Math.max(house.totalPoints, 1)) * 100, 8), 100);
            return (
              <div key={`${house.house}-${next.house}`} className="rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="mb-3 grid grid-cols-[1fr_42px_1fr_76px] items-center gap-2">
                  <HouseMini house={house.house} systemConfig={systemConfig} />
                  <div className="text-center text-sm font-black uppercase text-slate-400">VS</div>
                  <HouseMini house={next.house} systemConfig={systemConfig} />
                  <div className="text-right text-4xl font-black text-yellow-300">+{gap}</div>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${themeA.hex}, ${themeB.hex})`,
                      boxShadow: `0 0 16px rgba(${themeA.glow}, .5)`,
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <EmptyBox text="Jurang kuasa akan dipaparkan selepas sekurang-kurangnya dua rumah mendapat mata." />
        )}
      </div>
    </section>
  );
};

const HouseMini: React.FC<{ house: HouseColor; systemConfig: SystemConfig }> = ({ house, systemConfig }) => {
  const theme = HOUSE_THEME[house];
  return (
    <div className="min-w-0 text-center">
      <Shield className="mx-auto h-10 w-10" style={{ color: theme.hex, filter: `drop-shadow(0 0 8px rgba(${theme.glow}, .6))` }} />
      <div className="truncate text-sm font-bold" style={{ color: theme.hex }}>
        {getHouseName(systemConfig, house)}
      </div>
    </div>
  );
};

const EmptyBox: React.FC<{ text: string }> = ({ text }) => (
  <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-8 text-center text-sm font-semibold text-slate-500">
    {text}
  </div>
);

export default Dashboard;
