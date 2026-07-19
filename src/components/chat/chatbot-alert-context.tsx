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
  /** True enquanto há unread ou contato novo recente. */
  active: boolean;
};

const EMPTY: ChatbotAlertState = {
  pendingCount: 0,
  conversationIds: [],
  active: false,
};

const ChatbotAlertContext = createContext<ChatbotAlertState>(EMPTY);

const POLL_MS = 3_000;
/** Mantém pulso/som visual por alguns segundos após contato novo (mesmo se abrir o chat). */
const FRESH_CONTACT_HOLD_MS = 45_000;

function playIncomingChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

    // Um pouco mais audível que a versão anterior
    playTone(880, now, 0.14, 0.08);
    playTone(1174, now + 0.15, 0.18, 0.06);

    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 600);
  } catch {
    /* autoplay bloqueado até interação */
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
  const knownAllIdsRef = useRef<Set<string> | null>(null);
  const knownUnreadIdsRef = useRef<Set<string> | null>(null);
  const primedRef = useRef(false);
  const freshUntilRef = useRef(0);
  const [, setTick] = useState(0);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState(EMPTY);
      return;
    }
    try {
      const next = await fetchAlert();
      const unreadIds = next.conversationIds ?? [];
      const allIds = next.allConversationIds ?? unreadIds;
      const pendingCount = next.pendingCount ?? unreadIds.length;

      const prevAll = knownAllIdsRef.current;
      const prevUnread = knownUnreadIdsRef.current;

      if (prevAll === null || prevUnread === null) {
        knownAllIdsRef.current = new Set(allIds);
        knownUnreadIdsRef.current = new Set(unreadIds);
        primedRef.current = true;
      } else {
        const newConversations = allIds.filter((id) => !prevAll.has(id));
        const newUnread = unreadIds.filter((id) => !prevUnread.has(id));
        const shouldChime =
          primedRef.current && (newConversations.length > 0 || newUnread.length > 0);

        if (shouldChime) {
          playIncomingChime();
          freshUntilRef.current = Date.now() + FRESH_CONTACT_HOLD_MS;
        }

        knownAllIdsRef.current = new Set(allIds);
        knownUnreadIdsRef.current = new Set(unreadIds);
      }

      const freshActive = Date.now() < freshUntilRef.current;
      setState({
        pendingCount,
        conversationIds: unreadIds,
        active: pendingCount > 0 || freshActive,
      });
    } catch {
      /* sem permissão / rede — silencioso */
    }
  }, [enabled, fetchAlert]);

  useEffect(() => {
    if (!enabled) {
      setState(EMPTY);
      knownAllIdsRef.current = null;
      knownUnreadIdsRef.current = null;
      primedRef.current = false;
      freshUntilRef.current = 0;
      return;
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const holdTick = window.setInterval(() => {
      if (Date.now() < freshUntilRef.current) setTick((n) => n + 1);
      else if (freshUntilRef.current > 0) {
        freshUntilRef.current = 0;
        setState((current) => ({
          ...current,
          active: current.pendingCount > 0,
        }));
      }
    }, 2_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.clearInterval(holdTick);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, refresh]);

  const value = useMemo(() => state, [state]);

  return <ChatbotAlertContext.Provider value={value}>{children}</ChatbotAlertContext.Provider>;
}

export function useChatbotAlert(): ChatbotAlertState {
  return useContext(ChatbotAlertContext);
}
