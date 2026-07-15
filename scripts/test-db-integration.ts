import { loadSystemSettingsFromDisk } from "../src/lib/config/settings.repository";
import { listAllUsers } from "../src/lib/users/user.repository";
import { createManualClient, listClientsForUser } from "../src/lib/clients/clients.repository";

const users = await listAllUsers();
console.log("users", users.length, users[0]?.email);

const settings = await loadSystemSettingsFromDisk();
console.log("products", settings.products.length, settings.categories.length);

const master = users.find((user) => user.role === "master");
if (!master) throw new Error("Master não encontrado");

const clientsBefore = await listClientsForUser(master.id, true);
console.log("clients_before", clientsBefore.length);

const created = await createManualClient({
  productId: settings.products[0]?.id ?? "prod-clt",
  data: {
    nome: "Cliente Teste Supabase",
    cpf: "00000000000",
    telefone: "11999999999",
    tipo_cliente: "CLT",
    renda_mensal: "3000",
  },
  distribution: { type: "all" },
});

console.log("created", created.id);

const clientsAfter = await listClientsForUser(master.id, true);
console.log("clients_after", clientsAfter.length);
console.log("OK integração Supabase");
