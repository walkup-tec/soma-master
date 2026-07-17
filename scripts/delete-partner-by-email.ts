/**
 * Exclusão pontual de parceiro por e-mail.
 * Uso: bun run scripts/delete-partner-by-email.ts mozart.hotmart@gmail.com
 */
import { loadLocalEnvFile } from "../src/lib/db/load-env-file";
import { getSql, isDatabaseEnabled } from "../src/lib/db/postgres";

loadLocalEnvFile();

const email = String(process.argv[2] || "")
  .trim()
  .toLowerCase();

if (!email.includes("@")) {
  console.error("Informe o e-mail: bun run scripts/delete-partner-by-email.ts email@dominio.com");
  process.exit(1);
}

if (!isDatabaseEnabled()) {
  console.error("DATABASE_URL não configurada.");
  process.exit(1);
}

const sql = await getSql();

const users = await sql<{ id: string; email: string; name: string; role: string }[]>`
  select id, email, name, role
  from crm.users
  where lower(email) = ${email}
  limit 1
`;

const user = users[0];
if (!user) {
  console.error(`Usuário não encontrado: ${email}`);
  process.exit(1);
}

if (user.role === "master") {
  console.error("Conta master não pode ser excluída.");
  process.exit(1);
}

const children = await sql<{ user_id: string; email: string }[]>`
  select p.user_id, u.email
  from crm.partner_profiles p
  join crm.users u on u.id = p.user_id
  where p.parent_user_id = ${user.id}
`;

if (children.length > 0) {
  console.error(
    `Não é possível excluir: há ${children.length} parceiro(s) abaixo deste cadastro.`,
  );
  for (const child of children) {
    console.error(` - ${child.email} (${child.user_id})`);
  }
  process.exit(1);
}

await sql.begin(async (tx) => {
  // Reapontar referências que bloquearão o delete do usuário.
  await tx`
    update crm.partner_profiles
    set blocked_by_user_id = null
    where blocked_by_user_id = ${user.id}
  `;
  await tx`
    update crm.partner_profiles
    set created_by_user_id = null
    where created_by_user_id = ${user.id}
  `;
  await tx`
    delete from crm.partner_events where partner_user_id = ${user.id} or actor_user_id = ${user.id}
  `;
  await tx`delete from crm.partner_banks where partner_user_id = ${user.id}`;
  await tx`delete from crm.user_menu_permissions where user_id = ${user.id}`;
  await tx`delete from crm.partner_profiles where user_id = ${user.id}`;
  const deleted = await tx`
    delete from crm.users where id = ${user.id} and role <> 'master'
    returning id
  `;
  if (!deleted[0]) {
    throw new Error("Falha ao excluir o usuário.");
  }
});

console.log(
  JSON.stringify(
    {
      ok: true,
      deletedEmail: user.email,
      deletedUserId: user.id,
      deletedName: user.name,
    },
    null,
    2,
  ),
);

process.exit(0);
