-- Deleting a task must not delete the history of it.
--
-- `progress_logs` is append-only on purpose: rls.sql:23-27 gives it insert + select and
-- deliberately no update/delete policy, and rls.sql:33 grants only `select, insert`. The owner
-- cannot erase their own log — rls.test.sql:40-52 proves it. `time_entries` is stricter still:
-- time_tracking.sql:29 grants `select` and nothing else.
--
-- A foreign key referential action honours none of that. Cascades run inside the referential
-- integrity machinery, past RLS and past table grants, so `on delete cascade` on `task_id`
-- (core_schema.sql:63, time_tracking.sql:7) handed every user the delete they were refused at
-- the front door: remove the task, and the log of the work — and the hours clocked against it —
-- went with it, silently. The history is the product; it does not get to vanish as a side
-- effect of tidying up a task list.
--
-- So both become `on delete set null`. `task_id` is already nullable in both tables and the
-- shape is already routine in the product: rpc_update_status.sql:82-88 writes project-level logs
-- with a null `task_id`, and timer.test.sql:77 clocks time against a project alone. Readers cope
-- already — v_running_timer `left join`s tasks (time_tracking.sql:162) and daily_focus_seconds
-- (time_tracking.sql:167-179) never looks at `task_id`. The house precedent is xp_events, whose
-- three references have been `set null` since day one (gamification.sql:8-10).
--
-- This overturns the reasoning written at next_step_task.sql:3-7, which read the cascade as
-- intentional ("a log about a deleted task has nothing left to be about"). A log about a deleted
-- task is about the work that was done, which happened whether or not the task row survives.
-- That file's own conclusion — that `progress_logs` has no delete policy *precisely because the
-- history is the product* — is the argument for this change.
--
-- `project_id` stays `not null` and stays cascade in both tables. Deleting a project really does
-- take its history: that is the deliberate asymmetry, the one delete that is a withdrawal rather
-- than a tidy-up. `restrict` was considered and rejected — `tasks.project_id` cascades
-- (core_schema.sql:48), so a restricted `task_id` would abort every project delete. `focus_items`
-- keeps its cascade too: `focus_items_one_target` (core_schema.sql:81) requires exactly one of
-- the two targets, so nulling `task_id` there would violate the check and break the delete.
--
-- The constraint names are re-used verbatim. Two foreign keys point from `progress_logs` at
-- `tasks`, so PostgREST embeds have to disambiguate by constraint name, and queries.ts:44 spells
-- one out. A renamed constraint would break that embed at runtime with nothing failing at build.

alter table progress_logs drop constraint progress_logs_task_id_fkey;

alter table progress_logs
  add constraint progress_logs_task_id_fkey
  foreign key (task_id) references tasks (id) on delete set null;

alter table time_entries drop constraint time_entries_task_id_fkey;

alter table time_entries
  add constraint time_entries_task_id_fkey
  foreign key (task_id) references tasks (id) on delete set null;
