import {
  getConversation,
  updateConversationContactNote,
} from "@/lib/chat/chat.repository";
import type { ChatConversation } from "@/lib/chat/chat.types";
import { CHAT_CONTACT_NOTE_MAX_LENGTH } from "@/lib/chat/chat-contact-note.constants";

export async function saveChatContactNote(input: {
  conversationId: string;
  note: string;
}): Promise<ChatConversation> {
  const conversationId = input.conversationId.trim();
  if (!conversationId) throw new Error("Conversa obrigatória.");

  const conversation = await getConversation(conversationId);
  if (!conversation) throw new Error("Conversa não encontrada.");

  const note = input.note.trim();
  if (note.length > CHAT_CONTACT_NOTE_MAX_LENGTH) {
    throw new Error(`A observação deve ter no máximo ${CHAT_CONTACT_NOTE_MAX_LENGTH} caracteres.`);
  }

  return updateConversationContactNote(conversationId, note || null);
}
