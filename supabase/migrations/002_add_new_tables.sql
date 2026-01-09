-- =============================================
-- 버스타볼까 기능 확장 - 새 테이블 생성
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. 즐겨찾기 정류소
create table if not exists public.favorite_stations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  station_id text not null,
  station_name text not null,
  x text,
  y text,
  created_at timestamptz default now(),
  unique(user_id, station_id)
);

-- 2. 즐겨찾기 노선
create table if not exists public.favorite_routes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  bus_id text not null,
  bus_no text not null,
  created_at timestamptz default now(),
  unique(user_id, bus_id)
);

-- 3. 검색 기록
create table if not exists public.search_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  search_type text not null,
  search_query text not null,
  result_id text,
  result_name text,
  created_at timestamptz default now()
);

-- 4. 출퇴근 경로
create table if not exists public.commute_routes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  origin_name text not null,
  origin_x text,
  origin_y text,
  dest_name text not null,
  dest_x text,
  dest_y text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 5. 알림 설정
create table if not exists public.notification_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  notification_type text not null,
  target_id text,
  target_name text,
  minutes_before int default 5,
  webhook_type text not null,
  webhook_url text not null,
  is_enabled boolean default true,
  created_at timestamptz default now()
);

-- 6. 버스 도착 시간 로그 (핵심 기능)
create table if not exists public.bus_arrival_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  bus_id text not null,
  bus_no text not null,
  station_id text not null,
  station_name text not null,
  arrival_time timestamptz not null,
  day_of_week int not null,
  created_at timestamptz default now()
);

-- 7. 버스 추적 대상 설정 (핵심 기능)
create table if not exists public.bus_tracking_targets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  bus_id text not null,
  bus_no text not null,
  station_id text not null,
  station_name text not null,
  is_active boolean default true,
  created_at timestamptz default now(),
  unique(user_id, bus_id, station_id)
);

-- =============================================
-- RLS (Row Level Security) 활성화
-- =============================================

alter table public.favorite_stations enable row level security;
alter table public.favorite_routes enable row level security;
alter table public.search_history enable row level security;
alter table public.commute_routes enable row level security;
alter table public.notification_settings enable row level security;
alter table public.bus_arrival_logs enable row level security;
alter table public.bus_tracking_targets enable row level security;

-- =============================================
-- RLS 정책 생성 - favorite_stations
-- =============================================

create policy "Users can view own favorite stations"
  on public.favorite_stations for select
  using (auth.uid() = user_id);

create policy "Users can insert own favorite stations"
  on public.favorite_stations for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own favorite stations"
  on public.favorite_stations for delete
  using (auth.uid() = user_id);

-- =============================================
-- RLS 정책 생성 - favorite_routes
-- =============================================

create policy "Users can view own favorite routes"
  on public.favorite_routes for select
  using (auth.uid() = user_id);

create policy "Users can insert own favorite routes"
  on public.favorite_routes for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own favorite routes"
  on public.favorite_routes for delete
  using (auth.uid() = user_id);

-- =============================================
-- RLS 정책 생성 - search_history
-- =============================================

create policy "Users can view own search history"
  on public.search_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own search history"
  on public.search_history for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own search history"
  on public.search_history for delete
  using (auth.uid() = user_id);

-- =============================================
-- RLS 정책 생성 - commute_routes
-- =============================================

create policy "Users can view own commute routes"
  on public.commute_routes for select
  using (auth.uid() = user_id);

create policy "Users can insert own commute routes"
  on public.commute_routes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own commute routes"
  on public.commute_routes for update
  using (auth.uid() = user_id);

create policy "Users can delete own commute routes"
  on public.commute_routes for delete
  using (auth.uid() = user_id);

-- =============================================
-- RLS 정책 생성 - notification_settings
-- =============================================

create policy "Users can view own notification settings"
  on public.notification_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert own notification settings"
  on public.notification_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notification settings"
  on public.notification_settings for update
  using (auth.uid() = user_id);

create policy "Users can delete own notification settings"
  on public.notification_settings for delete
  using (auth.uid() = user_id);

-- =============================================
-- RLS 정책 생성 - bus_arrival_logs
-- =============================================

create policy "Users can view own arrival logs"
  on public.bus_arrival_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own arrival logs"
  on public.bus_arrival_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own arrival logs"
  on public.bus_arrival_logs for delete
  using (auth.uid() = user_id);

-- =============================================
-- RLS 정책 생성 - bus_tracking_targets
-- =============================================

create policy "Users can view own tracking targets"
  on public.bus_tracking_targets for select
  using (auth.uid() = user_id);

create policy "Users can insert own tracking targets"
  on public.bus_tracking_targets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tracking targets"
  on public.bus_tracking_targets for update
  using (auth.uid() = user_id);

create policy "Users can delete own tracking targets"
  on public.bus_tracking_targets for delete
  using (auth.uid() = user_id);

-- =============================================
-- 인덱스 생성 (성능 최적화)
-- =============================================

create index if not exists idx_favorite_stations_user_id on public.favorite_stations(user_id);
create index if not exists idx_favorite_routes_user_id on public.favorite_routes(user_id);
create index if not exists idx_search_history_user_id on public.search_history(user_id);
create index if not exists idx_search_history_created_at on public.search_history(created_at desc);
create index if not exists idx_commute_routes_user_id on public.commute_routes(user_id);
create index if not exists idx_notification_settings_user_id on public.notification_settings(user_id);
create index if not exists idx_bus_arrival_logs_user_id on public.bus_arrival_logs(user_id);
create index if not exists idx_bus_arrival_logs_bus_station on public.bus_arrival_logs(bus_id, station_id);
create index if not exists idx_bus_arrival_logs_arrival_time on public.bus_arrival_logs(arrival_time desc);
create index if not exists idx_bus_tracking_targets_user_id on public.bus_tracking_targets(user_id);
create index if not exists idx_bus_tracking_targets_active on public.bus_tracking_targets(is_active) where is_active = true;
