import { loadLocalEnvFile } from "../src/lib/db/load-env-file";
import {
  getEvolutionPublicConfig,
  isEvolutionConfigured,
} from "../src/lib/chat/evolution.adapter";

loadLocalEnvFile();
const config = getEvolutionPublicConfig();
console.log(
  JSON.stringify(
    {
      configured: isEvolutionConfigured(),
      apiUrlHost: config.apiUrlHost,
      instance: config.instance,
    },
    null,
    2,
  ),
);
