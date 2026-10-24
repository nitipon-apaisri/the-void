-- How big a space's map is: small, medium or large. Spaces made before sizes existed are medium.
alter table t_spaces add column if not exists size text not null default 'medium';
