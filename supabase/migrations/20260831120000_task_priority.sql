-- Tasks get the priority projects already carry (core_schema.sql:38), same low/med/high enum,
-- so both item types sort on one scale. No backfill update: since PG 11 an `add column` with a
-- non-volatile default hands existing rows the default straight from the catalogue, without
-- rewriting the table. Grants are table-level (rls.sql:32), so a new column needs no grant change.
alter table tasks add column priority priority not null default 'med';
