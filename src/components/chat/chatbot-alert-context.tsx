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
  /** Topbar: só contato novo. */
  newContactActive: boolean;
  /** Menu lateral: mensagem recebida (unread). */
  unreadMessageActive: boolean;
  newContactCount: number;
  unreadConversationCount: number;
  /** Compat: espelha newContactActive (ícone topbar). */
  active: boolean;
  pendingCount: number;
  conversationIds: string[];
  setViewingConversationId: (id: string | null) => void;
};

const noopSetViewing = (_id: string | null) => undefined;

const EMPTY: ChatbotAlertState = {
  newContactActive: false,
  unreadMessageActive: false,
  newContactCount: 0,
  unreadConversationCount: 0,
  active: false,
  pendingCount: 0,
  conversationIds: [],
  setViewingConversationId: noopSetViewing,
};

const ChatbotAlertContext = createContext<ChatbotAlertState>(EMPTY);

const POLL_MS = 3_000;
const NEW_CONTACT_HOLD_MS = 45_000;

type UnreadMap = Record<string, number>;

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

    playTone(880, now, 0.14, 0.08);
    playTone(1174, now + 0.15, 0.18, 0.06);

    window.setTimeout(() => {
      void ctx.close().catch(() => undefined);
    }, 600);
  } catch {
    /* autoplay bloqueado */
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
  const [newContactActive, setNewContactActive] = useState(false);
  const [unreadMessageActive, setUnreadMessageActive] = useState(false);
  const [newContactCount, setNewContactCount] = useState(0);
  const [unreadConversationCount, setUnreadConversationCount] = useState(0);
  const [conversationIds, setConversationIds] = useState<string[]>([]);

  const viewingIdRef = useRef<string | null>(null);
  const knownAllIdsRef = useRef<Set<string> | null>(null);
  const knownUnreadMapRef = useRef<UnreadMap | null>(null);
  const primedRef = useRef(false);
  const newContactUntilRef = useRef(0);
  const [, setTick] = useState(0);

  const setViewingConversationId = useCallback((id: string | null) => {
    viewingIdRef.current = id;
  }, []);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setNewContactActive(false);
      setUnreadMessageActive(false);
      setNewContactCount(0);
      setUnreadConversationCount(0);
      setConversationIds([]);
      return;
    }
    try {
      const next = await fetchAlert();
      const viewingId = viewingIdRef.current;
      const allIds = next.allConversationIds ?? [];
      const unreadMap: UnreadMap = { ...(next.unreadByConversationId ?? {}) };
      if (viewingId) delete unreadMap[viewingId];

      const unreadIds = Object.keys(unreadMap).filter((id) => (unreadMap[id] ?? 0) > 0);

      const prevAll = knownAllIdsRef.current;
      const prevUnread = knownUnreadMapRef.current;

      let chime = false;
      let brandNewCount = 0;

      if (prevAll === null || prevUnread === null) {
        knownAllIdsRef.current = new Set(allIds);
        knownUnreadMapRef.current = { ...unreadMap };
        primedRef.current = true;
      } else {
        const brandNewIds = allIds.filter((id) => !prevAll.has(id) && id !== viewingId);
        brandNewCount = brandNewIds.length;
        if (brandNewIds.length > 0 && primedRef.current) {
          chime = true;
          newContactUntilRef.current = Date.now() + NEW_CONTACT_HOLD_MS;
        }

        if (primedRef.current) {
          for (const id of unreadIds) {
            if (id === viewingId) continue;
            const prevCount = prevUnread[id] ?? 0;
            const nextCount = unreadMap[id] ?? 0;
            if (nextCount > prevCount) {
              chime = true;
              break;
            }
          }
        }

        if (chime) playIncomingChime();

        knownAllIdsRef.current = new Set(allIds);
        knownUnreadMapRef.current = { ...unreadMap };
      }

      const holdNewContact = Date.now() < newContactUntilRef.current;
      setNewContactCount(holdNewContact ? Math.max(brandNewCount, 1) : 0);
      setNewContactActive(holdNewContact);
      setUnreadConversationCount(unreadIds.length);
      setUnreadMessageActive(unreadIds.length > 0);
      setConversationIds(unreadIds);
    } catch {
      /* silencioso */
    }
  }, [enabled, fetchAlert]);

  useEffect(() => {
    if (!enabled) {
      knownAllIdsRef.current = null;
      knownUnreadMapRef.current = null;
      primedRef.current = false;
      newContactUntilRef.current = 0;
      setNewContactActive(false);
      setUnreadMessageActive(false);
      return;
    }

    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const holdTick = window.setInterval(() => {
      if (Date.now() < newContactUntilRef.current) {
        setTick((n) => n + 1);
        setNewContactActive(true);
      } else if (newContactUntilRef.current > 0) {
        newContactUntilRef.current = 0;
        setNewContactActive(false);
        setNewContactCount(0);
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

  const value = useMemo<ChatbotAlertState>(
    () => ({
      newContactActive,
      unreadMessageActive,
      newContactCount,
      unreadConversationCount,
      active: newContactActive,
      pendingCount: newContactCount || unreadConversationCount,
      conversationIds,
      setViewingConversationId,
    }),
    [
      newContactActive,
      unreadMessageActive,
      newContactCount,
      unreadConversationCount,
      conversationIds,
      setViewingConversationId,
    ],
  );

  return <ChatbotAlertContext.Provider value={value}>{children}</ChatbotAlertContext.Provider>;
}

export function useChatbotAlert(): ChatbotAlertState {
  return useContext(ChatbotAlertContext);
}
