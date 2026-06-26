import React, { useState, useEffect, useRef } from "react";

const SOURCE_CONFIG = {
  rule: {
    label: "Rule",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    dot: "bg-amber-400",
    icon: "⚡",
  },
  cache: {
    label: "Cache",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    dot: "bg-emerald-400",
    icon: "🟢",
  },
  llm: {
    label: "AI",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/25",
    dot: "bg-violet-400",
    icon: "✦",
  },
};

function SourceBadge({ source }) {
  const cfg = SOURCE_CONFIG[source];
  if (!cfg) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] mt-1.5 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest border ${cfg.color} ${cfg.bg} ${cfg.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.icon} {cfg.label}
    </span>
  );
}

function StatCard({ label, value, color = "text-slate-100", sub }) {
  return (
    <div className="bg-slate-900/70 rounded-xl border border-slate-800 p-4 flex flex-col gap-1">
      <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-2xl font-black tabular-nums ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-slate-600">{sub}</span>}
    </div>
  );
}

// Renders text with a blinking cursor appended while streaming
function StreamingText({ text }) {
  return (
    <span className="whitespace-pre-line text-sm leading-relaxed">
      {text}
      <span className="inline-block w-[2px] h-[14px] bg-violet-400 ml-0.5 align-middle animate-[blink_0.9s_step-end_infinite]" />
    </span>
  );
}

export default function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [stats, setStats] = useState(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const API_BASE_URL = "http://localhost:3000";

  // Refs for autoscroll
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Scroll whenever messages or streaming text changes
  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/stats`);
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error("Stats fetch error:", err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userQuery = input.trim();
    setMessages((prev) => [...prev, { role: "user", text: userQuery }]);
    setInput("");
    setIsStreaming(true);

    const url = `${API_BASE_URL}/api/chat?query=${encodeURIComponent(userQuery)}`;
    const eventSource = new EventSource(url);
    let runningText = "";

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.event === "chunk") {
        runningText += data.text;
        setStreamingMessage(runningText);
      } else if (data.event === "done") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: runningText, source: data.source },
        ]);
        setStreamingMessage("");
        setIsStreaming(false);
        eventSource.close();
        fetchStats();
      } else if (data.event === "error") {
        console.error("Stream error:", data.error);
        setStreamingMessage("");
        setIsStreaming(false);
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
      setStreamingMessage("");
      setIsStreaming(false);
      eventSource.close();
    };
  };

  const totalHandled = (stats?.rule_hits || 0) + (stats?.cache_hits || 0) + (stats?.llm_calls || 0);

  return (
    <>
      {/* Blink keyframe injection */}
      <style>{`
        @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .msg-appear { animation: fadeSlideUp 0.2s ease-out; }
      `}</style>

      <div className="min-h-screen bg-[#0d1117] text-white flex flex-col font-sans">
        {/* ── Header ── */}
        <header className="border-b border-slate-800/80 px-6 py-4 flex items-center justify-between backdrop-blur-sm bg-[#0d1117]/90 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-sm font-black shadow-lg">
              ✦
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-100 tracking-tight">
                Support Chat
              </h1>
              <p className="text-[10px] text-slate-500">
                Rule → Cache → AI routing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] bg-slate-800/60 border border-slate-700/50 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">Live</span>
          </div>
        </header>

        {/* ── Main layout ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* ── Chat panel ── */}
          <main className="flex flex-col flex-1 overflow-hidden">
            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-4 py-6 space-y-5 scroll-smooth"
            >
              {messages.length === 0 && !isStreaming && (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-20">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-2xl">
                    💬
                  </div>
                  <p className="text-slate-400 text-sm font-medium">
                    Ask anything
                  </p>
                  <p className="text-slate-600 text-xs max-w-xs">
                    Queries are routed through rules, semantic cache, then AI.
                    Watch the source badge to see which layer answered.
                  </p>
                  <div className="flex gap-2 mt-2 flex-wrap justify-center">
                    {["I forgot my password", "How do I cancel my subscription?", "i need to know about my billing details?"].map(
                      (q) => (
                        <button
                          key={q}
                          onClick={() => setInput(q)}
                          className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full px-3 py-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {q}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col msg-appear ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`px-4 py-3 rounded-2xl max-w-[75%] shadow-sm text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-br-sm"
                        : "bg-slate-800 text-slate-100 border border-slate-700/60 rounded-bl-sm"
                    }`}
                  >
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                  {msg.source && <SourceBadge source={msg.source} />}
                </div>
              ))}

              {/* Live streaming bubble */}
              {streamingMessage && (
                <div className="flex flex-col items-start msg-appear">
                  <div className="px-4 py-3 rounded-2xl rounded-bl-sm max-w-[75%] bg-slate-800 border border-violet-500/30 shadow-sm shadow-violet-900/20">
                    <StreamingText text={streamingMessage} />
                  </div>
                  <span className="text-[10px] mt-1.5 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest bg-violet-500/10 text-violet-400 border border-violet-500/25 animate-pulse">
                    ✦ Streaming from AI...
                  </span>
                </div>
              )}

              {/* Invisible scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div className="border-t border-slate-800/80 bg-[#0d1117]/95 backdrop-blur-sm px-4 py-4">
              <form
                onSubmit={handleSendMessage}
                className="flex gap-2 max-w-3xl mx-auto"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isStreaming}
                  placeholder={
                    isStreaming
                      ? "Waiting for response..."
                      : "Ask a support question..."
                  }
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-slate-100 text-sm placeholder-slate-600 transition-all disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={isStreaming || !input.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl font-semibold text-sm transition-colors shadow-md shadow-blue-900/30 flex items-center gap-2"
                >
                  {isStreaming ? (
                    <>
                      <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>Streaming</span>
                    </>
                  ) : (
                    "Send"
                  )}
                </button>
              </form>
            </div>
          </main>

          {/* ── Stats sidebar ── */}
          <aside className="w-64 border-l border-slate-800/80 bg-slate-900/40 p-4 hidden lg:flex flex-col gap-4 overflow-y-auto">
            <div>
              <h2 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3">
                Routing Stats
              </h2>
              <div className="grid grid-cols-2 gap-2">
                <StatCard
                  label="Total"
                  value={stats?.total_requests || 0}
                  color="text-slate-100"
                />
                <StatCard
                  label="Cache rate"
                  value={stats?.cache_hit_rate || "0%"}
                  color="text-emerald-400"
                />
              </div>
            </div>

            {/* Routing breakdown */}
            <div>
              <h2 className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-3">
                Layer Breakdown
              </h2>
              <div className="space-y-2">
                {[
                  { key: "rule", label: "Rule hits", value: stats?.rule_hits || 0 },
                  { key: "cache", label: "Cache hits", value: stats?.cache_hits || 0 },
                  { key: "llm", label: "LLM calls", value: stats?.llm_calls || 0 },
                ].map(({ key, label, value }) => {
                  const cfg = SOURCE_CONFIG[key];
                  const pct = totalHandled > 0 ? Math.round((value / totalHandled) * 100) : 0;
                  return (
                    <div key={key} className="bg-slate-900/70 rounded-xl border border-slate-800 p-3">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[11px] text-slate-400 font-medium">
                          {cfg.icon} {label}
                        </span>
                        <span className={`text-sm font-black tabular-nums ${cfg.color}`}>
                          {value}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1">
                        <div
                          className={`h-1 rounded-full ${cfg.dot} transition-all duration-700`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-600 mt-1">{pct}% of routed</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-auto pt-4 border-t border-slate-800/60">
              <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-2">
                Source legend
              </p>
              <div className="space-y-1.5">
                {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                    <span className="text-[11px] text-slate-500">
                      <span className={`font-bold ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                      {" — "}
                      {key === "rule" && "keyword matched"}
                      {key === "cache" && "vector similarity"}
                      {key === "llm" && "AI generated"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}