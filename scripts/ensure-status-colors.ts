import { getSql } from "../src/lib/db/postgres";
import { DEFAULT_ATTENDANCE_STATUSES } from "../src/lib/config/settings-defaults";

const sql = await getSql();
await sql`
  alter table crm.attendance_statuses
  add column if not exists color text not null default '#64748b'
`;
for (const status of DEFAULT_ATTENDANCE_STATUSES) {
  await sql`
    update crm.attendance_statuses
    set color = ${status.color}
    where id = ${status.id}
      and (color is null or color = '' or color = '#64748b')
  `;
}
const rows = await sql<{ id: string; label: string; color: string }[]>`
  select id, label, color from crm.attendance_statuses order by sort_order, label
`;
console.log(rows);
process.exit(0);
