import { createFileRoute } from "@tanstack/react-router";
import { ChatInboxScreen } from "@/components/chat/chat-inbox-screen";
import { getChatBootstrapFn } from "@/lib/chat/chat.server";
import { getSystemSettingsFn } from "@/lib/config/settings.server";

export const Route = createFileRoute("/app/chat")({
  loader: async () => {
    const [bootstrap, settings] = await Promise.all([getChatBootstrapFn(), getSystemSettingsFn()]);
    return {
      bootstrap,
      attendanceStatuses: settings.attendanceStatuses,
      products: settings.products,
      banks: settings.banks,
    };
  },
  staleTime: 5_000,
  component: ChatPage,
});

function ChatPage() {
  const { bootstrap, attendanceStatuses, products, banks } = Route.useLoaderData();
  return (
    <ChatInboxScreen
      bootstrap={bootstrap}
      attendanceStatuses={attendanceStatuses}
      products={products}
      banks={banks}
    />
  );
}
