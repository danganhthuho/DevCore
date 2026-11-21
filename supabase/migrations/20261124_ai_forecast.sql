-- AI demand forecast: store how each forecast was made, how accurate it was
-- on held-out sales, and the plain-English explanation shown in the app.
-- Safe to run more than once.
alter table public.demand_forecasts
  add column if not exists method             varchar(20),   -- 'ai-model' or 'moving-average'
  add column if not exists accuracy           numeric(4,2),  -- 0.00-1.00, backtest on the last 14 days
  add column if not exists explanation        text,
  add column if not exists explanation_source varchar(20);   -- 'claude' or 'template'

alter table public.demand_forecasts drop constraint if exists demand_forecasts_accuracy_check;
alter table public.demand_forecasts
  add constraint demand_forecasts_accuracy_check check (accuracy is null or (accuracy >= 0 and accuracy <= 1));
