import type { Sql } from "@/lib/db/postgres";

let ensured = false;

/** Migrations leves — sempre rodam (IF NOT EXISTS), mesmo após o bootstrap completo. */
async function ensureChatMigrations(sql: Sql): Promise<void> {
  await sql`
    alter table crm.chat_ai_settings
    add column if not exists webhook_public_base_url text null
  `;
}

/** Tabelas do Chat WhatsApp + educação da IA. */
export async function ensureChatSchema(sql: Sql): Promise<void> {
  const g = globalThis as { __somaChatSchemaEnsured?: boolean };

  if (ensured || g.__somaChatSchemaEnsured) {
    await ensureChatMigrations(sql);
    ensured = true;
    g.__somaChatSchemaEnsured = true;
    return;
  }

  await sql`create schema if not exists crm`;

  await sql`
    create table if not exists crm.chat_conversations (
      id text primary key,
      phone text not null,
      contact_name text null,
      client_id text null references crm.clients(id) on delete set null,
      assigned_user_id text null references crm.users(id) on delete set null,
      assigned_user_name text null,
      ai_enabled boolean not null default true,
      last_message_at timestamptz null,
      last_message_preview text null,
      unread_count int not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create unique index if not exists uq_chat_conversations_phone
    on crm.chat_conversations (phone)
  `;
  await sql`
    create index if not exists idx_chat_conversations_last_message
    on crm.chat_conversations (last_message_at desc nulls last)
  `;

  await sql`
    create table if not exists crm.chat_messages (
      id text primary key,
      conversation_id text not null references crm.chat_conversations(id) on delete cascade,
      direction text not null,
      body text not null,
      sender_type text not null,
      sender_user_id text null,
      sender_name text null,
      wa_message_id text null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create index if not exists idx_chat_messages_conversation_created
    on crm.chat_messages (conversation_id, created_at asc)
  `;
  await sql`
    create unique index if not exists uq_chat_messages_wa_id
    on crm.chat_messages (wa_message_id)
    where wa_message_id is not null
  `;

  await sql`
    create table if not exists crm.chat_ai_settings (
      id text primary key default 'default',
      ai_global_enabled boolean not null default false,
      openai_model text not null default 'gpt-4o-mini',
      system_prompt text not null,
      updated_at timestamptz not null default now()
    )
  `;

  await ensureChatMigrations(sql);

  await sql`
    create table if not exists crm.chat_ai_knowledge (
      id text primary key,
      title text not null,
      content text not null,
      enabled boolean not null default true,
      sort_order int not null default 0,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create table if not exists crm.chat_ai_examples (
      id text primary key,
      user_says text not null,
      assistant_replies text not null,
      enabled boolean not null default true,
      sort_order int not null default 0,
      updated_at timestamptz not null default now()
    )
  `;

  ensured = true;
  g.__somaChatSchemaEnsured = true;
}
