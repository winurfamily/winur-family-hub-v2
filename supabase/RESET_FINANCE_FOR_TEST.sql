-- Winur Family Hub V2 - finance/shopping test reset
--
-- This script is intentionally NOT referenced by migrations or deployment.
-- Run manually only after editing:
--   v_family_id := '<target family uuid>';
--   v_confirm   := 'RESET_FINANCE_FOR_TEST';
--
-- It preserves family profiles, auth, child world/task/reward/pet/avatar data,
-- and child savings pockets named "Tabungan {child name}".

begin;

do $$
declare
  v_family_id uuid := '00000000-0000-0000-0000-000000000000';
  v_confirm text := 'TYPE_RESET_FINANCE_FOR_TEST_HERE';
  v_receipt_paths text[];
  v_finance_pocket_ids uuid[];
begin
  if v_confirm <> 'RESET_FINANCE_FOR_TEST' then
    raise exception 'Reset aborted. Set v_confirm to RESET_FINANCE_FOR_TEST after reviewing counts.';
  end if;

  if not exists (select 1 from families where id = v_family_id) then
    raise exception 'Family % not found.', v_family_id;
  end if;

  create temp table if not exists finance_reset_counts(
    table_name text primary key,
    rows_to_delete bigint
  ) on commit drop;

  truncate finance_reset_counts;

  insert into finance_reset_counts(table_name, rows_to_delete)
  values
    ('income', (select count(*) from income where family_id = v_family_id)),
    ('pocket_transfers', (select count(*) from pocket_transfers where family_id = v_family_id)),
    ('shopping_transactions', (select count(*) from shopping_transactions where family_id = v_family_id)),
    ('shopping_transaction_items', (
      select count(*)
      from shopping_transaction_items i
      join shopping_transactions t on t.id = i.transaction_id
      where t.family_id = v_family_id
    )),
    ('shopping_plans', (select count(*) from shopping_plans where family_id = v_family_id)),
    ('shopping_plan_items', (
      select count(*)
      from shopping_plan_items i
      join shopping_plans p on p.id = i.plan_id
      where p.family_id = v_family_id
    )),
    ('receipt_attachments', (select count(*) from receipt_attachments where family_id = v_family_id)),
    ('receipt_storage_objects', (
      select count(*)
      from storage.objects
      where bucket_id = 'receipts'
        and name like v_family_id::text || '/%'
    ));

  raise notice 'Rows that will be reset: %', (
    select jsonb_object_agg(table_name, rows_to_delete)
    from finance_reset_counts
  );

  select coalesce(array_agg(storage_path), '{}') into v_receipt_paths
  from receipt_attachments
  where family_id = v_family_id
    and storage_path like v_family_id::text || '/%';

  select coalesce(array_agg(p.id), '{}') into v_finance_pocket_ids
  from pockets p
  where p.family_id = v_family_id
    and not exists (
      select 1
      from profiles child
      where child.family_id = v_family_id
        and child.role = 'child'
        and p.name = 'Tabungan ' || child.name
    );

  -- Detach plan item references first, then delete headers. Shopping item rows
  -- are removed by ON DELETE CASCADE from shopping_transactions.
  update shopping_plan_items
  set transaction_id = null
  where plan_id in (select id from shopping_plans where family_id = v_family_id);

  delete from receipt_attachments where family_id = v_family_id;

  if array_length(v_receipt_paths, 1) is not null then
    delete from storage.objects
    where bucket_id = 'receipts'
      and name = any(v_receipt_paths);
  end if;

  -- Remove orphan receipt objects belonging to this family path as well.
  delete from storage.objects
  where bucket_id = 'receipts'
    and name like v_family_id::text || '/%';

  delete from shopping_plan_items
  where plan_id in (select id from shopping_plans where family_id = v_family_id);

  update shopping_transactions
  set plan_id = null
  where family_id = v_family_id;

  delete from shopping_transactions where family_id = v_family_id;
  delete from shopping_plans where family_id = v_family_id;
  delete from pocket_transfers where family_id = v_family_id;
  delete from income where family_id = v_family_id;

  update families
  set main_balance = 0,
      main_balance_initialized = true
  where id = v_family_id;

  update pockets
  set balance = 0
  where family_id = v_family_id
    and id = any(v_finance_pocket_ids);

  raise notice 'Finance reset completed for family %. Child-world data was not deleted.', v_family_id;
end $$;

-- Review this result in the SQL console before commit is accepted.
select * from finance_reset_counts order by table_name;

commit;
