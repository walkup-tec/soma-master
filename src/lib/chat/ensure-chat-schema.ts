import type { Sql } from "@/lib/db/postgres";

let ensured = false;

/** Índice antigo (só telefone) quebra o boot quando o mesmo número existe em Evolution e Cloud. */
async function dropLegacyPhoneOnlyUnique(sql: Sql): Promise<void> {
  await sql`drop index if exists crm.uq_chat_conversations_phone`;
  await sql`drop index if exists public.uq_chat_conversations_phone`;
}

async function ensurePhoneInstanceUnique(sql: Sql): Promise<void> {
  await dropLegacyPhoneOnlyUnique(sql);
  try {
    await sql`
      create unique index if not exists uq_chat_conversations_phone_instance
      on crm.chat_conversations (phone, instance_name)
    `;
  } catch (error) {
    console.error("[chat] falha ao criar uq_chat_conversations_phone_instance", error);
  }
}

/** Migrations leves — sempre rodam (IF NOT EXISTS), mesmo após o bootstrap completo. */
async function ensureChatMigrations(sql: Sql): Promise<void> {
  await sql`
    alter table crm.chat_conversations
    add column if not exists contact_note text null
  `;
  await sql`
    alter table crm.chat_conversations
    add column if not exists bot_run jsonb null
  `;
  await sql`
    alter table crm.chat_conversations
    add column if not exists bot_enabled boolean not null default true
  `;
  await sql`
    alter table crm.chat_ai_settings
    add column if not exists webhook_public_base_url text null
  `;
  await sql`
    alter table crm.chat_ai_settings
    add column if not exists bot_global_enabled boolean not null default true
  `;
  await sql`
    alter table crm.chat_messages
    add column if not exists message_type text not null default 'text'
  `;
  await sql`
    alter table crm.chat_messages
    add column if not exists media_id text null
  `;
  await sql`
    alter table crm.chat_messages
    add column if not exists media_mime_type text null
  `;
  await sql`
    alter table crm.chat_messages
    add column if not exists media_file_name text null
  `;
  await sql`
    create table if not exists crm.chat_media (
      id text primary key,
      conversation_id text not null references crm.chat_conversations(id) on delete cascade,
      file_name text not null,
      file_size bigint not null,
      mime_type text not null,
      total_chunks int not null default 1,
      received_chunks int not null default 0,
      user_id text not null,
      user_name text not null,
      content bytea null,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists crm.chat_whatsapp_instances (
      id text primary key,
      instance_name text not null unique,
      label text not null,
      phone text null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    alter table crm.chat_whatsapp_instances
    add column if not exists provider text not null default 'evolution'
  `;
  await sql`
    alter table crm.chat_whatsapp_instances
    add column if not exists phone_number_id text null
  `;
  await sql`
    alter table crm.chat_whatsapp_instances
    add column if not exists waba_id text null
  `;
  await sql`
    alter table crm.chat_whatsapp_instances
    add column if not exists business_id text null
  `;
  await sql`
    alter table crm.chat_whatsapp_instances
    add column if not exists access_token_encrypted text null
  `;
  await sql`
    alter table crm.chat_whatsapp_instances
    add column if not exists verified_name text null
  `;
  await sql`
    alter table crm.chat_whatsapp_instances
    add column if not exists quality_rating text null
  `;
  await sql`
    alter table crm.chat_whatsapp_instances
    add column if not exists token_expires_at timestamptz null
  `;
  await sql`
    create unique index if not exists uq_chat_wa_phone_number_id
    on crm.chat_whatsapp_instances (phone_number_id)
    where phone_number_id is not null
  `;
  await sql`
    update crm.chat_whatsapp_instances
    set label = 'API Oficial 01', updated_at = now()
    where (
      phone_number_id = '1366741479851916'
      or instance_name = 'meta-1366741479851916'
      or phone = '5551926361688'
    )
    and label is distinct from 'API Oficial 01'
  `;
  await sql`
    alter table crm.chat_conversations
    add column if not exists instance_name text null
  `;
  await sql`
    update crm.chat_conversations
    set instance_name = coalesce(nullif(trim(instance_name), ''), 'soma-crm')
    where instance_name is null or trim(instance_name) = ''
  `;
  await sql`
    alter table crm.chat_conversations
    alter column instance_name set default 'soma-crm'
  `;
  // Unicidade por telefone + canal (API oficial e Evolution no mesmo número).
  await ensurePhoneInstanceUnique(sql);
  /** Momento da atribuição atual — base para “aguardando 1ª interação do atendente”. */
  await sql`
    alter table crm.chat_conversations
    add column if not exists assigned_at timestamptz null
  `;
  await sql`
    update crm.chat_conversations
    set assigned_at = coalesce(assigned_at, updated_at, created_at, now())
    where assigned_user_id is not null and assigned_at is null
  `;
  await sql`
    create index if not exists idx_chat_messages_conversation_agent
    on crm.chat_messages (conversation_id, sender_user_id)
    where sender_type = 'agent' and sender_user_id is not null
  `;
}

/** Tabelas do Chat WhatsApp + educação da IA. */
export async function ensureChatSchema(sql: Sql): Promise<void> {
  const g = globalThis as { __somaChatSchemaEnsured?: boolean };

  // Uma vez por processo: ALTER/INDEX em todo poll do Inbox travava páginas e o menu.
  if (ensured || g.__somaChatSchemaEnsured) return;

  await sql`create schema if not exists crm`;

  await sql`
    create table if not exists crm.chat_conversations (
      id text primary key,
      phone text not null,
      contact_name text null,
      client_id text null references crm.clients(id) on delete set null,
      assigned_user_id text null references crm.users(id) on delete set null,
      assigned_user_name text null,
      contact_note text null,
      ai_enabled boolean not null default true,
      last_message_at timestamptz null,
      last_message_preview text null,
      unread_count int not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await dropLegacyPhoneOnlyUnique(sql);
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
      message_type text not null default 'text',
      media_id text null,
      media_mime_type text null,
      media_file_name text null,
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
