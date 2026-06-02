create table if not exists public.billing_history (
    month text primary key,
    data jsonb not null default '[]'::jsonb,
    unit_prices jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.billing_history
add column if not exists unit_prices jsonb not null default '{}'::jsonb;

create table if not exists public.unit_prices (
    month text primary key,
    electric_price numeric not null default 0,
    water_price_m3 numeric not null default 0,
    water_price_person numeric not null default 0,
    water_fixed numeric not null default 0,
    trash_fee numeric not null default 0,
    light_fee numeric not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
    room text primary key,
    water_calc_type text not null default 'm3',
    people_count numeric not null default 0,
    room_price numeric not null default 0,
    trash_override numeric,
    light_override numeric,
    water_fixed_override numeric,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
