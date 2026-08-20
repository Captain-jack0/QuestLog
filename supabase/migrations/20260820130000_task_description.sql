-- Tasks get the same free-text field projects already have: room for the detail that does
-- not fit in a title. Nullable and additive, so existing rows are untouched.
alter table tasks add column description text;
