"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Globe, X, Loader2, Square, User, Mic2, Bot, Plus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import WeatherCard from "@/components/WeatherCard";
import { WeatherData } from "@/lib/weather";

type Message = {
  role: "user" | "assistant";
  content: string;
  weather?: WeatherData;
  isStreaming?: boolean;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [lang, setLang] = useState<"ja" | "en">("ja");
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioLevels, setAudioLevels] = useState<number[]>(new Array(20).fill(0));
  const [chatStarted, setChatStarted] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const placeholders = {
    ja: [
      "行きたい場所や知りたい天気について聞いてください...",
      "東京の今日の天気は？",
      "週末のおすすめの旅行先は？",
      "雨の日でも楽しめる場所を教えて",
      "京都の美味しい食べ物は？",
      "近くでハイキングできる場所はある？"
    ],
    en: [
      "Ask about weather, destinations, or travel plans...",
      "What's the weather like in Tokyo today?",
      "Suggest some travel destinations for this weekend",
      "Tell me some places to enjoy even on a rainy day",
      "What is some delicious food in Kyoto?",
      "Are there any hiking spots nearby?"
    ]
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % placeholders[lang].length);
    }, 4000);
    return () => clearInterval(interval);
  }, [lang]);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => setRecordingTime((p) => p + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const updateWaveform = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        setAudioLevels(Array.from(data.slice(0, 20)).map((v) => v / 255));
        animationRef.current = requestAnimationFrame(updateWaveform);
      };
      updateWaveform();

      mediaRecorder.current = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        if (audioContextRef.current) audioContextRef.current.close();
        setAudioLevels(new Array(20).fill(0));
        await transcribeAudio(blob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic error:", err);
      alert(lang === "ja" ? "マイクへのアクセスを許可してください" : "Please allow microphone access");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob) => {
    setIsLoading(true);
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append("lang", lang);

    try {
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      const { text } = await res.json();
      
      const hallucinations = [
        "Thank you.", 
        "Thank you", 
        "You", 
        "ご視聴ありがとうございました", 
        "視聴ありがとうございました",
        "MBC 뉴스",
        "おやすみなさい" 
      ];

      const cleanedText = text?.trim();
      if (!cleanedText || hallucinations.some(h => cleanedText.toLowerCase() === h.toLowerCase())) {
        return;
      }

      setInput(cleanedText);
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    if (!chatStarted) setChatStarted(true);

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const history = [...messages, { role: "user" as const, content: userMessage }]
        .map(({ role, content }) => ({ role, content }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, weather, lang, stream: true }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      
      setMessages(prev => [...prev, { role: "assistant", content: "", isStreaming: true }]);
      setIsLoading(false);

      let currentWeather: WeatherData | null = null;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n\n').filter(line => line.startsWith('data: '));

          for (const line of lines) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              
              if (data.type === 'weather') {
                currentWeather = data.data;
                setWeather(data.data);
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastIdx = newMsgs.length - 1;
                  if (lastIdx >= 0 && newMsgs[lastIdx].role === 'assistant') {
                    newMsgs[lastIdx] = { ...newMsgs[lastIdx], weather: data.data };
                  }
                  return newMsgs;
                });
              } else if (data.type === 'text') {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastIdx = newMsgs.length - 1;
                  if (lastIdx >= 0 && newMsgs[lastIdx].role === 'assistant') {
                    newMsgs[lastIdx] = { 
                      ...newMsgs[lastIdx], 
                      content: newMsgs[lastIdx].content + data.data 
                    };
                  }
                  return newMsgs;
                });
              } else if (data.type === 'done') {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  const lastIdx = newMsgs.length - 1;
                  if (lastIdx >= 0 && newMsgs[lastIdx].role === 'assistant') {
                    newMsgs[lastIdx] = { ...newMsgs[lastIdx], isStreaming: false };
                  }
                  return newMsgs;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { role: "assistant", content: lang === "ja" ? "エラーが発生しました" : "An error occurred" }]);
      setIsLoading(false);
    }
  };

  const endChat = () => {
    setChatStarted(false);
    setMessages([]);
    setWeather(null);
  };

  const t = {
    title: "お出かけAI / Travel AI",
    subtitle: lang === "ja" ? "天気に合わせた外出・旅行の提案をAIがご案内します" : "Your intelligent weather-based travel companion",
    placeholder: placeholders[lang][placeholderIndex],
    listening: lang === "ja" ? "録音中..." : "Listening...",
    endChat: lang === "ja" ? "チャット終了" : "End Chat",
    recording: lang === "ja" ? "録音中..." : "Recording...",
    stopRecording: lang === "ja" ? "録音停止" : "Stop Recording",
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 bg-cover bg-center -z-20" style={{ backgroundImage: "url('/bg-travel.png')" }} />
      <div className="fixed inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/50 -z-10" />

      <div className="relative min-h-screen flex flex-col">
        {!chatStarted ? (
          <div className="flex-1 flex flex-col items-center justify-start pt-20 md:pt-28 px-4">
            <h1 className="text-5xl md:text-7xl font-bold text-white mb-3 text-center" style={{ fontFamily: "var(--font-cormorant), serif", textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
              <span className="italic font-light tracking-wide">{t.title}</span>
            </h1>
            <p className="text-white text-lg md:text-xl mb-10 text-center max-w-lg" style={{ textShadow: "0 1px 10px rgba(0,0,0,0.5)" }}>
              {t.subtitle}
            </p>

            <div className={`bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 overflow-hidden w-full max-w-xl`}>
              {isRecording ? (
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    <span className="font-mono text-gray-700">{formatTime(recordingTime)}</span>
                    <div className="flex items-center gap-0.5">
                      {audioLevels.slice(0, 12).map((level, i) => (
                        <div key={i} className="w-1 bg-red-400 rounded-full transition-all" style={{ height: `${Math.max(4, level * 24)}px` }} />
                      ))}
                    </div>
                  </div>
                  <button onClick={stopRecording} className="p-2 bg-red-500 hover:bg-red-600 rounded-full text-white transition-colors">
                    <Square size={16} fill="white" />
                  </button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder={t.placeholder}
                    disabled={isLoading}
                    className="w-full px-5 py-4 bg-transparent text-gray-700 placeholder-gray-400 outline-none text-base animate-placeholder-fade"
                  />
                  <div className="flex items-center justify-between px-3 pb-3">
                    <button
                      onClick={() => setLang(lang === "ja" ? "en" : "ja")}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                    >
                      <Globe size={16} />
                      {lang === "ja" ? "JP" : "EN"}
                    </button>
                    <button
                      onClick={input.trim() ? sendMessage : startRecording}
                      disabled={isLoading}
                      className="p-2.5 bg-blue-500 hover:bg-blue-600 rounded-xl text-white transition-colors disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 size={18} className="animate-spin" /> : input.trim() ? <Send size={18} /> : <Mic2 size={18} />}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="mt-8 flex justify-center">
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-1.5 flex items-center gap-2 shadow-lg">
                <span className="text-white/60 text-xs font-medium tracking-wide">Powered by</span>
                <span className="text-white/90 text-xs font-semibold">Groq</span>
                <span className="text-white/40 text-[10px]">•</span>
                <span className="text-white/90 text-xs font-semibold">OpenWeatherMap</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-2 md:p-4 h-screen">
            <div className="w-full max-w-3xl h-[95vh] bg-sky-200/40 backdrop-blur-2xl rounded-3xl border border-white/30 shadow-2xl flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-gray-800/90">
                <button onClick={endChat} className="flex items-center gap-2 text-white/80 hover:text-white transition-colors">
                  <X size={18} />
                  <span className="text-sm font-medium">{t.endChat}</span>
                </button>
                <button 
                  onClick={() => { setMessages([]); setWeather(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors text-sm"
                >
                  <Plus size={16} />
                  <span>{lang === "ja" ? "新規チャット" : "New Chat"}</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                {messages.map((msg, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm overflow-hidden ${
                        msg.role === "user" ? "bg-white" : "bg-white"
                      }`}>
                        {msg.role === "user" ? (
                          <User size={16} className="text-gray-600" />
                        ) : (
                          <Bot size={16} className="text-blue-500" />
                        )}
                      </div>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${
                        msg.role === "user" 
                          ? "bg-blue-500 text-white" 
                          : "bg-white text-gray-800 border border-gray-200"
                      }`}>
                        {msg.weather && (
                          <div className="mb-4 -mx-2">
                            <WeatherCard data={msg.weather} />
                          </div>
                        )}
                        
                        {msg.role === "user" ? (
                          <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                        ) : (
                          <div className="prose prose-sm max-w-none text-[15px] leading-relaxed prose-headings:font-bold prose-strong:font-semibold prose-ul:my-1 prose-li:my-0 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:marker:text-gray-500">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                            {msg.isStreaming && <span className="inline-block w-1.5 h-4 bg-blue-500 animate-pulse ml-0.5 align-middle" />}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden shadow-sm border border-gray-100">
                      <Bot size={16} className="text-blue-500" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl px-4 py-3 border border-gray-200 relative overflow-hidden">
                      <div className="absolute inset-0 animate-shimmer"></div>
                      <div className="flex items-center gap-2">
                        <Loader2 className="animate-spin text-gray-500" size={16} />
                        <span className="text-gray-500 text-sm">{lang === "ja" ? "考え中..." : "Thinking..."}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4">
                <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  {isRecording ? (
                    <div className="p-6 flex flex-col items-center gap-4">
                      <div className="flex items-center justify-center gap-1 h-12">
                        {audioLevels.length > 0 ? (
                          audioLevels.slice(0, 20).map((level, i) => (
                            <div 
                              key={i} 
                              className="w-1.5 bg-red-500 rounded-full transition-all duration-75" 
                              style={{ 
                                height: `${Math.max(8, level * 40)}px`,
                                opacity: 0.7 + (level * 0.3) 
                              }} 
                            />
                          ))
                        ) : (
                          [...Array(5)].map((_, i) => (
                            <div key={i} className="w-1.5 h-8 bg-red-400/50 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
                          ))
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600 font-medium animate-pulse">{t.recording}</span>
                      </div>

                      <button
                        onClick={stopRecording}
                        className="px-8 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-medium transition-colors shadow-md hover:shadow-lg transform active:scale-95"
                      >
                        {t.stopRecording}
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                        placeholder={t.placeholder}
                        disabled={isLoading}
                        className="w-full px-4 py-3 bg-transparent text-gray-700 placeholder-gray-400 outline-none text-[15px] animate-placeholder-fade"
                        autoFocus
                      />
                      <div className="flex items-center justify-between px-3 pb-3">
                        <button
                          onClick={() => setLang(lang === "ja" ? "en" : "ja")}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Globe size={14} />
                          {lang === "ja" ? "JP" : "EN"}
                        </button>
                        <button
                          onClick={input.trim() ? sendMessage : startRecording}
                          disabled={isLoading}
                          className="p-2 text-gray-400 hover:text-blue-500 transition-colors disabled:opacity-50"
                        >
                          {isLoading ? <Loader2 size={20} className="animate-spin" /> : input.trim() ? <Send size={20} /> : <Mic2 size={20} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
