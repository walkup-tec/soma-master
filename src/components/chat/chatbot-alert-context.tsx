import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { getChatbotIncomingAlertFn } from "@/lib/chat/chat.server";

export type ChatbotAlertState = {
  pendingCount: number;
  conversationIds: string[];
  /** True enquanto há contato novo aguardando no Chatbot. */
  active: boolean;
};

const EMPTY: ChatbotAlertState = {
  pendingCount: 0,
  conversationIds: [],
  active: false,
};

const ChatbotAlertContext = createContext<ChatbotAlertState>(EMPTY);

const POLL_MS = 8_000;

/** Tom curto e discreto (Web Audio) — sem arquivo externo. */
function playIncomingChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number, gainPeak: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    };

    playTone(880, now, 0.12, 0.045);
    playTone(1174, now + 0.14, 0.16, 0.035);

    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 500);
  } catch {
    /* autoplay / contexto bloqueado */
  }
}

export function ChatbotAlertProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const fetchAlert = useServerFn(getChatbotIncomingAlertFn);
  const [state, setState] = useState<ChatbotAlertState>(EMPTY);
  const knownIdsRef = useRef<Set<string> | null>(null);
  const primedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    try {
      const next = await fetchAlert();
      const ids = next.conversationIds ?? [];
      const pendingCount = next.pendingCount ?? ids.length;
      const active = pendingCount > 0;

      const prev = knownIdsRef.current;
      if (prev === null) {
        knownIdsRef.current = new Set(ids);
        primedRef.current = true;
      } else {
        const newcomers = ids.filter((id) => !prev.has(id));
        if (newcomers.length > 0 && primedRef.current) {
          playIncomingChime();
        }
        knownIdsRef.current = new Set(ids);
      }

      setState({ pendingCount, conversationIds: ids, active });
    } catch {
      /* sem permissão / rede */
    }
  }, [enabled, fetchAlert]);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      knownIdsRef.current = null;
      primedRef.current = false;
      return;
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  const value = useMemo(() => state, [state]);

  return <ChatbotAlertContext.Provider value={value}>{children}</ChatbotAlertContext.Provider>;
}

export function useChatbotAlert(): ChatbotAlertState {
  return useContext(ChatbotAlertContext);
}
