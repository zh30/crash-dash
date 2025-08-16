import { sdk } from "@farcaster/frame-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount, useConnect, usePublicClient, useWriteContract } from "wagmi";
import leaderboardAbi from "./abi/Leaderboard.json";

const SCORE_SCALE = 1000;

function App() {
  useEffect(() => {
    sdk.actions.ready();
  }, []);

  const [activeView, setActiveView] = useState<"game" | "leaderboard">("game");
  const [leaderboardRefreshToken, setLeaderboardRefreshToken] = useState(0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 to-zinc-900 text-zinc-100">
      <div className="mx-auto max-w-md px-4 py-6 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Crash Dash</h1>
            <p className="text-xs text-zinc-400">去中心化小游戏 · Monad 测试网</p>
          </div>
          <ConnectMenu />
        </header>

        <div className="mt-1 flex rounded-xl bg-zinc-800/60 p-1 ring-1 ring-white/10">
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${activeView === "game" ? "bg-zinc-900 text-white" : "text-zinc-300 hover:text-white"}`}
            onClick={() => setActiveView("game")}
          >
            游戏
          </button>
          <button
            type="button"
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition ${activeView === "leaderboard" ? "bg-zinc-900 text-white" : "text-zinc-300 hover:text-white"}`}
            onClick={() => setActiveView("leaderboard")}
          >
            排行榜
          </button>
        </div>

        {activeView === "game" && (
          <Game
            onSubmitted={() => {
              setActiveView("leaderboard");
              setLeaderboardRefreshToken((t) => t + 1);
            }}
          />
        )}

        {activeView === "leaderboard" && <Leaderboard key={leaderboardRefreshToken} />}
      </div>
    </div>
  );
}

function ConnectMenu() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  if (isConnected) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
          已连接
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connect({ connector: connectors[0] })}
      className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-indigo-500 active:bg-indigo-600/90"
    >
      连接钱包
    </button>
  );
}

// 保留空壳（后续可扩展签名/登录），避免未使用警告
// 已移除签名按钮以简化顶部区域

type Candle = { open: number; high: number; low: number; close: number };

function Game({ onSubmitted }: { onSubmitted?: () => void }) {
  const TOTAL_MS = 20000;
  const STEP_MS = 500;
  const MAX_STEPS = Math.floor(TOTAL_MS / STEP_MS);

  const [gameState, setGameState] = useState<"ready" | "running" | "ended">("ready");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [countdownMs, setCountdownMs] = useState<number>(TOTAL_MS);
  const [priceAtEnd, setPriceAtEnd] = useState<number>(0);
  const [sellPrice, setSellPrice] = useState<number | null>(null);

  const intervalRef = useRef<number | null>(null);
  const stepsRef = useRef<number>(0);
  const startPrice = 100;
  const lastCloseRef = useRef<number>(startPrice);
  const sellPriceRef = useRef<number | null>(null);

  const priceMax = useMemo(() => {
    if (candles.length === 0) return startPrice;
    let max = 0;
    for (const c of candles) max = Math.max(max, c.high);
    return max;
  }, [candles]);

  const peakPrice = useMemo(() => priceMax, [priceMax]);
  const finalScore = useMemo(() => peakPrice - (sellPrice || priceAtEnd), [peakPrice, sellPrice, priceAtEnd]);

  const generateNextCandle = useCallback((prevClose: number, step: number): Candle => {
    const baseDrift = 0.002; // 基础上行趋势
    const wave = 0.015 * Math.sin(step * 0.8) + 0.01 * Math.sin(step * 0.23) - 0.012 * Math.sin(step * 0.51);
    const delta = baseDrift + wave;
    const nextCloseRaw = Math.max(1, prevClose * (1 + delta));
    const highRaw = Math.max(prevClose, nextCloseRaw) * (1 + 0.004 + 0.002 * Math.sin(step * 1.2));
    const lowRaw = Math.min(prevClose, nextCloseRaw) * (1 - 0.004 - 0.002 * Math.cos(step * 0.9));
    const to3 = (v: number) => Math.round(v * 1000) / 1000;
    return {
      open: to3(prevClose),
      high: to3(highRaw),
      low: to3(lowRaw),
      close: to3(nextCloseRaw),
    };
  }, []);

  const finalize = useCallback((priceAtEnd: number) => {
    setGameState("ended");
    setPriceAtEnd(priceAtEnd);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startGame = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setGameState("running");
    setCandles([{ open: startPrice, high: startPrice, low: startPrice, close: startPrice }]);
    lastCloseRef.current = startPrice;
    setSellPrice(null);
    sellPriceRef.current = null;
    setCountdownMs(TOTAL_MS);
    stepsRef.current = 0;

    const id = window.setInterval(() => {
      stepsRef.current += 1;
      setCandles((prev) => {
        const prevClose = prev[prev.length - 1].close;
        const next = generateNextCandle(prevClose, stepsRef.current);
        lastCloseRef.current = next.close;
        return [...prev, next];
      });
      setCountdownMs((ms) => Math.max(0, ms - STEP_MS));
      if (stepsRef.current >= MAX_STEPS) {
        const settle = sellPriceRef.current ?? lastCloseRef.current;
        finalize(settle);
      }
    }, STEP_MS);
    intervalRef.current = id;
  }, [finalize, generateNextCandle, MAX_STEPS]);

  const onBuy = () => {
    if (gameState !== "ready") return;
    startGame();
  };

  const onRestart = () => {
    if (gameState !== "ended") return;
    startGame();
  };

  const onSell = () => {
    if (gameState !== "running") return;
    if (sellPriceRef.current != null) return;
    sellPriceRef.current = lastCloseRef.current;
    setSellPrice(lastCloseRef.current);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <section className="rounded-2xl bg-zinc-900/60 ring-1 ring-white/10 p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-zinc-200">K 线模拟</div>
        <div className="text-xs text-zinc-400">剩余：{(countdownMs / 1000).toFixed(1)}s</div>
      </div>
      <div className="mt-3 overflow-hidden rounded-lg bg-zinc-950">
        <CandleChart candles={candles} height={240} sellPrice={sellPrice} />
      </div>

      <div className="mt-3 flex gap-2">
        {gameState === "ready" && (
          <button
            type="button"
            onClick={onBuy}
            className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white shadow hover:bg-emerald-500 active:bg-emerald-600/90"
          >
            开始
          </button>
        )}

        {gameState === "running" && (
          <button
            type="button"
            onClick={onSell}
            className="flex-1 rounded-lg bg-amber-600 py-2 text-sm font-medium text-white shadow hover:bg-amber-500 active:bg-amber-600/90 disabled:opacity-60"
          >
            {sellPriceRef.current == null ? "卖出" : "已卖出"}
          </button>
        )}
      </div>

      {gameState === "ended" && (
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between text-zinc-300"><span>卖出价</span><span>{(sellPrice != null ? sellPrice : priceAtEnd).toFixed(3)}</span></div>
          <div className="flex justify-between text-zinc-300"><span>峰值价</span><span>{peakPrice.toFixed(3)}</span></div>
          <div className="flex justify-between text-zinc-200 font-medium"><span>得分</span><span>
            {finalScore.toFixed(3)}
          </span></div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onRestart}
              className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white shadow hover:bg-indigo-500"
            >
              再玩一次
            </button>
            <SubmitScoreButton score={finalScore} onSubmitted={onSubmitted} />
          </div>
        </div>
      )}
    </section>
  );
}

function CandleChart({ candles, height, sellPrice }: { candles: Candle[]; height: number; sellPrice?: number | null }) {
  const margin = { top: 10, right: 12, bottom: 16, left: 36 };
  const bodyWidth = 8;
  const gap = 3;
  const H = height;
  const innerH = H - margin.top - margin.bottom;
  const count = Math.max(candles.length, 40);
  const W = margin.left + margin.right + count * (bodyWidth + gap);

  let min = Number.MAX_SAFE_INTEGER;
  let max = 0;
  for (const c of candles) {
    min = Math.min(min, c.low);
    max = Math.max(max, c.high);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === Number.MAX_SAFE_INTEGER) {
    min = 90;
    max = 110;
  }
  const pad = (max - min) * 0.05 || 5;
  const yMin = min - pad;
  const yMax = max + pad;

  const y = (price: number) => margin.top + (yMax - price) * (innerH / (yMax - yMin || 1));

  const xForIndex = (i: number) => margin.left + i * (bodyWidth + gap);

  const ticks = 5;
  const grid: number[] = new Array(ticks + 1)
    .fill(0)
    .map((_, i) => Number((yMin + ((yMax - yMin) * i) / ticks).toFixed(3)));

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Candlestick price chart">
      <title>Candlestick price chart</title>
      <rect x={0} y={0} width={W} height={H} fill="#0b0b0b" rx={12} />
      {grid.map((p) => (
        <g key={`grid-${p}`}>
          <line x1={margin.left} x2={W - margin.right} y1={y(p)} y2={y(p)} stroke="#333" strokeDasharray="4 4" style={{ pointerEvents: "none" }} />
          <text x={4} y={y(p) + 4} fill="#888" fontSize={10} style={{ pointerEvents: "none" }}>
            {p.toFixed(3)}
          </text>
        </g>
      ))}

      {typeof sellPrice === "number" && (
        <g>
          <line
            x1={margin.left}
            x2={W - margin.right}
            y1={y(sellPrice)}
            y2={y(sellPrice)}
            stroke="#f59e0b"
            strokeWidth={2}
            style={{ pointerEvents: "none" }}
          />
          <text
            x={W - margin.right - 10}
            y={y(sellPrice) - 6}
            fill="#f59e0b"
            fontSize={12}
            fontWeight={700}
            style={{ pointerEvents: "none" }}
          >
            s
          </text>
        </g>
      )}

      {candles.map((c, i) => {
        const x = xForIndex(i);
        const isUp = c.close >= c.open;
        const color = isUp ? "#16a34a" : "#dc2626";
        const top = y(Number(Math.max(c.open, c.close).toFixed(3)));
        const bottom = y(Number(Math.min(c.open, c.close).toFixed(3)));
        const wickTop = y(c.high);
        const wickBottom = y(c.low);
        return (
          <g key={`c-${i}-${c.open.toFixed(2)}-${c.close.toFixed(2)}`}>
            <line x1={x + bodyWidth / 2} x2={x + bodyWidth / 2} y1={wickTop} y2={wickBottom} stroke={color} style={{ pointerEvents: "none" }} />
            <rect x={x} y={top} width={bodyWidth} height={Math.max(1, bottom - top)} fill={color} rx={1} style={{ pointerEvents: "none" }} />
          </g>
        );
      })}
    </svg>
  );
}

function SubmitScoreButton({ score, onSubmitted }: { score: number; onSubmitted?: () => void }) {
  const { isConnected } = useAccount();
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  // NOTE: 等你部署后把地址填进来
  const contractAddress = useMemo<`0x${string}`>(() => {
    const addr = (window as unknown as { __LEADERBOARD_ADDRESS__?: string }).__LEADERBOARD_ADDRESS__;
    return (addr as `0x${string}`) || "0x0000000000000000000000000000000000000000";
  }, []);

  const onSubmit = async () => {
    if (!isConnected) return;
    const txHash = await writeContractAsync({
      abi: leaderboardAbi as unknown as readonly unknown[],
      address: contractAddress,
      functionName: "submitScore",
      args: [BigInt(Math.round(score * SCORE_SCALE))],
    });
    if (publicClient) {
      await publicClient.waitForTransactionReceipt({ hash: txHash });
    }
    onSubmitted?.();
  };

  return (
    <div className="flex-1">
      <button
        type="button"
        disabled={!isConnected || isPending}
        onClick={onSubmit}
        className="w-full rounded-lg bg-emerald-700 py-2 text-sm font-medium text-white shadow hover:bg-emerald-600 disabled:opacity-60"
      >
        {isPending ? "提交中..." : "提交分数"}
      </button>
    </div>
  );
}

export default App;

// ---------------- Leaderboard ----------------

function Leaderboard() {
  const publicClient = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<{ player: `0x${string}`; bestScore: bigint }>>([]);

  const contractAddress = useMemo<`0x${string}`>(() => {
    const addr = (window as unknown as { __LEADERBOARD_ADDRESS__?: string }).__LEADERBOARD_ADDRESS__;
    return (addr as `0x${string}`) || "0x0000000000000000000000000000000000000000";
  }, []);

  const refresh = useCallback(async () => {
    if (!publicClient) return;
    if (contractAddress === "0x0000000000000000000000000000000000000000") return;
    setLoading(true);
    setError(null);
    try {
      const [players, scores] = (await publicClient.readContract({
        abi: leaderboardAbi as unknown as readonly unknown[],
        address: contractAddress,
        functionName: "getLowest20",
        args: [],
      })) as unknown as [readonly `0x${string}`[], readonly bigint[]];

      const list = players.map((p, i) => ({ player: p, bestScore: scores[i] }));
      setRows(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [publicClient, contractAddress]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="rounded-2xl bg-zinc-900/60 ring-1 ring-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-200">排行榜</h3>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 ring-1 ring-inset ring-white/10 hover:bg-zinc-700 disabled:opacity-50"
        >
          {loading ? "同步中..." : "刷新"}
        </button>
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}
      {rows.length === 0 && !loading && (
        <div className="text-center text-sm text-zinc-400">暂无成绩</div>
      )}

      {rows.length > 0 && (
        <ol className="divide-y divide-white/5 overflow-hidden rounded-xl bg-gradient-to-b from-zinc-950 to-zinc-900 ring-1 ring-white/10">
          {rows.map((r, idx) => (
            <li key={`${r.player}-${idx}`} className="relative flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-6 text-right text-xs font-bold text-zinc-300">{idx + 1}</span>
                <div className="h-6 w-6 rounded-full bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/30" />
                <span className="text-xs text-zinc-300">{shortAddr(r.player)}</span>
              </div>
              <div className="text-sm font-semibold text-emerald-300">
                {(Number(r.bestScore) / SCORE_SCALE).toFixed(3)}
              </div>
              <div className="pointer-events-none absolute inset-x-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
