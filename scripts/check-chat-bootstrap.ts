import { loadLocalEnvFile } from "../src/lib/db/load-env-file";

loadLocalEnvFile();

async function main() {
  const { getChatAiSettings, listConversations } = await import("../src/lib/chat/chat.repository");
  const settings = await getChatAiSettings();
  const list = await listConversations();
  console.log(
    JSON.stringify(
      {
        aiGlobalEnabled: settings.aiGlobalEnabled,
        webhookPublicBaseUrl: settings.webhookPublicBaseUrl || null,
        conversations: list.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("FAIL", error);
  process.exit(1);
});
