-- =============================================================================
-- Qhapaq Travel Suite · Esquema PostgreSQL 17 · 20_fase1.sql
-- Fase 1 · MVP
-- Generado desde §3 de las especificaciones 00–18 + CONVENCIONES.md (fuente de verdad del kit).
-- Tablas nuevas: 94. Requiere: 00_extensions_and_functions.sql y archivos previos.
-- =============================================================================

set search_path = public;

-- ---------------------------------------------------------------- tablas
create table catalog_product_types (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  name varchar(60) not null,
  requires_itinerary boolean not null default false,
  requires_components boolean not null default true,
  sort_order smallint not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_product_types primary key (id)
);

create table catalog_product_categories (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  name varchar(80) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_product_categories primary key (id)
);

create table catalog_product_subcategories (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  category_id uuid not null,
  name varchar(80) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_product_subcategories primary key (id)
);

create table catalog_destinations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  parent_id uuid,
  name varchar(120) not null,
  type varchar(20) not null check (type in ('País', 'Región', 'Departamento', 'Provincia', 'Ciudad', 'Zona', 'Lugar', 'Atracción', 'Ruta')),
  level smallint not null check (level between 0 and 6),
  lat numeric(9,6) check (lat between -90 and 90),
  lng numeric(9,6) check (lng between -180 and 180),
  description text,
  path text not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_destinations primary key (id),
  constraint ck_catalog_destinations_1 check ((lat is null) = (lng is null)),
  constraint ck_catalog_destinations_2 check (parent_id is not null or type = 'País')
);

create table catalog_providers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  name varchar(160) not null,
  type varchar(20) not null check (type in ('Hotel', 'Transporte', 'Tren', 'Guía', 'Conductor', 'Restaurante', 'Operador', 'Actividad', 'Entrada', 'Otros')),
  ruc char(11) not null check (ruc ~ '^(10|15|17|20)[0-9]{9}$'),
  city varchar(80),
  stars smallint check (stars between 0 and 5),
  contact_name varchar(120) not null,
  phone varchar(40),
  email varchar(160),
  contract_start date not null,
  contract_end date not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  payment_terms varchar(120),
  status varchar(20) not null default 'inactivo' check (status in ('activo', 'inactivo', 'vencido')),
  rating numeric(2,1) not null default 0 check (rating = 0 or rating between 1 and 5),
  rating_note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_providers primary key (id),
  constraint ck_catalog_providers_1 check (contract_end >= contract_start)
);

create table catalog_provider_contacts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  provider_id uuid not null,
  name varchar(120) not null,
  role varchar(80),
  phone varchar(40),
  email varchar(160),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_provider_contacts primary key (id)
);

create table catalog_services (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  provider_id uuid not null,
  name varchar(200) not null,
  type varchar(20) not null check (type in ('Traslado', 'Transporte', 'Tren', 'Entrada', 'Guía', 'Alimentación', 'Alojamiento', 'Actividad', 'Tour', 'Seguro', 'Otro')),
  unit varchar(20) not null check (unit in ('pax', 'servicio', 'habitación', 'noche', 'vehículo', 'unidad')),
  cost numeric(14,2) not null check (cost >= 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  capacity integer,
  valid_from date not null,
  valid_to date not null,
  status varchar(20) not null default 'activo' check (status in ('activo', 'inactivo', 'vencido')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_services primary key (id),
  constraint ck_catalog_services_1 check (valid_to >= valid_from)
);

create table catalog_products (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  code varchar(30) not null,
  sku varchar(40) not null,
  name varchar(160) not null,
  internal_name varchar(160) not null,
  product_type_id uuid not null,
  category_id uuid not null,
  subcategory_id uuid,
  primary_destination_id uuid not null,
  status varchar(20) not null default 'DRAFT' check (status in ('DRAFT', 'REVIEW', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED')),
  short_description text,
  long_description text,
  duration_value numeric(6,1) not null check (duration_value >= 1),
  duration_unit varchar(10) not null check (duration_unit in ('horas', 'días', 'noches')),
  modality varchar(15) not null check (modality in ('Privado', 'Compartido', 'Grupal')),
  main_provider_id uuid,
  minimum_passengers smallint not null default 1,
  maximum_passengers smallint not null default 1,
  minimum_age smallint not null default 0,
  maximum_age smallint not null default 99,
  booking_advance_min_days smallint not null default 0,
  booking_advance_max_days smallint not null default 365,
  is_bookable boolean not null default true,
  is_quoteable boolean not null default true,
  is_b2b boolean not null default false,
  is_ecommerce boolean not null default false,
  is_featured boolean not null default false,
  markup_pct numeric(6,2) not null default 25,
  availability_model varchar(20) not null default 'SIN_CONTROL' check (availability_model in ('SIN_CONTROL', 'CUPOS', 'CAPACIDAD', 'POR_PROVEEDOR', 'POR_ACTIVIDAD', 'POR_TRANSPORTE', 'POR_HABITACION', 'POR_SALIDA', 'POR_FECHA')),
  availability_capacity integer,
  availability_source varchar(10) not null default 'interna' check (availability_source in ('interna', 'externa')),
  features jsonb not null default '[]',
  video_url varchar(500),
  seo_title varchar(120),
  seo_description varchar(320),
  slug varchar(160) check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  current_version_id uuid,
  attributes jsonb not null default '{}',
  operating_weekdays smallint[] not null default '{0,1,2,3,4,5,6}' check (cardinality(operating_weekdays) >= 1),
  cutoff_hours integer check (cutoff_hours between 0 and 8760),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_products primary key (id),
  constraint ck_catalog_products_1 check (minimum_passengers >= 1 and maximum_passengers >= minimum_passengers),
  constraint ck_catalog_products_2 check (minimum_age >= 0 and maximum_age >= minimum_age),
  constraint ck_catalog_products_3 check (booking_advance_max_days >= booking_advance_min_days)
);

create table catalog_product_versions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  version varchar(10) not null,
  status varchar(15) not null default 'borrador' check (status in ('borrador', 'en_revision', 'vigente', 'historica')),
  valid_from date not null,
  reason text not null,
  snapshot jsonb not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_catalog_product_versions primary key (id)
);

create table catalog_product_destinations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  destination_id uuid not null,
  role varchar(10) not null default 'secondary' check (role = 'secondary'),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_destinations primary key (id)
);

create table catalog_product_items (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  service_id uuid,
  component_product_id uuid,
  provider_id uuid,
  quantity numeric(8,2) not null default 1 check (quantity >= 1),
  unit varchar(20) not null check (unit in ('pax', 'servicio', 'habitación', 'noche', 'vehículo', 'unidad')),
  sort_order smallint not null default 0,
  is_required boolean not null default true,
  is_included boolean not null default true,
  unit_cost_override numeric(14,2),
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_items primary key (id),
  constraint ck_catalog_product_items_1 check (num_nonnulls(service_id, component_product_id) = 1),
  constraint ck_catalog_product_items_2 check (component_product_id is null or component_product_id <> product_id)
);

create table catalog_itineraries (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  name varchar(120) not null default 'Principal',
  is_default boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_itineraries primary key (id)
);

create table catalog_itinerary_days (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  itinerary_id uuid not null,
  day_number smallint not null,
  title varchar(160) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_itinerary_days primary key (id)
);

create table catalog_itinerary_items (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  day_id uuid not null,
  start_time time,
  activity varchar(200) not null,
  item_type varchar(20) check (item_type is null or item_type in ('Traslado', 'Transporte', 'Tren', 'Hotel', 'Alimentación', 'Guía', 'Actividad', 'Entrada', 'Libre', 'Otro')),
  location varchar(160),
  service_id uuid,
  note text,
  image_ref varchar(300),
  cost numeric(14,2) not null default 0,
  price numeric(14,2) not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_itinerary_items primary key (id)
);

create table catalog_product_inclusions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  kind varchar(10) not null check (kind in ('include', 'exclude')),
  text varchar(200) not null,
  sort_order smallint not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_inclusions primary key (id)
);

create table catalog_product_requirements (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  category varchar(30) check (category is null or category in ('Condición física', 'Documentos', 'Nacionalidad', 'Restricción', 'Recomendación', 'Equipamiento', 'Requisito especial')),
  text varchar(300) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_requirements primary key (id)
);

create table catalog_product_policies (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  cancellation text not null,
  modification text not null,
  no_show text not null,
  penalties text,
  refund text not null,
  date_change text,
  advance_min varchar(40),
  advance_max varchar(40),
  penalty_tiers jsonb not null default '[]',
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_policies primary key (id)
);

create table catalog_product_related (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  related_product_id uuid not null,
  relation varchar(20) not null check (relation in ('Complementario', 'Alternativo', 'Upgrade', 'Cross-sell', 'Upsell')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_related primary key (id),
  constraint ck_catalog_product_related_1 check (related_product_id <> product_id)
);

create table catalog_seasons (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  name varchar(120) not null,
  type varchar(20) not null check (type in ('Alta', 'Media', 'Baja', 'Feriado', 'Fecha especial', 'Personalizada')),
  date_from date not null,
  date_to date not null,
  priority smallint not null default 0 check (priority >= 0),
  factor numeric(4,2) not null default 1 check (factor > 0 and factor <= 3),
  status varchar(10) not null default 'activa' check (status in ('activa', 'inactiva')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_seasons primary key (id),
  constraint ck_catalog_seasons_1 check (date_to >= date_from)
);

create table catalog_product_promotions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  product_id uuid not null,
  name varchar(120) not null,
  kind varchar(30) not null check (kind in ('Precio promocional', 'Descuento fijo', 'Descuento %', 'Promoción por fecha', 'Descuento por cantidad', 'Promoción por temporada', 'Promoción por canal', 'Código promocional')),
  value numeric(12,2) not null check (value > 0),
  channel varchar(20) not null default 'Todos' check (channel in ('Todos', 'Directo', 'E-commerce', 'B2B', 'Corporativo')),
  promo_code varchar(40) check (promo_code is null or promo_code = upper(promo_code)),
  min_pax smallint,
  date_from date not null,
  date_to date not null,
  status varchar(10) not null default 'activa' check (status in ('activa', 'inactiva')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_product_promotions primary key (id),
  constraint ck_catalog_product_promotions_1 check (date_to >= date_from)
);

create table catalog_product_media (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  kind varchar(10) not null default 'image' check (kind in ('image')),
  storage_path varchar(400) not null,
  alt_text varchar(200) not null,
  is_main boolean not null default false,
  sort_order smallint not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_media primary key (id)
);

create table catalog_product_faqs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  question varchar(300) not null,
  answer text not null,
  sort_order smallint not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_faqs primary key (id)
);

create table catalog_product_channels (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  channel varchar(12) not null check (channel in ('erp', 'crm', 'quotes', 'b2b', 'portal', 'portal_pax', 'cms', 'ecommerce', 'mobile')),
  is_published boolean not null default false,
  published_at timestamptz,
  published_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_channels primary key (id)
);

create table catalog_product_seasons (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  season_id uuid not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_seasons primary key (id)
);

create table catalog_product_config_groups (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  name varchar(60) not null,
  sort_order smallint not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_config_groups primary key (id)
);

create table catalog_product_config_options (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  group_id uuid not null,
  label varchar(80) not null,
  price_delta numeric(14,2) not null default 0,
  sort_order smallint not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_config_options primary key (id)
);

create table catalog_rates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  product_id uuid not null,
  rate_type varchar(15) not null check (rate_type in ('Proveedor', 'Costo', 'Venta', 'Retail', 'B2B', 'Mayorista', 'Corporativa', 'VIP', 'Promocional', 'Especial', 'Grupal')),
  segment varchar(10) not null check (segment in ('Adulto', 'Niño', 'Infante', 'Pasajero', 'Grupo')),
  channel varchar(12) not null check (channel in ('Directo', 'B2B', 'Corporativo', 'E-commerce', 'Mayorista', 'Todos')),
  currency char(3) not null check (currency in ('PEN','USD')),
  price_basis varchar(15) not null default 'Por persona' check (price_basis in ('Por persona', 'Precio fijo', 'Por grupo', 'Por habitación', 'Por unidad')),
  cost numeric(14,2) not null check (cost >= 0),
  price numeric(14,2) not null check (price > 0),
  min_price numeric(14,2),
  max_price numeric(14,2),
  valid_from date not null,
  valid_to date not null,
  season_id uuid,
  conditions varchar(300),
  status varchar(10) not null default 'vigente' check (status in ('vigente', 'inactiva')),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_rates primary key (id),
  constraint ck_catalog_rates_1 check (valid_to >= valid_from),
  constraint ck_catalog_rates_2 check (min_price is null or price >= min_price),
  constraint ck_catalog_rates_3 check (max_price is null or price <= max_price)
);

create table catalog_rate_conditions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  rate_id uuid not null,
  kind varchar(20) not null check (kind in ('weekday', 'min_pax', 'max_pax', 'min_age', 'max_age', 'advance_days_min', 'advance_days_max', 'customer_type', 'occupancy', 'duration')),
  operator varchar(4) not null,
  value jsonb not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_rate_conditions primary key (id)
);

create table catalog_price_rules (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  name varchar(120) not null,
  kind varchar(20) not null check (kind in ('Markup %', 'Markup fijo', 'Descuento %', 'Descuento fijo', 'Impuesto %', 'Comisión %', 'Redondeo', 'Precio mínimo', 'Precio máximo')),
  value numeric(12,4) not null,
  scope varchar(200) not null,
  channel varchar(12),
  min_pax smallint,
  customer_residency varchar(10) check (customer_residency is null or customer_residency in ('dom', 'nodom')),
  product_id uuid,
  currency char(3),
  priority smallint not null default 100,
  status varchar(10) not null default 'activa' check (status in ('activa', 'inactiva')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_price_rules primary key (id)
);

create table catalog_product_departures (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  product_id uuid not null,
  departure_date date not null,
  departure_time time not null,
  capacity smallint not null check (capacity between 1 and 60),
  sold smallint not null default 0,
  status varchar(12) not null default 'abierta' check (status in ('abierta', 'completa', 'cerrada', 'cancelada')),
  provider_id uuid,
  guide_id uuid,
  vehicle_id uuid,
  meeting_point varchar(160) not null,
  return_point varchar(160),
  notes text,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_product_departures primary key (id),
  constraint ck_catalog_product_departures_1 check (sold >= 0 and sold <= capacity)
);

create table catalog_availability_holds (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ref varchar(20) not null,
  departure_id uuid,
  product_id uuid,
  service_date date,
  quantity smallint not null check (quantity >= 1),
  reference varchar(60) not null,
  reference_type varchar(20),
  reference_id uuid,
  status varchar(12) not null default 'hold' check (status in ('hold', 'confirmada', 'liberada', 'expirada', 'consumida')),
  expires_at timestamptz not null,
  released_reason text,
  notes text,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_availability_holds primary key (id),
  constraint ck_catalog_availability_holds_1 check (departure_id is not null or (product_id is not null and service_date is not null)),
  constraint ck_catalog_availability_holds_2 check (status <> 'liberada' or released_reason is not null)
);

create table catalog_availability_ranges (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  code varchar(20) not null,
  date_from date not null,
  date_to date not null,
  status varchar(20) not null default 'disponible' check (status in ('disponible', 'cerrado', 'agotado')),
  capacity_per_day integer not null default 0,
  note varchar(200),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_catalog_availability_ranges primary key (id),
  constraint ck_catalog_availability_ranges_1 check (date_to >= date_from),
  constraint ck_catalog_availability_ranges_2 check (date_to - date_from <= 730),
  constraint ck_catalog_availability_ranges_3 check (status <> 'disponible' or capacity_per_day between 1 and 500)
);

create table catalog_pax_rules (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  product_id uuid not null,
  adult_min_age smallint not null,
  child_min_age smallint not null,
  child_max_age smallint not null,
  infant_max_age smallint not null,
  child_pays boolean not null default true,
  child_price_pct numeric(5,2) not null default 100 check (child_price_pct between 0 and 100),
  infant_allowed boolean not null default true,
  infant_pays boolean not null default false,
  max_children_per_adult smallint not null default 10 check (max_children_per_adult between 0 and 10),
  max_infants_per_adult smallint not null default 5 check (max_infants_per_adult between 0 and 5),
  min_adults smallint not null default 1 check (min_adults between 0 and 10),
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_catalog_pax_rules primary key (id),
  constraint ck_catalog_pax_rules_1 check (infant_max_age < child_min_age and child_min_age <= child_max_age and child_max_age < adult_min_age)
);

create table crm_catalog_items (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  kind varchar(30) not null check (kind in ('lead_source', 'lead_channel', 'lead_interest', 'client_segment', 'lost_reason', 'discard_reason', 'case_type', 'survey_channel', 'activity_type')),
  code varchar(40) not null,
  label varchar(120) not null,
  requires_detail boolean not null default false,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_catalog_items primary key (id)
);

create table crm_clients (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  kind varchar(10) not null check (kind in ('persona', 'empresa')),
  name varchar(200) not null,
  doc_type varchar(10) not null check (doc_type in ('DNI', 'RUC', 'PASAPORTE', 'CE')),
  doc_number varchar(20) not null check (doc_number !~ '\s'),
  email varchar(190),
  email_norm varchar(190) generated always as (lower(trim(email))) stored,
  phone varchar(40),
  phone_norm varchar(9),
  country varchar(80) not null default 'Perú',
  city varchar(80),
  birth_date date,
  segment_code varchar(40) not null,
  owner_id uuid not null,
  tags text[] not null default '{}',
  nps_last smallint check (nps_last between 0 and 10),
  source_lead_id uuid,
  b2b_agency_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_crm_clients primary key (id),
  constraint ck_crm_clients_1 check (email is not null or phone is not null),
  constraint ck_crm_clients_2 check (kind <> 'empresa' or country <> 'Perú' or doc_type = 'RUC')
);

create table crm_leads (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  full_name varchar(160) not null,
  company varchar(160),
  email varchar(190),
  email_norm varchar(190) generated always as (lower(trim(email))) stored,
  phone varchar(40),
  phone_norm varchar(9),
  channel_code varchar(40) not null,
  source_code varchar(40) not null,
  interest_code varchar(40) not null,
  destination_id uuid,
  destination_label varchar(120),
  product_id uuid,
  travel_date date,
  pax smallint not null default 0 check (pax >= 0),
  status varchar(30) not null default 'nuevo' check (status in ('nuevo', 'contactado', 'calificado', 'convertido', 'duplicado', 'descartado')),
  owner_id uuid,
  score smallint not null default 0 check (score between 0 and 100),
  notes text,
  duplicate_of_type varchar(10) check (duplicate_of_type is null or duplicate_of_type in ('lead', 'client')),
  duplicate_of_id uuid,
  validated_at timestamptz not null default now(),
  assigned_at timestamptz,
  taken_by uuid,
  first_contact_at timestamptz,
  discard_reason_code varchar(40),
  discard_detail text,
  discarded_at timestamptz,
  discarded_at_step smallint check (discarded_at_step between 0 and 7),
  converted_client_id uuid,
  converted_opportunity_id uuid,
  converted_at timestamptz,
  converted_by uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_crm_leads primary key (id),
  constraint ck_crm_leads_1 check (email is not null or phone is not null),
  constraint ck_crm_leads_2 check (status <> 'convertido' or (converted_client_id is not null and converted_opportunity_id is not null)),
  constraint ck_crm_leads_3 check (status <> 'descartado' or discard_reason_code is not null),
  constraint ck_crm_leads_4 check ((duplicate_of_type is null) = (duplicate_of_id is null)),
  constraint ck_crm_leads_5 check (status in ('nuevo') or owner_id is not null or status in ('duplicado','descartado'))
);

create table crm_lead_qualifications (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  lead_id uuid not null,
  budget smallint not null check (budget in (0,10,18,25)),
  authority smallint not null check (authority in (0,10,18,25)),
  need smallint not null check (need in (0,10,18,25)),
  timeline smallint not null check (timeline in (0,10,18,25)),
  score smallint generated always as (budget + authority + need + timeline) stored,
  declared_amount numeric(14,2) check (declared_amount >= 0),
  currency char(3) check (currency in ('PEN','USD')),
  notes text,
  qualified_by uuid not null,
  qualified_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_lead_qualifications primary key (id)
);

create table crm_client_contacts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  client_id uuid not null,
  name varchar(160) not null,
  role varchar(120),
  email varchar(190),
  phone varchar(40),
  is_primary boolean not null default false,
  source_lead_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_client_contacts primary key (id)
);

create table crm_pipeline_stages (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null check (code in ('calificacion','descubrimiento','cotizacion','negociacion','ganada','perdida')),
  name varchar(60) not null,
  default_probability smallint not null check (default_probability between 0 and 100),
  sort_order smallint not null,
  is_closed boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_pipeline_stages primary key (id)
);

create table crm_opportunities (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  client_id uuid not null,
  title varchar(200) not null,
  stage varchar(30) not null default 'descubrimiento' check (stage in ('calificacion', 'descubrimiento', 'cotizacion', 'negociacion', 'ganada', 'perdida')),
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  probability smallint not null check (probability between 0 and 100),
  expected_close_date date not null,
  closed_at date,
  owner_id uuid not null,
  destination_label varchar(120),
  pax smallint not null default 0 check (pax >= 0),
  lead_id uuid,
  product_id uuid,
  origin varchar(40),
  notes text,
  lost_reason_code varchar(40),
  lost_detail text,
  lost_at_stage varchar(30),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_crm_opportunities primary key (id),
  constraint ck_crm_opportunities_1 check (stage <> 'perdida' or (lost_reason_code is not null and probability = 0 and closed_at is not null)),
  constraint ck_crm_opportunities_2 check (stage <> 'ganada' or (probability = 100 and closed_at is not null)),
  constraint ck_crm_opportunities_3 check (stage in ('ganada','perdida') or closed_at is null)
);

create table crm_activities (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  type varchar(20) not null check (type in ('llamada', 'email', 'whatsapp', 'reunion', 'tarea', 'postventa')),
  subject varchar(200) not null,
  description text,
  related_type varchar(20) check (related_type is null or related_type in ('lead', 'opportunity', 'client', 'quote', 'reservation')),
  related_id uuid,
  owner_id uuid not null,
  due_at timestamptz not null,
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'vencida', 'completada')),
  result text,
  completed_at timestamptz,
  completed_by uuid,
  auto_closed boolean not null default false,
  previous_activity_id uuid,
  merged_from_lead_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_activities primary key (id),
  constraint ck_crm_activities_1 check ((related_type is null) = (related_id is null)),
  constraint ck_crm_activities_2 check (status <> 'completada' or result is not null)
);

create table crm_surveys (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  client_id uuid not null,
  reservation_id uuid,
  score smallint not null check (score between 0 and 10),
  category varchar(10) generated always as (case when score >= 9 then 'promotor' when score >= 7 then 'pasivo' else 'detractor' end) stored,
  comment text,
  channel_code varchar(40) not null,
  responded_at timestamptz not null,
  recorded_by uuid not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_surveys primary key (id)
);

create table crm_cases (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  client_id uuid,
  reservation_id uuid,
  survey_id uuid,
  origin varchar(20) not null default 'manual' check (origin in ('manual', 'nps_auto')),
  type_code varchar(40) not null,
  priority varchar(10) not null default 'media' check (priority in ('baja', 'media', 'alta', 'critica')),
  subject varchar(200) not null,
  description text not null,
  status varchar(20) not null default 'abierta' check (status in ('abierta', 'en_proceso', 'resuelta', 'cerrada')),
  owner_id uuid not null,
  resolution text,
  resolved_at timestamptz,
  closed_at timestamptz,
  is_book boolean not null default false,
  book_number varchar(25),
  sede_id uuid,
  channel varchar(30) check (channel is null or channel in ('web', 'customer_portal', 'passenger_portal', 'in_person')),
  book_status varchar(20) check (book_status is null or book_status in ('received', 'in_review', 'answered', 'closed')),
  consumer text,
  good jsonb,
  detail text,
  request text,
  received_at timestamptz,
  due_date date,
  response_days smallint,
  response jsonb,
  close_note text,
  ack_sent_at timestamptz,
  submitted_by uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_cases primary key (id),
  constraint ck_crm_cases_1 check (status <> 'resuelta' or resolution is not null),
  constraint ck_crm_cases_2 check (not is_book or (book_number is not null and sede_id is not null and book_status is not null and received_at is not null and due_date is not null)),
  constraint ck_crm_cases_3 check (is_book or client_id is not null)
);

create table crm_case_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  case_id uuid not null,
  event varchar(20) not null check (event in ('registro', 'estado', 'seguimiento')),
  from_status varchar(20),
  to_status varchar(20),
  message text not null,
  user_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_crm_case_events primary key (id)
);

create table crm_claim_book_settings (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  response_days smallint not null default 15 check (response_days between 1 and 30),
  alert_days smallint not null default 3,
  retention_years smallint not null default 2 check (retention_years >= 2),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_crm_claim_book_settings primary key (id)
);

create table sys_holidays (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid default app_current_tenant_id(),
  date date not null,
  name varchar(120) not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_sys_holidays primary key (id)
);

create table quote_quotes (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  client_id uuid not null,
  opportunity_id uuid,
  owner_id uuid not null,
  title varchar(200) not null,
  status varchar(30) not null default 'borrador' check (status in ('borrador', 'enviada', 'vista', 'negociacion', 'aprobada', 'rechazada', 'vencida', 'convertida', 'cancelada')),
  current_version_no smallint not null default 1,
  current_version_id uuid,
  travel_from date not null,
  travel_to date not null,
  valid_until date not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6) not null,
  pax_adt smallint not null default 0,
  pax_chd smallint not null default 0,
  pax_inf smallint not null default 0,
  viewed_at timestamptz,
  approved_at timestamptz,
  approved_by_name varchar(150),
  approval_channel varchar(60),
  approval_ref varchar(200),
  approval_recorded_by uuid,
  approval_ip inet,
  approval_hash varchar(80),
  approval_version_no smallint,
  rejected_at timestamptz,
  rejected_reason text,
  reservation_id uuid,
  converted_at timestamptz,
  duplicated_from_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_quote_quotes primary key (id),
  constraint ck_quote_quotes_1 check (travel_to >= travel_from),
  constraint ck_quote_quotes_2 check (pax_adt + pax_chd + pax_inf > 0),
  constraint ck_quote_quotes_3 check (status <> 'rechazada' or rejected_reason is not null)
);

create table quote_versions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  quote_id uuid not null,
  version_no smallint not null,
  status varchar(30) not null default 'borrador' check (status in ('borrador', 'enviada', 'aprobada', 'rechazada', 'reemplazada', 'vencida')),
  issued_on date not null default current_date,
  author_id uuid not null,
  discount_pct numeric(5,2) not null default 0 check (discount_pct between 0 and 50),
  tax_pct numeric(5,2) not null default 18,
  markup_pct numeric(7,2) not null default 0,
  notes text,
  conditions text,
  snapshot_label varchar(300) not null,
  catalog_snapshot jsonb not null,
  policies_snapshot jsonb not null,
  fx_rate numeric(12,6) not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  cost_total numeric(14,2) not null default 0,
  sale_total numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  net_total numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  grand_total numeric(14,2) not null default 0,
  profit_total numeric(14,2) not null default 0,
  margin_pct numeric(7,2) not null default 0,
  internal_approval_id uuid,
  frozen_at timestamptz,
  content_hash varchar(80),
  pdf_document_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_quote_versions primary key (id)
);

create table quote_items (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  quote_version_id uuid not null,
  line_no smallint not null,
  product_id uuid not null,
  product_version varchar(10) not null,
  rate_id uuid,
  segment varchar(15) not null check (segment in ('Adulto', 'Niño', 'Infante', 'Grupo', 'Pasajero')),
  service_date date not null,
  qty integer not null check (qty > 0),
  pax integer not null check (pax > 0),
  unit_cost numeric(14,2) not null check (unit_cost >= 0),
  unit_price numeric(14,2) not null check (unit_price > 0),
  cost_total numeric(14,2) generated always as (round(unit_cost * qty * pax, 2)) stored,
  sale_total numeric(14,2) generated always as (round(unit_price * qty * pax, 2)) stored,
  season_id uuid,
  season_factor numeric(6,3),
  price_source varchar(10) not null default 'rate' check (price_source in ('rate', 'manual')),
  rate_snapshot jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_quote_items primary key (id)
);

create table quote_internal_approvals (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  quote_version_id uuid not null,
  reasons jsonb not null default '[]',
  over_cap boolean not null default false,
  requested_by uuid,
  requested_at timestamptz,
  request_note text,
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada', 'anulada')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  is_override boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_quote_internal_approvals primary key (id)
);

create table quote_sends (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  quote_id uuid not null,
  version_no smallint not null,
  channel varchar(15) not null check (channel in ('Email', 'WhatsApp', 'Portal')),
  recipient varchar(200) not null,
  message text,
  sent_by uuid not null,
  sent_at timestamptz not null default now(),
  notification_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_quote_sends primary key (id)
);

create table quote_access_tokens (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  quote_id uuid not null,
  token_hash varchar(80) not null,
  expires_at date not null,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_quote_access_tokens primary key (id)
);

create table quote_views (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  quote_id uuid not null,
  version_no smallint not null,
  viewed_at timestamptz not null default now(),
  source varchar(15) not null check (source in ('portal', 'manual')),
  ip inet,
  user_agent text,
  recorded_by uuid,
  constraint pk_quote_views primary key (id)
);

create table quote_negotiations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  quote_id uuid not null,
  channel varchar(15) not null check (channel in ('Llamada', 'Reunión', 'Email', 'WhatsApp')),
  note text not null,
  created_version_no smallint,
  recorded_by uuid not null,
  recorded_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_quote_negotiations primary key (id)
);

create table quote_approvals (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  quote_id uuid not null,
  quote_version_id uuid,
  version_no smallint not null,
  approved_at timestamptz not null default now(),
  approver_name varchar(150) not null,
  channel varchar(60) not null default 'Portal cliente',
  ip inet,
  token_id uuid,
  total numeric(14,2) not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  note text,
  evidence_hash char(71) not null check (evidence_hash like 'sha256:%'),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_quote_approvals primary key (id)
);

create table booking_reservations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  quote_id uuid,
  quote_version_id uuid,
  quote_version_no smallint,
  client_id uuid not null,
  agency_id uuid,
  owner_id uuid not null,
  sede_id uuid not null,
  title varchar(200) not null,
  status varchar(30) not null default 'borrador' check (status in ('borrador', 'pendiente_disponibilidad', 'confirmada', 'pendiente_pago', 'pendiente_proveedor', 'reprogramada', 'parcial', 'incidencia', 'en_operacion', 'completada', 'cancelada')),
  channel varchar(15) not null default 'Directo' check (channel in ('Directo', 'Corporativo', 'B2B', 'E-commerce')),
  travel_from date not null,
  travel_to date not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6) not null,
  total_amount numeric(14,2) not null default 0,
  snapshot_label varchar(300) not null,
  catalog_snapshot jsonb,
  policies_snapshot jsonb not null default '{}',
  notes text,
  rescheduled_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  penalty_amount numeric(14,2),
  refund_amount numeric(14,2),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_booking_reservations primary key (id),
  constraint ck_booking_reservations_1 check (travel_to >= travel_from),
  constraint ck_booking_reservations_2 check (status <> 'cancelada' or cancelled_at is not null)
);

create table booking_passengers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  seq smallint not null,
  full_name varchar(150) not null,
  doc_type varchar(12) check (doc_type is null or doc_type in ('DNI', 'Pasaporte', 'CE', 'Passport')),
  doc_number varchar(30),
  pax_type char(3) not null default 'ADT' check (pax_type in ('ADT', 'CHD', 'INF')),
  nationality varchar(60),
  birth_date date,
  phone varchar(30),
  diet_notes varchar(200),
  is_placeholder boolean not null default true,
  relationship varchar(30) check (relationship is null or relationship in ('Titular', 'Cónyuge / pareja', 'Hijo/a', 'Padre / madre', 'Hermano/a', 'Amigo/a', 'Otro')),
  age smallint,
  email varchar(150),
  is_lead boolean not null default false,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_passengers primary key (id)
);

create table booking_reservation_services (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  code varchar(20) not null,
  product_id uuid,
  catalog_service_id uuid,
  quote_item_id uuid,
  departure_id uuid,
  provider_id uuid,
  name varchar(200) not null,
  service_date date not null,
  service_time time,
  pax integer,
  status varchar(30) not null default 'pendiente' check (status in ('pendiente', 'solicitado', 'confirmado', 'rechazado', 'en_curso', 'completado', 'cancelado')),
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6),
  cost_amount numeric(14,2) not null default 0,
  price_amount numeric(14,2) not null default 0,
  is_required boolean not null default true,
  requires_assignment boolean not null default false,
  service_kind varchar(20) not null default 'tour' check (service_kind in ('tour', 'traslado', 'alojamiento', 'tren_entrada', 'libre')),
  confirmation_code varchar(40),
  confirmed_by_name varchar(120),
  confirmed_by uuid,
  requested_at timestamptz,
  requested_by uuid,
  confirmed_at timestamptz,
  reject_reason text,
  alt_of_id uuid,
  replaced_by_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_reservation_services primary key (id),
  constraint ck_booking_reservation_services_1 check (status <> 'confirmado' or confirmation_code is not null)
);

create table booking_inventory_holds (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  departure_id uuid not null,
  reservation_id uuid not null,
  booking_service_id uuid,
  pax integer not null check (pax > 0),
  status varchar(15) not null default 'hold' check (status in ('hold', 'confirmada', 'liberada', 'expirada', 'consumida')),
  expires_at timestamptz,
  released_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_inventory_holds primary key (id)
);

create table booking_changes (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  type varchar(20) not null check (type in ('pax', 'servicio', 'upgrade', 'otro', 'reprogramacion')),
  description text not null,
  extra_pax integer,
  product_id uuid,
  service_date date,
  delta_amount numeric(14,2) not null default 0,
  credit_amount numeric(14,2),
  status varchar(15) not null default 'pendiente' check (status in ('pendiente', 'aplicada', 'rechazada')),
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  decided_by uuid,
  decided_at timestamptz,
  applied_at timestamptz,
  payload jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_changes primary key (id)
);

create table booking_cancel_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  reason text not null,
  requested_by uuid not null,
  requested_at timestamptz not null default now(),
  status varchar(15) not null default 'pendiente' check (status in ('pendiente', 'aprobada', 'rechazada', 'retirada')),
  decided_by uuid,
  decided_at timestamptz,
  decision_note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_cancel_requests primary key (id)
);

create table booking_cancellations (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  total_at_cancel numeric(14,2) not null,
  paid_at_cancel numeric(14,2) not null,
  penalty_services numeric(14,2) not null,
  consumed_amount numeric(14,2) not null,
  factor_k numeric(12,6) not null,
  penalty_amount numeric(14,2) not null,
  refund_amount numeric(14,2) not null,
  owed_amount numeric(14,2) not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  lines jsonb not null,
  credit_note_id uuid,
  refund_payment_id uuid,
  penalty_receivable_id uuid,
  reason text not null,
  cancelled_by uuid not null,
  cancelled_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_booking_cancellations primary key (id)
);

create table ops_guides (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  user_id uuid,
  provider_id uuid,
  full_name varchar(150) not null,
  languages char(2)[] not null default '{}',
  license_number varchar(40) not null,
  rating numeric(2,1) check (rating between 0 and 5),
  status varchar(20) not null default 'disponible' check (status in ('disponible', 'asignado', 'descanso', 'vacaciones')),
  phone varchar(30),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_ops_guides primary key (id)
);

create table ops_drivers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  user_id uuid,
  provider_id uuid,
  full_name varchar(150) not null,
  license_number varchar(40) not null,
  license_class varchar(10),
  license_expires_on date not null,
  rating numeric(2,1) check (rating between 0 and 5),
  status varchar(20) not null default 'disponible' check (status in ('disponible', 'asignado', 'descanso', 'vacaciones')),
  phone varchar(30),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_ops_drivers primary key (id)
);

create table ops_vehicles (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  plate varchar(12) not null,
  vehicle_type varchar(60) not null,
  capacity smallint not null check (capacity > 0),
  provider_id uuid,
  soat_expires_on date not null,
  status varchar(20) not null default 'disponible' check (status in ('disponible', 'asignado', 'mantenimiento')),
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_ops_vehicles primary key (id)
);

create table ops_orders (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  reservation_id uuid not null,
  title varchar(200) not null,
  status varchar(30) not null default 'pendiente_asignacion' check (status in ('planificada', 'pendiente_asignacion', 'asignada', 'confirmada', 'en_ejecucion', 'completada', 'cancelada')),
  coordinator_id uuid not null,
  date_from date not null,
  date_to date not null,
  closed_at timestamptz,
  closed_by uuid,
  cancelled_at timestamptz,
  cancel_reason text,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_ops_orders primary key (id),
  constraint ck_ops_orders_1 check (date_to >= date_from)
);

create table ops_order_tasks (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  order_id uuid not null,
  title varchar(250) not null,
  position smallint not null default 0,
  done boolean not null default false,
  done_by uuid,
  done_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_ops_order_tasks primary key (id)
);

create table ops_supplier_requests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_service_id uuid not null,
  provider_id uuid not null,
  status varchar(30) not null default 'solicitado' check (status in ('solicitado', 'confirmado', 'rechazado', 'alternativa_propuesta', 'anulada')),
  channel varchar(20) not null check (channel in ('email', 'extranet', 'telefono', 'integracion')),
  requested_at timestamptz not null default now(),
  requested_by uuid not null,
  responded_at timestamptz,
  responded_by_user_id uuid,
  response_source varchar(20) check (response_source is null or response_source in ('web_interno', 'extranet')),
  confirmation_code varchar(40),
  rejection_reason varchar(120),
  note text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_ops_supplier_requests primary key (id),
  constraint ck_ops_supplier_requests_1 check (status <> 'rechazado' or rejection_reason is not null)
);

create table ops_assignments (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  order_id uuid not null,
  reservation_service_id uuid not null,
  service_date date not null,
  service_time time,
  service_label varchar(200) not null,
  guide_id uuid,
  driver_id uuid,
  vehicle_id uuid,
  status varchar(30) not null default 'pendiente' check (status in ('pendiente', 'asignada', 'confirmada', 'en_curso', 'completada')),
  confirmed_at timestamptz,
  confirmed_via varchar(10) check (confirmed_via is null or confirmed_via in ('web', 'app')),
  started_at timestamptz,
  first_checkin_at timestamptz,
  finished_at timestamptz,
  warnings_ack jsonb,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_assignments primary key (id),
  constraint ck_ops_assignments_1 check (status = 'pendiente' or guide_id is not null or driver_id is not null or vehicle_id is not null)
);

create table ops_assignment_checkins (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  assignment_id uuid not null,
  passenger_id uuid not null,
  checked_at timestamptz not null,
  source varchar(10) not null check (source in ('app', 'web')),
  client_action_id uuid,
  device_id uuid,
  undone_at timestamptz,
  undone_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_assignment_checkins primary key (id)
);

create table ops_rooming_lists (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  hotel_provider_id uuid,
  leg_id varchar(20),
  city varchar(80),
  hotel_name varchar(150),
  source varchar(30) not null default 'manual' check (source in ('manual', 'booking.lodging')),
  check_in date not null,
  check_out date not null,
  stay daterange generated always as (daterange(check_in, check_out, '[)')) stored,
  status varchar(20) not null default 'borrador' check (status in ('borrador', 'confirmada', 'modificada', 'enviada')),
  sent_at timestamptz,
  sent_by uuid,
  sent_version integer not null default 0,
  hotel_ack_at timestamptz,
  hotel_ack_by uuid,
  hotel_confirmed_at timestamptz,
  hotel_confirmed_by uuid,
  document_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_ops_rooming_lists primary key (id),
  constraint ck_ops_rooming_lists_1 check (check_out > check_in),
  constraint ck_ops_rooming_lists_2 check (hotel_provider_id is not null or hotel_name is not null)
);

create table ops_rooming_rooms (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  rooming_list_id uuid not null,
  hotel_provider_id uuid,
  stay daterange not null,
  room_number varchar(10) not null,
  room_type varchar(20) not null check (room_type in ('Simple', 'Doble', 'Doble twin', 'Matrimonial', 'Triple', 'Junior suite')),
  capacity smallint not null,
  status varchar(20) not null default 'pendiente' check (status in ('confirmada', 'pendiente', 'observada')),
  hotel_note text,
  incident_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_rooming_rooms primary key (id)
);

create table ops_rooming_guests (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  room_id uuid not null,
  rooming_list_id uuid not null,
  passenger_id uuid not null,
  stay daterange not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_rooming_guests primary key (id)
);

create table ops_vouchers (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  reservation_id uuid not null,
  reservation_service_id uuid not null,
  provider_id uuid not null,
  service_label varchar(200) not null,
  service_date date not null,
  pax smallint not null,
  status varchar(20) not null default 'emitido' check (status in ('emitido', 'utilizado', 'anulado')),
  version integer not null default 1 check (version >= 1),
  issued_at timestamptz not null default now(),
  issued_by uuid,
  note text,
  used_at timestamptz,
  used_by uuid,
  used_via varchar(20) check (used_via is null or used_via in ('web', 'extranet', 'app_operador')),
  void_reason text,
  void_at timestamptz,
  void_by uuid,
  origin varchar(20) not null default 'operaciones' check (origin in ('operaciones', 'ecommerce')),
  qr_token varchar(128) not null,
  document_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_vouchers primary key (id),
  constraint ck_ops_vouchers_1 check (status <> 'anulado' or void_reason is not null)
);

create table ops_voucher_versions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  voucher_id uuid not null,
  version integer not null,
  issued_at timestamptz not null default now(),
  issued_by uuid,
  reason text not null,
  snapshot jsonb not null,
  document_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_ops_voucher_versions primary key (id)
);

create table ops_incidents (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20) not null,
  order_id uuid,
  reservation_id uuid,
  reservation_service_id uuid,
  provider_id uuid,
  type varchar(30) not null check (type in ('Transporte', 'Proveedor', 'Salud del pasajero', 'Horario', 'Clima', 'Documentación', 'Equipaje', 'Seguridad', 'Capacidad', 'Pasajero', 'Otro')),
  severity varchar(10) not null check (severity in ('baja', 'media', 'alta', 'critica')),
  title varchar(200) not null,
  description text not null,
  status varchar(20) not null default 'abierta' check (status in ('abierta', 'en_proceso', 'resuelta', 'cerrada')),
  assignee_id uuid,
  reported_by uuid not null,
  source varchar(20) not null default 'web' check (source in ('web', 'app_operador', 'extranet', 'sistema')),
  sla_hours smallint not null,
  sla_due_at timestamptz not null,
  resolution text,
  resolved_at timestamptz,
  resolved_by uuid,
  closed_at timestamptz,
  closed_by uuid,
  related_incident_id uuid,
  client_action_id uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_incidents primary key (id),
  constraint ck_ops_incidents_1 check (status <> 'resuelta' or resolution is not null)
);

create table ops_incident_logs (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  incident_id uuid not null,
  user_id uuid,
  kind varchar(20) not null check (kind in ('registro', 'comentario', 'estado', 'asignacion', 'reclasificacion', 'alerta', 'evidencia', 'resolucion')),
  message text not null,
  visibility varchar(10) not null default 'proveedor' check (visibility in ('interna', 'proveedor')),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_ops_incident_logs primary key (id)
);

create table ops_evidences (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  order_id uuid,
  reservation_service_id uuid,
  incident_id uuid,
  file_name varchar(200) not null,
  storage_path varchar(400) not null,
  mime_type varchar(80) not null check (mime_type like 'image/%' or mime_type = 'application/pdf'),
  size_bytes integer not null,
  sha256 char(64) not null,
  source varchar(20) not null default 'web' check (source in ('web', 'app_operador', 'extranet')),
  captured_at timestamptz not null,
  captured_offline boolean not null default false,
  uploaded_by uuid not null,
  client_action_id uuid,
  removed_at timestamptz,
  removed_by uuid,
  removed_reason text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_ops_evidences primary key (id),
  constraint ck_ops_evidences_1 check (order_id is not null or incident_id is not null),
  constraint ck_ops_evidences_2 check (removed_at is null or removed_reason is not null)
);

create table fin_bank_accounts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  bank varchar(20) not null,
  account_type varchar(20) not null check (account_type in ('cta_cte', 'ahorros')),
  currency char(3) not null check (currency in ('PEN','USD')),
  number varchar(30) not null,
  cci varchar(20),
  label varchar(80) not null,
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_bank_accounts primary key (id)
);

create table fin_payment_methods (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(40) not null,
  label varchar(80) not null,
  requires_reference boolean not null default true,
  is_b2b_credit boolean not null default false,
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_payment_methods primary key (id)
);

create table fin_receivables (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  reservation_id uuid not null,
  client_id uuid not null,
  kind varchar(20) not null check (kind in ('anticipo', 'saldo', 'cargo', 'ajuste', 'penalidad', 'b2b', 'total', 'adelanto', 'pago_posterior')),
  concept varchar(255) not null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6),
  paid_amount numeric(14,2) not null default 0,
  due_date date not null,
  status varchar(20) not null default 'abierta' check (status in ('abierta', 'parcial', 'vencida', 'pagada', 'cancelada')),
  cancelled_at timestamptz,
  cancel_reason text,
  last_reminder_at timestamptz,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_fin_receivables primary key (id),
  constraint ck_fin_receivables_1 check (paid_amount >= 0 and paid_amount <= amount)
);

create table fin_receivable_reminders (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  receivable_id uuid not null,
  channels varchar(60) not null,
  sent_by uuid,
  sent_at timestamptz not null default now(),
  balance_at_send numeric(14,2) not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_fin_receivable_reminders primary key (id)
);

create table fin_payments (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  reservation_id uuid not null,
  receivable_id uuid,
  kind varchar(20) not null default 'cobro' check (kind in ('cobro', 'reembolso')),
  source varchar(20) not null default 'backoffice' check (source in ('backoffice', 'reserva', 'portal_cliente', 'b2b', 'ecommerce', 'sistema')),
  method varchar(40) not null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6),
  paid_on date not null,
  reference varchar(80),
  note text,
  evidence_document_id uuid,
  status varchar(20) not null default 'pendiente' check (status in ('pendiente', 'confirmado', 'aplicado', 'rechazado', 'revertido')),
  reject_reason text,
  retries smallint not null default 0,
  reverted_at timestamptz,
  reverted_by uuid,
  revert_reason text,
  registered_by uuid,
  reported_by_agency boolean not null default false,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_payments primary key (id),
  constraint ck_fin_payments_1 check (status <> 'rechazado' or reject_reason is not null),
  constraint ck_fin_payments_2 check (status <> 'revertido' or (reverted_at is not null and reverted_by is not null and revert_reason is not null)),
  constraint ck_fin_payments_3 check (currency <> 'USD' or fx_rate is not null)
);

create table fin_payment_applications (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  payment_id uuid not null,
  receivable_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  applied_at timestamptz not null default now(),
  applied_by uuid,
  reversed_at timestamptz,
  reversed_by uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_payment_applications primary key (id)
);

create table fin_status_history (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  entity_type varchar(30) not null check (entity_type in ('payment', 'commission', 'invoice', 'payable')),
  entity_id uuid not null,
  status varchar(30) not null,
  note text,
  user_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_fin_status_history primary key (id)
);

create table fin_payables (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  provider_id uuid not null,
  reservation_id uuid,
  reservation_service_id uuid,
  kind varchar(20) not null default 'servicio' check (kind in ('servicio', 'costo_adicional')),
  cost_type varchar(40) check (cost_type is null or cost_type in ('costo_adicional', 'ajuste_tarifa', 'penalidad_proveedor', 'gasto_operativo_destino')),
  concept varchar(255) not null,
  amount numeric(14,2) not null check (amount > 0),
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6),
  due_date date not null,
  paid_amount numeric(14,2) not null default 0,
  status varchar(20) not null default 'abierta' check (status in ('abierta', 'aprobada', 'parcial', 'pagada', 'vencida', 'cancelada')),
  approved_at timestamptz,
  approved_by uuid,
  supplier_doc_number varchar(30),
  evidence_note text,
  scheduled_date date,
  scheduled_bank_account_id uuid,
  scheduled_by uuid,
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_fin_payables primary key (id),
  constraint ck_fin_payables_1 check (paid_amount >= 0 and paid_amount <= amount),
  constraint ck_fin_payables_2 check (kind <> 'costo_adicional' or cost_type is not null),
  constraint ck_fin_payables_3 check (currency <> 'USD' or fx_rate is not null)
);

create table fin_payable_payouts (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  payable_id uuid not null,
  paid_on date not null,
  amount numeric(14,2) not null check (amount > 0),
  fx_rate numeric(12,6),
  method varchar(30) not null check (method in ('transferencia', 'transferencia_cci', 'cheque_gerencia', 'efectivo_caja_chica', 'cargo_bancario')),
  bank_account_id uuid,
  operation_ref varchar(80) not null,
  bank_line_id uuid,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_payable_payouts primary key (id)
);

create table fin_commission_rules (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  beneficiary_kind varchar(20) not null check (beneficiary_kind in ('vendedor', 'agencia_b2b')),
  condition varchar(30) not null check (condition in ('directo_ecommerce', 'corporativo_grupos', 'b2b_convenio')),
  pct numeric(5,2),
  base_type varchar(20) not null default 'neto_sin_igv' check (base_type in ('neto_sin_igv', 'total')),
  valid_from date not null,
  valid_to date,
  active boolean not null default true,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_commission_rules primary key (id),
  constraint ck_fin_commission_rules_1 check (condition = 'b2b_convenio' or pct is not null)
);

create table fin_commissions (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  reservation_id uuid,
  kind varchar(20) not null check (kind in ('vendedor', 'agencia_b2b', 'Bono por meta')),
  beneficiary_user_id uuid,
  beneficiary_agency_id uuid,
  rule_id uuid,
  rule_description varchar(255) not null,
  base_amount numeric(14,2) not null,
  pct numeric(5,2) not null,
  amount numeric(14,2) not null,
  currency char(3) not null check (currency in ('PEN','USD')),
  fx_rate numeric(12,6),
  status varchar(20) not null default 'calculada' check (status in ('calculada', 'aprobada', 'pagada')),
  approved_at timestamptz,
  approved_by uuid,
  paid_at timestamptz,
  payment_method varchar(40),
  payment_ref varchar(80),
  lock_version integer not null default 0,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint pk_fin_commissions primary key (id),
  constraint ck_fin_commissions_1 check (num_nonnulls(beneficiary_user_id, beneficiary_agency_id) = 1),
  constraint ck_fin_commissions_2 check (kind = 'Bono por meta' or reservation_id is not null)
);

create table fin_settlements (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  reservation_id uuid not null,
  closed_at timestamptz not null default now(),
  closed_by uuid not null,
  income_pen numeric(14,2) not null,
  cost_pen numeric(14,2) not null,
  commissions_pen numeric(14,2) not null,
  net_pen numeric(14,2) not null,
  gross_margin_pct numeric(6,2) not null,
  snapshot jsonb not null,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_fin_settlements primary key (id)
);

create table fin_fx_rates (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  currency_code char(3) not null,
  base_currency char(3) not null default 'PEN',
  rate_pen numeric(14,6) not null check (rate_pen > 0),
  buy numeric(12,6),
  sell numeric(12,6),
  previous_rate numeric(14,6),
  rate_date date not null,
  source varchar(80) not null,
  effective_at timestamptz not null default now(),
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_fin_fx_rates primary key (id)
);

create table channel_support_tickets (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(30) not null,
  crm_client_id uuid not null,
  reservation_id uuid,
  source varchar(30) not null check (source in ('portal_cliente', 'portal_pasajero')),
  subject varchar(200) not null,
  category varchar(40) not null,
  topic varchar(40),
  priority varchar(10) not null default 'media' check (priority in ('baja', 'media', 'alta')),
  message text not null,
  status varchar(30) not null default 'abierta' check (status in ('abierta', 'en_proceso', 'resuelta', 'cerrada')),
  owner_id uuid not null,
  created_by_user_id uuid not null,
  first_response_due_at timestamptz,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pk_channel_support_tickets primary key (id)
);

create table channel_support_ticket_events (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  ticket_id uuid not null,
  occurred_at timestamptz not null default now(),
  user_id uuid,
  message varchar(500) not null,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_channel_support_ticket_events primary key (id)
);

create table report_exports (
  id uuid not null default app_uuid_v7(),
  tenant_id uuid not null default app_current_tenant_id(),
  code varchar(20),
  report_name varchar(200) not null,
  report_key varchar(40) not null,
  filters jsonb not null default '{}',
  scope varchar(20) not null default 'filtered' check (scope in ('filtered', 'detailed')),
  format varchar(10) not null check (format in ('CSV', 'XLSX', 'PDF')),
  rows_count integer,
  size_bytes bigint,
  file_path varchar(255),
  status varchar(20) not null default 'en_cola' check (status in ('en_cola', 'procesando', 'disponible', 'fallido', 'expirado')),
  requested_by uuid,
  scheduled_job_id uuid,
  idempotency_key varchar(80),
  expires_at timestamptz not null default (now() + interval '7 days'),
  finished_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint pk_report_exports primary key (id)
);


-- ---------------------------------------------------------------- unicidad (índices únicos, incluidos parciales)
create unique index uq_catalog_product_types_tenant_id_lower_name on catalog_product_types (tenant_id, lower(name));
create unique index uq_catalog_product_categories_tenant_id_ref on catalog_product_categories (tenant_id, ref);
create unique index uq_catalog_product_categories_tenant_id_lower_name on catalog_product_categories (tenant_id, lower(name));
create unique index uq_catalog_product_subcategories_category_id_lower_name on catalog_product_subcategories (category_id, lower(name));
create unique index uq_catalog_destinations_tenant_id_ref on catalog_destinations (tenant_id, ref);
create unique index uq_catalog_destinations_tenant_id_coalesce_parent_id_000_334257 on catalog_destinations (tenant_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create unique index uq_catalog_providers_tenant_id_ref on catalog_providers (tenant_id, ref);
create unique index uq_catalog_providers_tenant_id_ruc on catalog_providers (tenant_id, ruc);
create unique index uq_catalog_services_tenant_id_ref on catalog_services (tenant_id, ref);
create unique index uq_catalog_products_tenant_id_ref on catalog_products (tenant_id, ref);
create unique index uq_catalog_products_tenant_id_lower_code on catalog_products (tenant_id, lower(code));
create unique index uq_catalog_products_tenant_id_slug_p on catalog_products (tenant_id, slug) where slug is not null;
create unique index uq_catalog_product_versions_product_id_version on catalog_product_versions (product_id, version);
create unique index uq_catalog_product_versions_product_id_p on catalog_product_versions (product_id) where status = 'vigente';
create unique index uq_catalog_product_destinations_product_id_destination_id on catalog_product_destinations (product_id, destination_id);
create unique index uq_catalog_itineraries_product_id_p on catalog_itineraries (product_id) where is_default;
create unique index uq_catalog_itinerary_days_itinerary_id_day_number on catalog_itinerary_days (itinerary_id, day_number);
create unique index uq_catalog_product_inclusions_product_id_kind_lower_text on catalog_product_inclusions (product_id, kind, lower(text));
create unique index uq_catalog_product_policies_product_id on catalog_product_policies (product_id);
create unique index uq_catalog_product_related_product_id_related_product_id on catalog_product_related (product_id, related_product_id);
create unique index uq_catalog_seasons_tenant_id_ref on catalog_seasons (tenant_id, ref);
create unique index uq_catalog_product_promotions_tenant_id_ref on catalog_product_promotions (tenant_id, ref);
create unique index uq_catalog_product_promotions_tenant_id_promo_code_p on catalog_product_promotions (tenant_id, promo_code) where promo_code is not null and deleted_at is null;
create unique index uq_catalog_product_media_product_id_p on catalog_product_media (product_id) where is_main;
create unique index uq_catalog_product_channels_product_id_channel on catalog_product_channels (product_id, channel);
create unique index uq_catalog_product_seasons_product_id_season_id on catalog_product_seasons (product_id, season_id);
create unique index uq_catalog_product_config_groups_product_id_lower_name on catalog_product_config_groups (product_id, lower(name));
create unique index uq_catalog_rates_tenant_id_ref on catalog_rates (tenant_id, ref);
create unique index uq_catalog_price_rules_tenant_id_ref on catalog_price_rules (tenant_id, ref);
create unique index uq_catalog_product_departures_tenant_id_ref on catalog_product_departures (tenant_id, ref);
create unique index uq_catalog_availability_holds_tenant_id_ref on catalog_availability_holds (tenant_id, ref);
create unique index uq_catalog_availability_ranges_tenant_id_code on catalog_availability_ranges (tenant_id, code);
create unique index uq_catalog_pax_rules_tenant_id_product_id on catalog_pax_rules (tenant_id, product_id);
create unique index uq_crm_catalog_items_tenant_id_kind_code on crm_catalog_items (tenant_id, kind, code);
create unique index uq_crm_clients_tenant_id_code on crm_clients (tenant_id, code);
create unique index uq_crm_clients_tenant_id_doc_type_doc_number_p on crm_clients (tenant_id, doc_type, doc_number) where deleted_at is null;
create unique index uq_crm_leads_tenant_id_code on crm_leads (tenant_id, code);
create unique index uq_crm_client_contacts_client_id_p on crm_client_contacts (client_id) where is_primary;
create unique index uq_crm_pipeline_stages_tenant_id_code on crm_pipeline_stages (tenant_id, code);
create unique index uq_crm_opportunities_tenant_id_code on crm_opportunities (tenant_id, code);
create unique index uq_crm_opportunities_tenant_id_lead_id_p on crm_opportunities (tenant_id, lead_id) where lead_id is not null;
create unique index uq_crm_activities_tenant_id_code on crm_activities (tenant_id, code);
create unique index uq_crm_surveys_tenant_id_code on crm_surveys (tenant_id, code);
create unique index uq_crm_surveys_tenant_id_reservation_id_p on crm_surveys (tenant_id, reservation_id) where reservation_id is not null;
create unique index uq_crm_cases_tenant_id_code on crm_cases (tenant_id, code);
create unique index uq_crm_cases_tenant_id_survey_id_p on crm_cases (tenant_id, survey_id) where survey_id is not null;
create unique index uq_crm_cases_tenant_id_book_number_p on crm_cases (tenant_id, book_number) where book_number is not null;
create unique index uq_crm_claim_book_settings_tenant_id on crm_claim_book_settings (tenant_id);
create unique index uq_sys_holidays_tenant_id_date_p on sys_holidays (tenant_id, date) nulls not distinct;
create unique index uq_quote_quotes_tenant_id_code on quote_quotes (tenant_id, code);
create unique index uq_quote_quotes_tenant_id_reservation_id_p on quote_quotes (tenant_id, reservation_id) where reservation_id is not null;
create unique index uq_quote_versions_tenant_id_quote_id_version_no on quote_versions (tenant_id, quote_id, version_no);
create unique index uq_quote_items_quote_version_id_line_no on quote_items (quote_version_id, line_no);
create unique index uq_quote_internal_approvals_tenant_id_quote_version_id_p on quote_internal_approvals (tenant_id, quote_version_id) where status = 'pendiente';
create unique index uq_quote_access_tokens_token_hash on quote_access_tokens (token_hash);
create unique index uq_booking_reservations_tenant_id_code on booking_reservations (tenant_id, code);
create unique index uq_booking_reservations_tenant_id_quote_id_p on booking_reservations (tenant_id, quote_id) where quote_id is not null;
create unique index uq_booking_passengers_reservation_id_seq on booking_passengers (reservation_id, seq);
create unique index uq_booking_passengers_reservation_id_p on booking_passengers (reservation_id) where is_lead;
create unique index uq_booking_reservation_services_tenant_id_code on booking_reservation_services (tenant_id, code);
create unique index uq_booking_cancel_requests_reservation_id_p on booking_cancel_requests (reservation_id) where status = 'pendiente';
create unique index uq_booking_cancellations_reservation_id on booking_cancellations (reservation_id);
create unique index uq_ops_guides_tenant_id_code on ops_guides (tenant_id, code);
create unique index uq_ops_guides_tenant_id_user_id_p on ops_guides (tenant_id, user_id) where user_id is not null;
create unique index uq_ops_drivers_tenant_id_code on ops_drivers (tenant_id, code);
create unique index uq_ops_drivers_tenant_id_user_id_p on ops_drivers (tenant_id, user_id) where user_id is not null;
create unique index uq_ops_vehicles_tenant_id_plate on ops_vehicles (tenant_id, plate);
create unique index uq_ops_orders_tenant_id_code on ops_orders (tenant_id, code);
create unique index uq_ops_orders_tenant_id_reservation_id_p on ops_orders (tenant_id, reservation_id) where deleted_at is null;
create unique index uq_ops_assignments_tenant_id_order_id_reservation_service_id on ops_assignments (tenant_id, order_id, reservation_service_id);
create unique index uq_ops_assignment_checkins_assignment_id_passenger_id_p on ops_assignment_checkins (assignment_id, passenger_id) where undone_at is null;
create unique index uq_ops_rooming_lists_tenant_id_reservation_id_coalesce_l_ee5adb on ops_rooming_lists (tenant_id, reservation_id, coalesce(leg_id, hotel_provider_id::text));
create unique index uq_ops_rooming_rooms_rooming_list_id_room_number on ops_rooming_rooms (rooming_list_id, room_number);
create unique index uq_ops_rooming_guests_rooming_list_id_passenger_id on ops_rooming_guests (rooming_list_id, passenger_id);
create unique index uq_ops_vouchers_tenant_id_code on ops_vouchers (tenant_id, code);
create unique index uq_ops_vouchers_qr_token on ops_vouchers (qr_token);
create unique index uq_ops_vouchers_tenant_id_reservation_service_id_p on ops_vouchers (tenant_id, reservation_service_id) where status = 'emitido';
create unique index uq_ops_voucher_versions_voucher_id_version on ops_voucher_versions (voucher_id, version);
create unique index uq_ops_incidents_tenant_id_code on ops_incidents (tenant_id, code);
create unique index uq_ops_incidents_tenant_id_client_action_id_p on ops_incidents (tenant_id, client_action_id) where client_action_id is not null;
create unique index uq_ops_evidences_tenant_id_order_id_sha256_p on ops_evidences (tenant_id, order_id, sha256) where removed_at is null;
create unique index uq_fin_bank_accounts_tenant_id_bank_number on fin_bank_accounts (tenant_id, bank, number);
create unique index uq_fin_payment_methods_tenant_id_code on fin_payment_methods (tenant_id, code);
create unique index uq_fin_receivables_tenant_id_code on fin_receivables (tenant_id, code);
create unique index uq_fin_payments_tenant_id_code on fin_payments (tenant_id, code);
create unique index uq_fin_payment_applications_payment_id_p on fin_payment_applications (payment_id) where reversed_at is null;
create unique index uq_fin_payables_tenant_id_code on fin_payables (tenant_id, code);
create unique index uq_fin_payable_payouts_tenant_id_code on fin_payable_payouts (tenant_id, code);
create unique index uq_fin_commissions_tenant_id_code on fin_commissions (tenant_id, code);
create unique index uq_fin_commissions_tenant_id_reservation_id_kind_p on fin_commissions (tenant_id, reservation_id, kind) where deleted_at is null and reservation_id is not null;
create unique index uq_fin_settlements_tenant_id_reservation_id on fin_settlements (tenant_id, reservation_id);
create unique index uq_channel_support_tickets_tenant_id_code on channel_support_tickets (tenant_id, code);
create unique index uq_report_exports_tenant_id_idempotency_key_p on report_exports (tenant_id, idempotency_key) where idempotency_key is not null;

-- ---------------------------------------------------------------- claves foráneas
alter table iam_users add constraint fk_iam_users_client_id foreign key (client_id) references crm_clients (id);
alter table iam_users add constraint fk_iam_users_provider_id foreign key (provider_id) references catalog_providers (id);
alter table iam_users add constraint fk_iam_users_guide_id foreign key (guide_id) references ops_guides (id);
alter table iam_users add constraint fk_iam_users_driver_id foreign key (driver_id) references ops_drivers (id);
alter table iam_users add constraint fk_iam_users_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table notif_messages add constraint fk_notif_messages_client_id foreign key (client_id) references crm_clients (id);
alter table notif_messages add constraint fk_notif_messages_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table catalog_product_types add constraint fk_catalog_product_types_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_categories add constraint fk_catalog_product_categories_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_subcategories add constraint fk_catalog_product_subcategories_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_subcategories add constraint fk_catalog_product_subcategories_category_id foreign key (category_id) references catalog_product_categories (id);
alter table catalog_destinations add constraint fk_catalog_destinations_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_destinations add constraint fk_catalog_destinations_parent_id foreign key (parent_id) references catalog_destinations (id);
alter table catalog_providers add constraint fk_catalog_providers_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_provider_contacts add constraint fk_catalog_provider_contacts_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_provider_contacts add constraint fk_catalog_provider_contacts_provider_id foreign key (provider_id) references catalog_providers (id) on delete cascade;
alter table catalog_services add constraint fk_catalog_services_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_services add constraint fk_catalog_services_provider_id foreign key (provider_id) references catalog_providers (id);
alter table catalog_products add constraint fk_catalog_products_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_products add constraint fk_catalog_products_product_type_id foreign key (product_type_id) references catalog_product_types (id);
alter table catalog_products add constraint fk_catalog_products_category_id foreign key (category_id) references catalog_product_categories (id);
alter table catalog_products add constraint fk_catalog_products_subcategory_id foreign key (subcategory_id) references catalog_product_subcategories (id);
alter table catalog_products add constraint fk_catalog_products_primary_destination_id foreign key (primary_destination_id) references catalog_destinations (id);
alter table catalog_products add constraint fk_catalog_products_main_provider_id foreign key (main_provider_id) references catalog_providers (id);
alter table catalog_products add constraint fk_catalog_products_current_version_id foreign key (current_version_id) references catalog_product_versions (id) deferrable initially deferred;
alter table catalog_product_versions add constraint fk_catalog_product_versions_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_versions add constraint fk_catalog_product_versions_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_destinations add constraint fk_catalog_product_destinations_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_destinations add constraint fk_catalog_product_destinations_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_destinations add constraint fk_catalog_product_destinations_destination_id foreign key (destination_id) references catalog_destinations (id);
alter table catalog_product_items add constraint fk_catalog_product_items_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_items add constraint fk_catalog_product_items_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_items add constraint fk_catalog_product_items_service_id foreign key (service_id) references catalog_services (id);
alter table catalog_product_items add constraint fk_catalog_product_items_component_product_id foreign key (component_product_id) references catalog_products (id);
alter table catalog_product_items add constraint fk_catalog_product_items_provider_id foreign key (provider_id) references catalog_providers (id);
alter table catalog_itineraries add constraint fk_catalog_itineraries_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_itineraries add constraint fk_catalog_itineraries_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_itinerary_days add constraint fk_catalog_itinerary_days_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_itinerary_days add constraint fk_catalog_itinerary_days_itinerary_id foreign key (itinerary_id) references catalog_itineraries (id) on delete cascade;
alter table catalog_itinerary_items add constraint fk_catalog_itinerary_items_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_itinerary_items add constraint fk_catalog_itinerary_items_day_id foreign key (day_id) references catalog_itinerary_days (id) on delete cascade;
alter table catalog_itinerary_items add constraint fk_catalog_itinerary_items_service_id foreign key (service_id) references catalog_services (id);
alter table catalog_product_inclusions add constraint fk_catalog_product_inclusions_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_inclusions add constraint fk_catalog_product_inclusions_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_requirements add constraint fk_catalog_product_requirements_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_requirements add constraint fk_catalog_product_requirements_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_policies add constraint fk_catalog_product_policies_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_policies add constraint fk_catalog_product_policies_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_related add constraint fk_catalog_product_related_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_related add constraint fk_catalog_product_related_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_related add constraint fk_catalog_product_related_related_product_id foreign key (related_product_id) references catalog_products (id) on delete cascade;
alter table catalog_seasons add constraint fk_catalog_seasons_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_promotions add constraint fk_catalog_product_promotions_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_promotions add constraint fk_catalog_product_promotions_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_media add constraint fk_catalog_product_media_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_media add constraint fk_catalog_product_media_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_faqs add constraint fk_catalog_product_faqs_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_faqs add constraint fk_catalog_product_faqs_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_channels add constraint fk_catalog_product_channels_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_channels add constraint fk_catalog_product_channels_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_channels add constraint fk_catalog_product_channels_published_by foreign key (published_by) references iam_users (id);
alter table catalog_product_seasons add constraint fk_catalog_product_seasons_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_seasons add constraint fk_catalog_product_seasons_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_seasons add constraint fk_catalog_product_seasons_season_id foreign key (season_id) references catalog_seasons (id);
alter table catalog_product_config_groups add constraint fk_catalog_product_config_groups_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_config_groups add constraint fk_catalog_product_config_groups_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_product_config_options add constraint fk_catalog_product_config_options_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_config_options add constraint fk_catalog_product_config_options_group_id foreign key (group_id) references catalog_product_config_groups (id) on delete cascade;
alter table catalog_rates add constraint fk_catalog_rates_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_rates add constraint fk_catalog_rates_product_id foreign key (product_id) references catalog_products (id);
alter table catalog_rates add constraint fk_catalog_rates_season_id foreign key (season_id) references catalog_seasons (id);
alter table catalog_rate_conditions add constraint fk_catalog_rate_conditions_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_rate_conditions add constraint fk_catalog_rate_conditions_rate_id foreign key (rate_id) references catalog_rates (id) on delete cascade;
alter table catalog_price_rules add constraint fk_catalog_price_rules_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_price_rules add constraint fk_catalog_price_rules_product_id foreign key (product_id) references catalog_products (id);
alter table catalog_product_departures add constraint fk_catalog_product_departures_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_product_departures add constraint fk_catalog_product_departures_product_id foreign key (product_id) references catalog_products (id);
alter table catalog_product_departures add constraint fk_catalog_product_departures_provider_id foreign key (provider_id) references catalog_providers (id);
alter table catalog_product_departures add constraint fk_catalog_product_departures_guide_id foreign key (guide_id) references ops_guides (id);
alter table catalog_product_departures add constraint fk_catalog_product_departures_vehicle_id foreign key (vehicle_id) references ops_vehicles (id);
alter table catalog_availability_holds add constraint fk_catalog_availability_holds_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_availability_holds add constraint fk_catalog_availability_holds_departure_id foreign key (departure_id) references catalog_product_departures (id);
alter table catalog_availability_holds add constraint fk_catalog_availability_holds_product_id foreign key (product_id) references catalog_products (id);
alter table catalog_availability_ranges add constraint fk_catalog_availability_ranges_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_availability_ranges add constraint fk_catalog_availability_ranges_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table catalog_pax_rules add constraint fk_catalog_pax_rules_tenant_id foreign key (tenant_id) references tenants (id);
alter table catalog_pax_rules add constraint fk_catalog_pax_rules_product_id foreign key (product_id) references catalog_products (id) on delete cascade;
alter table crm_catalog_items add constraint fk_crm_catalog_items_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_clients add constraint fk_crm_clients_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_clients add constraint fk_crm_clients_owner_id foreign key (owner_id) references iam_users (id);
alter table crm_clients add constraint fk_crm_clients_source_lead_id foreign key (source_lead_id) references crm_leads (id);
alter table crm_leads add constraint fk_crm_leads_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_leads add constraint fk_crm_leads_destination_id foreign key (destination_id) references catalog_destinations (id);
alter table crm_leads add constraint fk_crm_leads_product_id foreign key (product_id) references catalog_products (id);
alter table crm_leads add constraint fk_crm_leads_owner_id foreign key (owner_id) references iam_users (id);
alter table crm_leads add constraint fk_crm_leads_taken_by foreign key (taken_by) references iam_users (id);
alter table crm_leads add constraint fk_crm_leads_converted_client_id foreign key (converted_client_id) references crm_clients (id);
alter table crm_leads add constraint fk_crm_leads_converted_opportunity_id foreign key (converted_opportunity_id) references crm_opportunities (id);
alter table crm_leads add constraint fk_crm_leads_converted_by foreign key (converted_by) references iam_users (id);
alter table crm_lead_qualifications add constraint fk_crm_lead_qualifications_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_lead_qualifications add constraint fk_crm_lead_qualifications_lead_id foreign key (lead_id) references crm_leads (id);
alter table crm_lead_qualifications add constraint fk_crm_lead_qualifications_qualified_by foreign key (qualified_by) references iam_users (id);
alter table crm_client_contacts add constraint fk_crm_client_contacts_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_client_contacts add constraint fk_crm_client_contacts_client_id foreign key (client_id) references crm_clients (id);
alter table crm_client_contacts add constraint fk_crm_client_contacts_source_lead_id foreign key (source_lead_id) references crm_leads (id);
alter table crm_pipeline_stages add constraint fk_crm_pipeline_stages_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_opportunities add constraint fk_crm_opportunities_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_opportunities add constraint fk_crm_opportunities_client_id foreign key (client_id) references crm_clients (id);
alter table crm_opportunities add constraint fk_crm_opportunities_owner_id foreign key (owner_id) references iam_users (id);
alter table crm_opportunities add constraint fk_crm_opportunities_lead_id foreign key (lead_id) references crm_leads (id);
alter table crm_opportunities add constraint fk_crm_opportunities_product_id foreign key (product_id) references catalog_products (id);
alter table crm_activities add constraint fk_crm_activities_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_activities add constraint fk_crm_activities_owner_id foreign key (owner_id) references iam_users (id);
alter table crm_activities add constraint fk_crm_activities_completed_by foreign key (completed_by) references iam_users (id);
alter table crm_activities add constraint fk_crm_activities_previous_activity_id foreign key (previous_activity_id) references crm_activities (id);
alter table crm_activities add constraint fk_crm_activities_merged_from_lead_id foreign key (merged_from_lead_id) references crm_leads (id);
alter table crm_surveys add constraint fk_crm_surveys_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_surveys add constraint fk_crm_surveys_client_id foreign key (client_id) references crm_clients (id);
alter table crm_surveys add constraint fk_crm_surveys_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table crm_surveys add constraint fk_crm_surveys_recorded_by foreign key (recorded_by) references iam_users (id);
alter table crm_cases add constraint fk_crm_cases_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_cases add constraint fk_crm_cases_client_id foreign key (client_id) references crm_clients (id);
alter table crm_cases add constraint fk_crm_cases_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table crm_cases add constraint fk_crm_cases_survey_id foreign key (survey_id) references crm_surveys (id);
alter table crm_cases add constraint fk_crm_cases_owner_id foreign key (owner_id) references iam_users (id);
alter table crm_cases add constraint fk_crm_cases_sede_id foreign key (sede_id) references iam_sedes (id);
alter table crm_cases add constraint fk_crm_cases_submitted_by foreign key (submitted_by) references iam_users (id);
alter table crm_case_events add constraint fk_crm_case_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table crm_case_events add constraint fk_crm_case_events_case_id foreign key (case_id) references crm_cases (id);
alter table crm_case_events add constraint fk_crm_case_events_user_id foreign key (user_id) references iam_users (id);
alter table crm_claim_book_settings add constraint fk_crm_claim_book_settings_tenant_id foreign key (tenant_id) references tenants (id);
alter table sys_holidays add constraint fk_sys_holidays_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_quotes add constraint fk_quote_quotes_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_quotes add constraint fk_quote_quotes_client_id foreign key (client_id) references crm_clients (id);
alter table quote_quotes add constraint fk_quote_quotes_opportunity_id foreign key (opportunity_id) references crm_opportunities (id);
alter table quote_quotes add constraint fk_quote_quotes_owner_id foreign key (owner_id) references iam_users (id);
alter table quote_quotes add constraint fk_quote_quotes_current_version_id foreign key (current_version_id) references quote_versions (id) deferrable initially deferred;
alter table quote_quotes add constraint fk_quote_quotes_approval_recorded_by foreign key (approval_recorded_by) references iam_users (id);
alter table quote_quotes add constraint fk_quote_quotes_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table quote_quotes add constraint fk_quote_quotes_duplicated_from_id foreign key (duplicated_from_id) references quote_quotes (id);
alter table quote_versions add constraint fk_quote_versions_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_versions add constraint fk_quote_versions_quote_id foreign key (quote_id) references quote_quotes (id);
alter table quote_versions add constraint fk_quote_versions_author_id foreign key (author_id) references iam_users (id);
alter table quote_versions add constraint fk_quote_versions_internal_approval_id foreign key (internal_approval_id) references quote_internal_approvals (id);
alter table quote_versions add constraint fk_quote_versions_pdf_document_id foreign key (pdf_document_id) references sys_documents (id);
alter table quote_items add constraint fk_quote_items_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_items add constraint fk_quote_items_quote_version_id foreign key (quote_version_id) references quote_versions (id) on delete cascade;
alter table quote_items add constraint fk_quote_items_product_id foreign key (product_id) references catalog_products (id);
alter table quote_items add constraint fk_quote_items_rate_id foreign key (rate_id) references catalog_rates (id);
alter table quote_items add constraint fk_quote_items_season_id foreign key (season_id) references catalog_seasons (id);
alter table quote_internal_approvals add constraint fk_quote_internal_approvals_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_internal_approvals add constraint fk_quote_internal_approvals_quote_version_id foreign key (quote_version_id) references quote_versions (id);
alter table quote_internal_approvals add constraint fk_quote_internal_approvals_requested_by foreign key (requested_by) references iam_users (id);
alter table quote_internal_approvals add constraint fk_quote_internal_approvals_decided_by foreign key (decided_by) references iam_users (id);
alter table quote_sends add constraint fk_quote_sends_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_sends add constraint fk_quote_sends_quote_id foreign key (quote_id) references quote_quotes (id);
alter table quote_sends add constraint fk_quote_sends_sent_by foreign key (sent_by) references iam_users (id);
alter table quote_sends add constraint fk_quote_sends_notification_id foreign key (notification_id) references notif_messages (id);
alter table quote_access_tokens add constraint fk_quote_access_tokens_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_access_tokens add constraint fk_quote_access_tokens_quote_id foreign key (quote_id) references quote_quotes (id);
alter table quote_views add constraint fk_quote_views_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_views add constraint fk_quote_views_quote_id foreign key (quote_id) references quote_quotes (id);
alter table quote_views add constraint fk_quote_views_recorded_by foreign key (recorded_by) references iam_users (id);
alter table quote_negotiations add constraint fk_quote_negotiations_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_negotiations add constraint fk_quote_negotiations_quote_id foreign key (quote_id) references quote_quotes (id);
alter table quote_negotiations add constraint fk_quote_negotiations_recorded_by foreign key (recorded_by) references iam_users (id);
alter table quote_approvals add constraint fk_quote_approvals_tenant_id foreign key (tenant_id) references tenants (id);
alter table quote_approvals add constraint fk_quote_approvals_quote_id foreign key (quote_id) references quote_quotes (id);
alter table quote_approvals add constraint fk_quote_approvals_quote_version_id foreign key (quote_version_id) references quote_versions (id);
alter table quote_approvals add constraint fk_quote_approvals_token_id foreign key (token_id) references quote_access_tokens (id);
alter table booking_reservations add constraint fk_booking_reservations_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_reservations add constraint fk_booking_reservations_quote_id foreign key (quote_id) references quote_quotes (id);
alter table booking_reservations add constraint fk_booking_reservations_quote_version_id foreign key (quote_version_id) references quote_versions (id);
alter table booking_reservations add constraint fk_booking_reservations_client_id foreign key (client_id) references crm_clients (id);
alter table booking_reservations add constraint fk_booking_reservations_owner_id foreign key (owner_id) references iam_users (id);
alter table booking_reservations add constraint fk_booking_reservations_sede_id foreign key (sede_id) references iam_sedes (id);
alter table booking_passengers add constraint fk_booking_passengers_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_passengers add constraint fk_booking_passengers_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_product_id foreign key (product_id) references catalog_products (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_catalog_service_id foreign key (catalog_service_id) references catalog_services (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_quote_item_id foreign key (quote_item_id) references quote_items (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_departure_id foreign key (departure_id) references catalog_product_departures (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_provider_id foreign key (provider_id) references catalog_providers (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_confirmed_by foreign key (confirmed_by) references iam_users (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_requested_by foreign key (requested_by) references iam_users (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_alt_of_id foreign key (alt_of_id) references booking_reservation_services (id);
alter table booking_reservation_services add constraint fk_booking_reservation_services_replaced_by_id foreign key (replaced_by_id) references booking_reservation_services (id);
alter table booking_inventory_holds add constraint fk_booking_inventory_holds_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_inventory_holds add constraint fk_booking_inventory_holds_departure_id foreign key (departure_id) references catalog_product_departures (id);
alter table booking_inventory_holds add constraint fk_booking_inventory_holds_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table booking_inventory_holds add constraint fk_booking_inventory_holds_booking_service_id foreign key (booking_service_id) references booking_reservation_services (id);
alter table booking_changes add constraint fk_booking_changes_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_changes add constraint fk_booking_changes_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table booking_changes add constraint fk_booking_changes_product_id foreign key (product_id) references catalog_products (id);
alter table booking_changes add constraint fk_booking_changes_requested_by foreign key (requested_by) references iam_users (id);
alter table booking_changes add constraint fk_booking_changes_decided_by foreign key (decided_by) references iam_users (id);
alter table booking_cancel_requests add constraint fk_booking_cancel_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_cancel_requests add constraint fk_booking_cancel_requests_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table booking_cancel_requests add constraint fk_booking_cancel_requests_requested_by foreign key (requested_by) references iam_users (id);
alter table booking_cancel_requests add constraint fk_booking_cancel_requests_decided_by foreign key (decided_by) references iam_users (id);
alter table booking_cancellations add constraint fk_booking_cancellations_tenant_id foreign key (tenant_id) references tenants (id);
alter table booking_cancellations add constraint fk_booking_cancellations_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table booking_cancellations add constraint fk_booking_cancellations_refund_payment_id foreign key (refund_payment_id) references fin_payments (id);
alter table booking_cancellations add constraint fk_booking_cancellations_penalty_receivable_id foreign key (penalty_receivable_id) references fin_receivables (id);
alter table booking_cancellations add constraint fk_booking_cancellations_cancelled_by foreign key (cancelled_by) references iam_users (id);
alter table ops_guides add constraint fk_ops_guides_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_guides add constraint fk_ops_guides_user_id foreign key (user_id) references iam_users (id);
alter table ops_guides add constraint fk_ops_guides_provider_id foreign key (provider_id) references catalog_providers (id);
alter table ops_drivers add constraint fk_ops_drivers_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_drivers add constraint fk_ops_drivers_user_id foreign key (user_id) references iam_users (id);
alter table ops_drivers add constraint fk_ops_drivers_provider_id foreign key (provider_id) references catalog_providers (id);
alter table ops_vehicles add constraint fk_ops_vehicles_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_vehicles add constraint fk_ops_vehicles_provider_id foreign key (provider_id) references catalog_providers (id);
alter table ops_orders add constraint fk_ops_orders_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_orders add constraint fk_ops_orders_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table ops_orders add constraint fk_ops_orders_coordinator_id foreign key (coordinator_id) references iam_users (id);
alter table ops_orders add constraint fk_ops_orders_closed_by foreign key (closed_by) references iam_users (id);
alter table ops_order_tasks add constraint fk_ops_order_tasks_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_order_tasks add constraint fk_ops_order_tasks_order_id foreign key (order_id) references ops_orders (id);
alter table ops_order_tasks add constraint fk_ops_order_tasks_done_by foreign key (done_by) references iam_users (id);
alter table ops_supplier_requests add constraint fk_ops_supplier_requests_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_supplier_requests add constraint fk_ops_supplier_requests_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table ops_supplier_requests add constraint fk_ops_supplier_requests_provider_id foreign key (provider_id) references catalog_providers (id);
alter table ops_supplier_requests add constraint fk_ops_supplier_requests_requested_by foreign key (requested_by) references iam_users (id);
alter table ops_supplier_requests add constraint fk_ops_supplier_requests_responded_by_user_id foreign key (responded_by_user_id) references iam_users (id);
alter table ops_assignments add constraint fk_ops_assignments_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_assignments add constraint fk_ops_assignments_order_id foreign key (order_id) references ops_orders (id);
alter table ops_assignments add constraint fk_ops_assignments_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table ops_assignments add constraint fk_ops_assignments_guide_id foreign key (guide_id) references ops_guides (id);
alter table ops_assignments add constraint fk_ops_assignments_driver_id foreign key (driver_id) references ops_drivers (id);
alter table ops_assignments add constraint fk_ops_assignments_vehicle_id foreign key (vehicle_id) references ops_vehicles (id);
alter table ops_assignment_checkins add constraint fk_ops_assignment_checkins_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_assignment_checkins add constraint fk_ops_assignment_checkins_assignment_id foreign key (assignment_id) references ops_assignments (id);
alter table ops_assignment_checkins add constraint fk_ops_assignment_checkins_passenger_id foreign key (passenger_id) references booking_passengers (id);
alter table ops_assignment_checkins add constraint fk_ops_assignment_checkins_undone_by foreign key (undone_by) references iam_users (id);
alter table ops_rooming_lists add constraint fk_ops_rooming_lists_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_rooming_lists add constraint fk_ops_rooming_lists_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table ops_rooming_lists add constraint fk_ops_rooming_lists_hotel_provider_id foreign key (hotel_provider_id) references catalog_providers (id);
alter table ops_rooming_lists add constraint fk_ops_rooming_lists_sent_by foreign key (sent_by) references iam_users (id);
alter table ops_rooming_lists add constraint fk_ops_rooming_lists_hotel_ack_by foreign key (hotel_ack_by) references iam_users (id);
alter table ops_rooming_lists add constraint fk_ops_rooming_lists_hotel_confirmed_by foreign key (hotel_confirmed_by) references iam_users (id);
alter table ops_rooming_lists add constraint fk_ops_rooming_lists_document_id foreign key (document_id) references sys_documents (id);
alter table ops_rooming_rooms add constraint fk_ops_rooming_rooms_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_rooming_rooms add constraint fk_ops_rooming_rooms_rooming_list_id foreign key (rooming_list_id) references ops_rooming_lists (id) on delete cascade;
alter table ops_rooming_rooms add constraint fk_ops_rooming_rooms_hotel_provider_id foreign key (hotel_provider_id) references catalog_providers (id);
alter table ops_rooming_rooms add constraint fk_ops_rooming_rooms_incident_id foreign key (incident_id) references ops_incidents (id);
alter table ops_rooming_guests add constraint fk_ops_rooming_guests_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_rooming_guests add constraint fk_ops_rooming_guests_room_id foreign key (room_id) references ops_rooming_rooms (id) on delete cascade;
alter table ops_rooming_guests add constraint fk_ops_rooming_guests_rooming_list_id foreign key (rooming_list_id) references ops_rooming_lists (id);
alter table ops_rooming_guests add constraint fk_ops_rooming_guests_passenger_id foreign key (passenger_id) references booking_passengers (id);
alter table ops_vouchers add constraint fk_ops_vouchers_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_vouchers add constraint fk_ops_vouchers_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table ops_vouchers add constraint fk_ops_vouchers_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table ops_vouchers add constraint fk_ops_vouchers_provider_id foreign key (provider_id) references catalog_providers (id);
alter table ops_vouchers add constraint fk_ops_vouchers_issued_by foreign key (issued_by) references iam_users (id);
alter table ops_vouchers add constraint fk_ops_vouchers_used_by foreign key (used_by) references iam_users (id);
alter table ops_vouchers add constraint fk_ops_vouchers_void_by foreign key (void_by) references iam_users (id);
alter table ops_vouchers add constraint fk_ops_vouchers_document_id foreign key (document_id) references sys_documents (id);
alter table ops_voucher_versions add constraint fk_ops_voucher_versions_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_voucher_versions add constraint fk_ops_voucher_versions_voucher_id foreign key (voucher_id) references ops_vouchers (id);
alter table ops_voucher_versions add constraint fk_ops_voucher_versions_issued_by foreign key (issued_by) references iam_users (id);
alter table ops_voucher_versions add constraint fk_ops_voucher_versions_document_id foreign key (document_id) references sys_documents (id);
alter table ops_incidents add constraint fk_ops_incidents_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_incidents add constraint fk_ops_incidents_order_id foreign key (order_id) references ops_orders (id);
alter table ops_incidents add constraint fk_ops_incidents_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table ops_incidents add constraint fk_ops_incidents_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table ops_incidents add constraint fk_ops_incidents_provider_id foreign key (provider_id) references catalog_providers (id);
alter table ops_incidents add constraint fk_ops_incidents_assignee_id foreign key (assignee_id) references iam_users (id);
alter table ops_incidents add constraint fk_ops_incidents_reported_by foreign key (reported_by) references iam_users (id);
alter table ops_incidents add constraint fk_ops_incidents_resolved_by foreign key (resolved_by) references iam_users (id);
alter table ops_incidents add constraint fk_ops_incidents_closed_by foreign key (closed_by) references iam_users (id);
alter table ops_incidents add constraint fk_ops_incidents_related_incident_id foreign key (related_incident_id) references ops_incidents (id);
alter table ops_incident_logs add constraint fk_ops_incident_logs_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_incident_logs add constraint fk_ops_incident_logs_incident_id foreign key (incident_id) references ops_incidents (id);
alter table ops_incident_logs add constraint fk_ops_incident_logs_user_id foreign key (user_id) references iam_users (id);
alter table ops_evidences add constraint fk_ops_evidences_tenant_id foreign key (tenant_id) references tenants (id);
alter table ops_evidences add constraint fk_ops_evidences_order_id foreign key (order_id) references ops_orders (id);
alter table ops_evidences add constraint fk_ops_evidences_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table ops_evidences add constraint fk_ops_evidences_incident_id foreign key (incident_id) references ops_incidents (id);
alter table ops_evidences add constraint fk_ops_evidences_uploaded_by foreign key (uploaded_by) references iam_users (id);
alter table ops_evidences add constraint fk_ops_evidences_removed_by foreign key (removed_by) references iam_users (id);
alter table fin_bank_accounts add constraint fk_fin_bank_accounts_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_payment_methods add constraint fk_fin_payment_methods_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_receivables add constraint fk_fin_receivables_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_receivables add constraint fk_fin_receivables_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table fin_receivables add constraint fk_fin_receivables_client_id foreign key (client_id) references crm_clients (id);
alter table fin_receivable_reminders add constraint fk_fin_receivable_reminders_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_receivable_reminders add constraint fk_fin_receivable_reminders_receivable_id foreign key (receivable_id) references fin_receivables (id);
alter table fin_receivable_reminders add constraint fk_fin_receivable_reminders_sent_by foreign key (sent_by) references iam_users (id);
alter table fin_payments add constraint fk_fin_payments_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_payments add constraint fk_fin_payments_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table fin_payments add constraint fk_fin_payments_receivable_id foreign key (receivable_id) references fin_receivables (id);
alter table fin_payments add constraint fk_fin_payments_evidence_document_id foreign key (evidence_document_id) references sys_documents (id);
alter table fin_payments add constraint fk_fin_payments_reverted_by foreign key (reverted_by) references iam_users (id);
alter table fin_payments add constraint fk_fin_payments_registered_by foreign key (registered_by) references iam_users (id);
alter table fin_payment_applications add constraint fk_fin_payment_applications_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_payment_applications add constraint fk_fin_payment_applications_payment_id foreign key (payment_id) references fin_payments (id);
alter table fin_payment_applications add constraint fk_fin_payment_applications_receivable_id foreign key (receivable_id) references fin_receivables (id);
alter table fin_payment_applications add constraint fk_fin_payment_applications_applied_by foreign key (applied_by) references iam_users (id);
alter table fin_payment_applications add constraint fk_fin_payment_applications_reversed_by foreign key (reversed_by) references iam_users (id);
alter table fin_status_history add constraint fk_fin_status_history_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_status_history add constraint fk_fin_status_history_user_id foreign key (user_id) references iam_users (id);
alter table fin_payables add constraint fk_fin_payables_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_payables add constraint fk_fin_payables_provider_id foreign key (provider_id) references catalog_providers (id);
alter table fin_payables add constraint fk_fin_payables_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table fin_payables add constraint fk_fin_payables_reservation_service_id foreign key (reservation_service_id) references booking_reservation_services (id);
alter table fin_payables add constraint fk_fin_payables_approved_by foreign key (approved_by) references iam_users (id);
alter table fin_payables add constraint fk_fin_payables_scheduled_bank_account_id foreign key (scheduled_bank_account_id) references fin_bank_accounts (id);
alter table fin_payables add constraint fk_fin_payables_scheduled_by foreign key (scheduled_by) references iam_users (id);
alter table fin_payable_payouts add constraint fk_fin_payable_payouts_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_payable_payouts add constraint fk_fin_payable_payouts_payable_id foreign key (payable_id) references fin_payables (id);
alter table fin_payable_payouts add constraint fk_fin_payable_payouts_bank_account_id foreign key (bank_account_id) references fin_bank_accounts (id);
alter table fin_commission_rules add constraint fk_fin_commission_rules_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_commissions add constraint fk_fin_commissions_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_commissions add constraint fk_fin_commissions_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table fin_commissions add constraint fk_fin_commissions_beneficiary_user_id foreign key (beneficiary_user_id) references iam_users (id);
alter table fin_commissions add constraint fk_fin_commissions_rule_id foreign key (rule_id) references fin_commission_rules (id);
alter table fin_commissions add constraint fk_fin_commissions_approved_by foreign key (approved_by) references iam_users (id);
alter table fin_settlements add constraint fk_fin_settlements_tenant_id foreign key (tenant_id) references tenants (id);
alter table fin_settlements add constraint fk_fin_settlements_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table fin_settlements add constraint fk_fin_settlements_closed_by foreign key (closed_by) references iam_users (id);
alter table fin_fx_rates add constraint fk_fin_fx_rates_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_support_tickets add constraint fk_channel_support_tickets_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_support_tickets add constraint fk_channel_support_tickets_crm_client_id foreign key (crm_client_id) references crm_clients (id);
alter table channel_support_tickets add constraint fk_channel_support_tickets_reservation_id foreign key (reservation_id) references booking_reservations (id);
alter table channel_support_tickets add constraint fk_channel_support_tickets_owner_id foreign key (owner_id) references iam_users (id);
alter table channel_support_tickets add constraint fk_channel_support_tickets_created_by_user_id foreign key (created_by_user_id) references iam_users (id);
alter table channel_support_ticket_events add constraint fk_channel_support_ticket_events_tenant_id foreign key (tenant_id) references tenants (id);
alter table channel_support_ticket_events add constraint fk_channel_support_ticket_events_ticket_id foreign key (ticket_id) references channel_support_tickets (id);
alter table channel_support_ticket_events add constraint fk_channel_support_ticket_events_user_id foreign key (user_id) references iam_users (id);
alter table report_exports add constraint fk_report_exports_tenant_id foreign key (tenant_id) references tenants (id);
alter table report_exports add constraint fk_report_exports_requested_by foreign key (requested_by) references iam_users (id);
alter table report_exports add constraint fk_report_exports_scheduled_job_id foreign key (scheduled_job_id) references sys_scheduled_jobs (id);

-- ---------------------------------------------------------------- índices (FK, listados, búsquedas)
create index ix_catalog_destinations_tenant_id_path_text_pattern_ops on catalog_destinations (tenant_id, path text_pattern_ops);
create index ix_catalog_providers_tenant_id_status on catalog_providers (tenant_id, status);
create index ix_catalog_providers_tenant_id_contract_end on catalog_providers (tenant_id, contract_end);
create index ix_catalog_providers_name_gin_trgm_ops on catalog_providers using gin (name gin_trgm_ops);
create index ix_catalog_services_tenant_id_provider_id on catalog_services (tenant_id, provider_id);
create index ix_catalog_services_tenant_id_status on catalog_services (tenant_id, status);
create index ix_catalog_services_tenant_id_valid_to on catalog_services (tenant_id, valid_to);
create index ix_catalog_products_tenant_id_status on catalog_products (tenant_id, status);
create index ix_catalog_products_tenant_id_product_type_id on catalog_products (tenant_id, product_type_id);
create index ix_catalog_products_tenant_id_category_id on catalog_products (tenant_id, category_id);
create index ix_catalog_products_tenant_id_primary_destination_id on catalog_products (tenant_id, primary_destination_id);
create index ix_catalog_products_tenant_id_created_at_desc on catalog_products (tenant_id, created_at desc);
create index ix_catalog_products_name_code_sku_gin_trgm_ops on catalog_products using gin ((name || ' ' || code || ' ' || sku) gin_trgm_ops);
create index ix_catalog_product_items_product_id_sort_order on catalog_product_items (product_id, sort_order);
create index ix_catalog_product_promotions_tenant_id_status on catalog_product_promotions (tenant_id, status);
create index ix_catalog_rates_tenant_id_product_id on catalog_rates (tenant_id, product_id);
create index ix_catalog_rates_tenant_id_valid_to on catalog_rates (tenant_id, valid_to);
create index ix_catalog_rates_product_id_segment_channel_valid_from_valid_to on catalog_rates (product_id, segment, channel, valid_from, valid_to);
create index ix_catalog_rates_tenant_id_status on catalog_rates (tenant_id, status);
create index ix_catalog_product_departures_tenant_id_departure_date on catalog_product_departures (tenant_id, departure_date);
create index ix_catalog_product_departures_product_id_departure_date__1e9996 on catalog_product_departures (product_id, departure_date, departure_time);
create index ix_catalog_product_departures_tenant_id_status on catalog_product_departures (tenant_id, status);
create index ix_catalog_availability_holds_departure_id_status on catalog_availability_holds (departure_id, status);
create index ix_catalog_availability_holds_tenant_id_status_expires_at on catalog_availability_holds (tenant_id, status, expires_at);
create index ix_catalog_availability_holds_tenant_id_product_id_servi_d63fbf on catalog_availability_holds (tenant_id, product_id, service_date) where status = 'hold';
create index ix_catalog_availability_holds_reference_type_reference_id on catalog_availability_holds (reference_type, reference_id);
create index ix_catalog_availability_ranges_tenant_id_product_id_date_60aa29 on catalog_availability_ranges (tenant_id, product_id, date_from, date_to);
create index ix_catalog_availability_ranges_daterange_date_from_date_to on catalog_availability_ranges using gist (daterange(date_from, date_to, '[]'));
create index ix_crm_clients_tenant_id_owner_id on crm_clients (tenant_id, owner_id);
create index ix_crm_clients_tenant_id_segment_code on crm_clients (tenant_id, segment_code);
create index ix_crm_clients_tenant_id_created_at_desc on crm_clients (tenant_id, created_at desc);
create index ix_crm_clients_tenant_id_email_norm on crm_clients (tenant_id, email_norm);
create index ix_crm_clients_tenant_id_phone_norm on crm_clients (tenant_id, phone_norm);
create index ix_crm_clients_tags on crm_clients using gin (tags);
create index ix_crm_leads_tenant_id_status on crm_leads (tenant_id, status);
create index ix_crm_leads_tenant_id_owner_id on crm_leads (tenant_id, owner_id);
create index ix_crm_leads_tenant_id_created_at_desc on crm_leads (tenant_id, created_at desc);
create index ix_crm_leads_tenant_id_source_code on crm_leads (tenant_id, source_code);
create index ix_crm_leads_tenant_id_email_norm on crm_leads (tenant_id, email_norm);
create index ix_crm_leads_tenant_id_phone_norm on crm_leads (tenant_id, phone_norm);
create index ix_crm_leads_tenant_id_created_at_p on crm_leads (tenant_id, created_at) where owner_id is null and status in ('nuevo','contactado');
create index ix_crm_opportunities_tenant_id_stage on crm_opportunities (tenant_id, stage);
create index ix_crm_opportunities_tenant_id_owner_id on crm_opportunities (tenant_id, owner_id);
create index ix_crm_opportunities_tenant_id_expected_close_date on crm_opportunities (tenant_id, expected_close_date);
create index ix_crm_opportunities_tenant_id_created_at_desc on crm_opportunities (tenant_id, created_at desc);
create index ix_crm_activities_tenant_id_owner_id_status_due_at on crm_activities (tenant_id, owner_id, status, due_at);
create index ix_crm_activities_tenant_id_related_type_related_id on crm_activities (tenant_id, related_type, related_id);
create index ix_crm_activities_tenant_id_due_at_p on crm_activities (tenant_id, due_at) where status <> 'completada';
create index ix_crm_activities_tenant_id_status on crm_activities (tenant_id, status);
create index ix_crm_activities_tenant_id_created_at_desc on crm_activities (tenant_id, created_at desc);
create index ix_crm_cases_tenant_id_status on crm_cases (tenant_id, status);
create index ix_crm_cases_tenant_id_owner_id on crm_cases (tenant_id, owner_id);
create index ix_crm_cases_tenant_id_client_id on crm_cases (tenant_id, client_id);
create index ix_crm_cases_tenant_id_created_at_desc on crm_cases (tenant_id, created_at desc);
create index ix_crm_cases_tenant_id_is_book_book_status on crm_cases (tenant_id, is_book, book_status);
create index ix_crm_cases_tenant_id_due_date_p on crm_cases (tenant_id, due_date) where is_book and book_status in ('received','in_review');
create index ix_crm_cases_tenant_id_sede_id on crm_cases (tenant_id, sede_id);
create index ix_quote_quotes_tenant_id_status on quote_quotes (tenant_id, status);
create index ix_quote_quotes_tenant_id_owner_id on quote_quotes (tenant_id, owner_id);
create index ix_quote_quotes_tenant_id_valid_until on quote_quotes (tenant_id, valid_until);
create index ix_quote_quotes_tenant_id_created_at_desc on quote_quotes (tenant_id, created_at desc);
create index ix_quote_quotes_tenant_id_client_id on quote_quotes (tenant_id, client_id);
create index ix_quote_quotes_tenant_id_opportunity_id on quote_quotes (tenant_id, opportunity_id);
create index ix_quote_quotes_title_gin_trgm_ops on quote_quotes using gin (title gin_trgm_ops);
create index ix_quote_versions_tenant_id_status on quote_versions (tenant_id, status);
create index ix_quote_internal_approvals_tenant_id_status on quote_internal_approvals (tenant_id, status);
create index ix_quote_sends_tenant_id_quote_id on quote_sends (tenant_id, quote_id);
create index ix_quote_approvals_tenant_id_quote_id on quote_approvals (tenant_id, quote_id);
create index ix_booking_reservations_tenant_id_status on booking_reservations (tenant_id, status);
create index ix_booking_reservations_tenant_id_owner_id on booking_reservations (tenant_id, owner_id);
create index ix_booking_reservations_tenant_id_client_id on booking_reservations (tenant_id, client_id);
create index ix_booking_reservations_tenant_id_travel_from on booking_reservations (tenant_id, travel_from);
create index ix_booking_reservations_tenant_id_created_at_desc on booking_reservations (tenant_id, created_at desc);
create index ix_booking_reservation_services_reservation_id_service_date on booking_reservation_services (reservation_id, service_date);
create index ix_booking_reservation_services_tenant_id_status on booking_reservation_services (tenant_id, status);
create index ix_booking_reservation_services_tenant_id_provider_id_status on booking_reservation_services (tenant_id, provider_id, status);
create index ix_booking_inventory_holds_tenant_id_status_expires_at on booking_inventory_holds (tenant_id, status, expires_at);
create index ix_booking_changes_tenant_id_status on booking_changes (tenant_id, status);
create index ix_booking_cancel_requests_tenant_id_status on booking_cancel_requests (tenant_id, status);
create index ix_ops_guides_tenant_id_status on ops_guides (tenant_id, status);
create index ix_ops_guides_languages on ops_guides using gin (languages);
create index ix_ops_drivers_tenant_id_status on ops_drivers (tenant_id, status);
create index ix_ops_drivers_tenant_id_license_expires_on on ops_drivers (tenant_id, license_expires_on);
create index ix_ops_vehicles_tenant_id_status on ops_vehicles (tenant_id, status);
create index ix_ops_vehicles_tenant_id_soat_expires_on on ops_vehicles (tenant_id, soat_expires_on);
create index ix_ops_orders_tenant_id_status on ops_orders (tenant_id, status);
create index ix_ops_orders_tenant_id_coordinator_id on ops_orders (tenant_id, coordinator_id);
create index ix_ops_orders_tenant_id_date_from on ops_orders (tenant_id, date_from);
create index ix_ops_orders_tenant_id_created_at_desc on ops_orders (tenant_id, created_at desc);
create index ix_ops_supplier_requests_tenant_id_provider_id_status on ops_supplier_requests (tenant_id, provider_id, status);
create index ix_ops_supplier_requests_tenant_id_status on ops_supplier_requests (tenant_id, status);
create index ix_ops_assignments_tenant_id_guide_id_service_date on ops_assignments (tenant_id, guide_id, service_date);
create index ix_ops_assignments_tenant_id_driver_id_service_date on ops_assignments (tenant_id, driver_id, service_date);
create index ix_ops_assignments_tenant_id_vehicle_id_service_date on ops_assignments (tenant_id, vehicle_id, service_date);
create index ix_ops_assignments_tenant_id_status on ops_assignments (tenant_id, status);
create index ix_ops_rooming_lists_tenant_id_status on ops_rooming_lists (tenant_id, status);
create index ix_ops_vouchers_tenant_id_provider_id_status on ops_vouchers (tenant_id, provider_id, status);
create index ix_ops_vouchers_tenant_id_status on ops_vouchers (tenant_id, status);
create index ix_ops_vouchers_tenant_id_created_at_desc on ops_vouchers (tenant_id, created_at desc);
create index ix_ops_incidents_tenant_id_status_severity on ops_incidents (tenant_id, status, severity);
create index ix_ops_incidents_tenant_id_order_id on ops_incidents (tenant_id, order_id);
create index ix_ops_incidents_tenant_id_assignee_id on ops_incidents (tenant_id, assignee_id);
create index ix_ops_incidents_tenant_id_provider_id on ops_incidents (tenant_id, provider_id);
create index ix_ops_incidents_tenant_id_sla_due_at_p on ops_incidents (tenant_id, sla_due_at) where status in ('abierta','en_proceso');
create index ix_ops_incidents_tenant_id_created_at_desc on ops_incidents (tenant_id, created_at desc);
create index ix_fin_receivables_tenant_id_status on fin_receivables (tenant_id, status);
create index ix_fin_receivables_tenant_id_reservation_id on fin_receivables (tenant_id, reservation_id);
create index ix_fin_receivables_tenant_id_client_id on fin_receivables (tenant_id, client_id);
create index ix_fin_receivables_tenant_id_created_at_desc on fin_receivables (tenant_id, created_at desc);
create index ix_fin_receivables_tenant_id_due_date_p on fin_receivables (tenant_id, due_date) where status in ('abierta','parcial','vencida');
create index ix_fin_payments_tenant_id_status on fin_payments (tenant_id, status);
create index ix_fin_payments_tenant_id_reservation_id on fin_payments (tenant_id, reservation_id);
create index ix_fin_payments_tenant_id_created_at_desc on fin_payments (tenant_id, created_at desc);
create index ix_fin_status_history_tenant_id_entity_type_entity_id on fin_status_history (tenant_id, entity_type, entity_id);
create index ix_fin_payables_tenant_id_status on fin_payables (tenant_id, status);
create index ix_fin_payables_tenant_id_due_date on fin_payables (tenant_id, due_date);
create index ix_fin_payables_tenant_id_kind on fin_payables (tenant_id, kind);
create index ix_fin_payables_tenant_id_created_at_desc on fin_payables (tenant_id, created_at desc);
create index ix_fin_commissions_tenant_id_status on fin_commissions (tenant_id, status);
create index ix_fin_commissions_tenant_id_created_at_desc on fin_commissions (tenant_id, created_at desc);
create index ix_fin_fx_rates_tenant_id_currency_code_effective_at_desc on fin_fx_rates (tenant_id, currency_code, effective_at desc);
create index ix_fin_fx_rates_tenant_id_currency_code_rate_date_desc on fin_fx_rates (tenant_id, currency_code, rate_date desc);
create index ix_channel_support_tickets_tenant_id_status on channel_support_tickets (tenant_id, status);
create index ix_channel_support_tickets_tenant_id_owner_id on channel_support_tickets (tenant_id, owner_id);
create index ix_channel_support_tickets_tenant_id_created_at_desc on channel_support_tickets (tenant_id, created_at desc);
create index ix_report_exports_tenant_id_status on report_exports (tenant_id, status);
create index ix_report_exports_tenant_id_created_at_desc on report_exports (tenant_id, created_at desc);
create index ix_catalog_product_categories_tenant_id_created_at_desc on catalog_product_categories (tenant_id, created_at desc);
create index ix_catalog_destinations_tenant_id_created_at_desc on catalog_destinations (tenant_id, created_at desc);
create index ix_catalog_providers_tenant_id_created_at_desc on catalog_providers (tenant_id, created_at desc);
create index ix_catalog_services_tenant_id_created_at_desc on catalog_services (tenant_id, created_at desc);
create index ix_catalog_product_versions_tenant_id_status on catalog_product_versions (tenant_id, status);
create index ix_catalog_seasons_tenant_id_status on catalog_seasons (tenant_id, status);
create index ix_catalog_seasons_tenant_id_created_at_desc on catalog_seasons (tenant_id, created_at desc);
create index ix_catalog_product_promotions_tenant_id_created_at_desc on catalog_product_promotions (tenant_id, created_at desc);
create index ix_catalog_rates_tenant_id_created_at_desc on catalog_rates (tenant_id, created_at desc);
create index ix_catalog_price_rules_tenant_id_status on catalog_price_rules (tenant_id, status);
create index ix_catalog_price_rules_tenant_id_created_at_desc on catalog_price_rules (tenant_id, created_at desc);
create index ix_catalog_product_departures_tenant_id_created_at_desc on catalog_product_departures (tenant_id, created_at desc);
create index ix_catalog_availability_holds_tenant_id_status on catalog_availability_holds (tenant_id, status);
create index ix_catalog_availability_holds_tenant_id_created_at_desc on catalog_availability_holds (tenant_id, created_at desc);
create index ix_catalog_availability_ranges_tenant_id_status on catalog_availability_ranges (tenant_id, status);
create index ix_catalog_availability_ranges_tenant_id_created_at_desc on catalog_availability_ranges (tenant_id, created_at desc);
create index ix_crm_catalog_items_tenant_id_created_at_desc on crm_catalog_items (tenant_id, created_at desc);
create index ix_crm_pipeline_stages_tenant_id_created_at_desc on crm_pipeline_stages (tenant_id, created_at desc);
create index ix_crm_activities_tenant_id_owner_id on crm_activities (tenant_id, owner_id);
create index ix_crm_surveys_tenant_id_created_at_desc on crm_surveys (tenant_id, created_at desc);
create index ix_booking_reservation_services_tenant_id_created_at_desc on booking_reservation_services (tenant_id, created_at desc);
create index ix_booking_inventory_holds_tenant_id_status on booking_inventory_holds (tenant_id, status);
create index ix_ops_guides_tenant_id_created_at_desc on ops_guides (tenant_id, created_at desc);
create index ix_ops_drivers_tenant_id_created_at_desc on ops_drivers (tenant_id, created_at desc);
create index ix_ops_rooming_rooms_tenant_id_status on ops_rooming_rooms (tenant_id, status);
create index ix_ops_incidents_tenant_id_status on ops_incidents (tenant_id, status);
create index ix_fin_payment_methods_tenant_id_created_at_desc on fin_payment_methods (tenant_id, created_at desc);
create index ix_fin_status_history_tenant_id_status on fin_status_history (tenant_id, status);
create index ix_fin_payable_payouts_tenant_id_created_at_desc on fin_payable_payouts (tenant_id, created_at desc);
create index ix_iam_users_client_id on iam_users (client_id);
create index ix_iam_users_provider_id on iam_users (provider_id);
create index ix_iam_users_guide_id on iam_users (guide_id);
create index ix_iam_users_driver_id on iam_users (driver_id);
create index ix_iam_users_reservation_id on iam_users (reservation_id);
create index ix_notif_messages_client_id on notif_messages (client_id);
create index ix_notif_messages_reservation_id on notif_messages (reservation_id);
create index ix_catalog_destinations_parent_id on catalog_destinations (parent_id);
create index ix_catalog_provider_contacts_provider_id on catalog_provider_contacts (provider_id);
create index ix_catalog_services_provider_id on catalog_services (provider_id);
create index ix_catalog_products_product_type_id on catalog_products (product_type_id);
create index ix_catalog_products_category_id on catalog_products (category_id);
create index ix_catalog_products_subcategory_id on catalog_products (subcategory_id);
create index ix_catalog_products_primary_destination_id on catalog_products (primary_destination_id);
create index ix_catalog_products_main_provider_id on catalog_products (main_provider_id);
create index ix_catalog_products_current_version_id on catalog_products (current_version_id);
create index ix_catalog_product_destinations_destination_id on catalog_product_destinations (destination_id);
create index ix_catalog_product_items_service_id on catalog_product_items (service_id);
create index ix_catalog_product_items_component_product_id on catalog_product_items (component_product_id);
create index ix_catalog_product_items_provider_id on catalog_product_items (provider_id);
create index ix_catalog_itineraries_product_id on catalog_itineraries (product_id);
create index ix_catalog_itinerary_items_day_id on catalog_itinerary_items (day_id);
create index ix_catalog_itinerary_items_service_id on catalog_itinerary_items (service_id);
create index ix_catalog_product_requirements_product_id on catalog_product_requirements (product_id);
create index ix_catalog_product_related_related_product_id on catalog_product_related (related_product_id);
create index ix_catalog_product_promotions_product_id on catalog_product_promotions (product_id);
create index ix_catalog_product_media_product_id on catalog_product_media (product_id);
create index ix_catalog_product_faqs_product_id on catalog_product_faqs (product_id);
create index ix_catalog_product_channels_published_by on catalog_product_channels (published_by);
create index ix_catalog_product_seasons_season_id on catalog_product_seasons (season_id);
create index ix_catalog_product_config_options_group_id on catalog_product_config_options (group_id);
create index ix_catalog_rates_season_id on catalog_rates (season_id);
create index ix_catalog_rate_conditions_rate_id on catalog_rate_conditions (rate_id);
create index ix_catalog_price_rules_product_id on catalog_price_rules (product_id);
create index ix_catalog_product_departures_provider_id on catalog_product_departures (provider_id);
create index ix_catalog_product_departures_guide_id on catalog_product_departures (guide_id);
create index ix_catalog_product_departures_vehicle_id on catalog_product_departures (vehicle_id);
create index ix_catalog_availability_holds_product_id on catalog_availability_holds (product_id);
create index ix_catalog_availability_ranges_product_id on catalog_availability_ranges (product_id);
create index ix_catalog_pax_rules_product_id on catalog_pax_rules (product_id);
create index ix_crm_clients_owner_id on crm_clients (owner_id);
create index ix_crm_clients_source_lead_id on crm_clients (source_lead_id);
create index ix_crm_leads_destination_id on crm_leads (destination_id);
create index ix_crm_leads_product_id on crm_leads (product_id);
create index ix_crm_leads_owner_id on crm_leads (owner_id);
create index ix_crm_leads_taken_by on crm_leads (taken_by);
create index ix_crm_leads_converted_client_id on crm_leads (converted_client_id);
create index ix_crm_leads_converted_opportunity_id on crm_leads (converted_opportunity_id);
create index ix_crm_leads_converted_by on crm_leads (converted_by);
create index ix_crm_lead_qualifications_lead_id on crm_lead_qualifications (lead_id);
create index ix_crm_lead_qualifications_qualified_by on crm_lead_qualifications (qualified_by);
create index ix_crm_client_contacts_client_id on crm_client_contacts (client_id);
create index ix_crm_client_contacts_source_lead_id on crm_client_contacts (source_lead_id);
create index ix_crm_opportunities_client_id on crm_opportunities (client_id);
create index ix_crm_opportunities_owner_id on crm_opportunities (owner_id);
create index ix_crm_opportunities_lead_id on crm_opportunities (lead_id);
create index ix_crm_opportunities_product_id on crm_opportunities (product_id);
create index ix_crm_activities_owner_id on crm_activities (owner_id);
create index ix_crm_activities_completed_by on crm_activities (completed_by);
create index ix_crm_activities_previous_activity_id on crm_activities (previous_activity_id);
create index ix_crm_activities_merged_from_lead_id on crm_activities (merged_from_lead_id);
create index ix_crm_surveys_client_id on crm_surveys (client_id);
create index ix_crm_surveys_reservation_id on crm_surveys (reservation_id);
create index ix_crm_surveys_recorded_by on crm_surveys (recorded_by);
create index ix_crm_cases_client_id on crm_cases (client_id);
create index ix_crm_cases_reservation_id on crm_cases (reservation_id);
create index ix_crm_cases_survey_id on crm_cases (survey_id);
create index ix_crm_cases_owner_id on crm_cases (owner_id);
create index ix_crm_cases_sede_id on crm_cases (sede_id);
create index ix_crm_cases_submitted_by on crm_cases (submitted_by);
create index ix_crm_case_events_case_id on crm_case_events (case_id);
create index ix_crm_case_events_user_id on crm_case_events (user_id);
create index ix_quote_quotes_client_id on quote_quotes (client_id);
create index ix_quote_quotes_opportunity_id on quote_quotes (opportunity_id);
create index ix_quote_quotes_owner_id on quote_quotes (owner_id);
create index ix_quote_quotes_current_version_id on quote_quotes (current_version_id);
create index ix_quote_quotes_approval_recorded_by on quote_quotes (approval_recorded_by);
create index ix_quote_quotes_reservation_id on quote_quotes (reservation_id);
create index ix_quote_quotes_duplicated_from_id on quote_quotes (duplicated_from_id);
create index ix_quote_versions_quote_id on quote_versions (quote_id);
create index ix_quote_versions_author_id on quote_versions (author_id);
create index ix_quote_versions_internal_approval_id on quote_versions (internal_approval_id);
create index ix_quote_versions_pdf_document_id on quote_versions (pdf_document_id);
create index ix_quote_items_product_id on quote_items (product_id);
create index ix_quote_items_rate_id on quote_items (rate_id);
create index ix_quote_items_season_id on quote_items (season_id);
create index ix_quote_internal_approvals_quote_version_id on quote_internal_approvals (quote_version_id);
create index ix_quote_internal_approvals_requested_by on quote_internal_approvals (requested_by);
create index ix_quote_internal_approvals_decided_by on quote_internal_approvals (decided_by);
create index ix_quote_sends_quote_id on quote_sends (quote_id);
create index ix_quote_sends_sent_by on quote_sends (sent_by);
create index ix_quote_sends_notification_id on quote_sends (notification_id);
create index ix_quote_access_tokens_quote_id on quote_access_tokens (quote_id);
create index ix_quote_views_quote_id on quote_views (quote_id);
create index ix_quote_views_recorded_by on quote_views (recorded_by);
create index ix_quote_negotiations_quote_id on quote_negotiations (quote_id);
create index ix_quote_negotiations_recorded_by on quote_negotiations (recorded_by);
create index ix_quote_approvals_quote_id on quote_approvals (quote_id);
create index ix_quote_approvals_quote_version_id on quote_approvals (quote_version_id);
create index ix_quote_approvals_token_id on quote_approvals (token_id);
create index ix_booking_reservations_quote_id on booking_reservations (quote_id);
create index ix_booking_reservations_quote_version_id on booking_reservations (quote_version_id);
create index ix_booking_reservations_client_id on booking_reservations (client_id);
create index ix_booking_reservations_owner_id on booking_reservations (owner_id);
create index ix_booking_reservations_sede_id on booking_reservations (sede_id);
create index ix_booking_reservation_services_product_id on booking_reservation_services (product_id);
create index ix_booking_reservation_services_catalog_service_id on booking_reservation_services (catalog_service_id);
create index ix_booking_reservation_services_quote_item_id on booking_reservation_services (quote_item_id);
create index ix_booking_reservation_services_departure_id on booking_reservation_services (departure_id);
create index ix_booking_reservation_services_provider_id on booking_reservation_services (provider_id);
create index ix_booking_reservation_services_confirmed_by on booking_reservation_services (confirmed_by);
create index ix_booking_reservation_services_requested_by on booking_reservation_services (requested_by);
create index ix_booking_reservation_services_alt_of_id on booking_reservation_services (alt_of_id);
create index ix_booking_reservation_services_replaced_by_id on booking_reservation_services (replaced_by_id);
create index ix_booking_inventory_holds_departure_id on booking_inventory_holds (departure_id);
create index ix_booking_inventory_holds_reservation_id on booking_inventory_holds (reservation_id);
create index ix_booking_inventory_holds_booking_service_id on booking_inventory_holds (booking_service_id);
create index ix_booking_changes_reservation_id on booking_changes (reservation_id);
create index ix_booking_changes_product_id on booking_changes (product_id);
create index ix_booking_changes_requested_by on booking_changes (requested_by);
create index ix_booking_changes_decided_by on booking_changes (decided_by);
create index ix_booking_cancel_requests_reservation_id on booking_cancel_requests (reservation_id);
create index ix_booking_cancel_requests_requested_by on booking_cancel_requests (requested_by);
create index ix_booking_cancel_requests_decided_by on booking_cancel_requests (decided_by);
create index ix_booking_cancellations_refund_payment_id on booking_cancellations (refund_payment_id);
create index ix_booking_cancellations_penalty_receivable_id on booking_cancellations (penalty_receivable_id);
create index ix_booking_cancellations_cancelled_by on booking_cancellations (cancelled_by);
create index ix_ops_guides_user_id on ops_guides (user_id);
create index ix_ops_guides_provider_id on ops_guides (provider_id);
create index ix_ops_drivers_user_id on ops_drivers (user_id);
create index ix_ops_drivers_provider_id on ops_drivers (provider_id);
create index ix_ops_vehicles_provider_id on ops_vehicles (provider_id);
create index ix_ops_orders_reservation_id on ops_orders (reservation_id);
create index ix_ops_orders_coordinator_id on ops_orders (coordinator_id);
create index ix_ops_orders_closed_by on ops_orders (closed_by);
create index ix_ops_order_tasks_order_id on ops_order_tasks (order_id);
create index ix_ops_order_tasks_done_by on ops_order_tasks (done_by);
create index ix_ops_supplier_requests_reservation_service_id on ops_supplier_requests (reservation_service_id);
create index ix_ops_supplier_requests_provider_id on ops_supplier_requests (provider_id);
create index ix_ops_supplier_requests_requested_by on ops_supplier_requests (requested_by);
create index ix_ops_supplier_requests_responded_by_user_id on ops_supplier_requests (responded_by_user_id);
create index ix_ops_assignments_order_id on ops_assignments (order_id);
create index ix_ops_assignments_reservation_service_id on ops_assignments (reservation_service_id);
create index ix_ops_assignments_guide_id on ops_assignments (guide_id);
create index ix_ops_assignments_driver_id on ops_assignments (driver_id);
create index ix_ops_assignments_vehicle_id on ops_assignments (vehicle_id);
create index ix_ops_assignment_checkins_assignment_id on ops_assignment_checkins (assignment_id);
create index ix_ops_assignment_checkins_passenger_id on ops_assignment_checkins (passenger_id);
create index ix_ops_assignment_checkins_undone_by on ops_assignment_checkins (undone_by);
create index ix_ops_rooming_lists_reservation_id on ops_rooming_lists (reservation_id);
create index ix_ops_rooming_lists_hotel_provider_id on ops_rooming_lists (hotel_provider_id);
create index ix_ops_rooming_lists_sent_by on ops_rooming_lists (sent_by);
create index ix_ops_rooming_lists_hotel_ack_by on ops_rooming_lists (hotel_ack_by);
create index ix_ops_rooming_lists_hotel_confirmed_by on ops_rooming_lists (hotel_confirmed_by);
create index ix_ops_rooming_lists_document_id on ops_rooming_lists (document_id);
create index ix_ops_rooming_rooms_hotel_provider_id on ops_rooming_rooms (hotel_provider_id);
create index ix_ops_rooming_rooms_incident_id on ops_rooming_rooms (incident_id);
create index ix_ops_rooming_guests_room_id on ops_rooming_guests (room_id);
create index ix_ops_rooming_guests_passenger_id on ops_rooming_guests (passenger_id);
create index ix_ops_vouchers_reservation_id on ops_vouchers (reservation_id);
create index ix_ops_vouchers_reservation_service_id on ops_vouchers (reservation_service_id);
create index ix_ops_vouchers_provider_id on ops_vouchers (provider_id);
create index ix_ops_vouchers_issued_by on ops_vouchers (issued_by);
create index ix_ops_vouchers_used_by on ops_vouchers (used_by);
create index ix_ops_vouchers_void_by on ops_vouchers (void_by);
create index ix_ops_vouchers_document_id on ops_vouchers (document_id);
create index ix_ops_voucher_versions_issued_by on ops_voucher_versions (issued_by);
create index ix_ops_voucher_versions_document_id on ops_voucher_versions (document_id);
create index ix_ops_incidents_order_id on ops_incidents (order_id);
create index ix_ops_incidents_reservation_id on ops_incidents (reservation_id);
create index ix_ops_incidents_reservation_service_id on ops_incidents (reservation_service_id);
create index ix_ops_incidents_provider_id on ops_incidents (provider_id);
create index ix_ops_incidents_assignee_id on ops_incidents (assignee_id);
create index ix_ops_incidents_reported_by on ops_incidents (reported_by);
create index ix_ops_incidents_resolved_by on ops_incidents (resolved_by);
create index ix_ops_incidents_closed_by on ops_incidents (closed_by);
create index ix_ops_incidents_related_incident_id on ops_incidents (related_incident_id);
create index ix_ops_incident_logs_incident_id on ops_incident_logs (incident_id);
create index ix_ops_incident_logs_user_id on ops_incident_logs (user_id);
create index ix_ops_evidences_order_id on ops_evidences (order_id);
create index ix_ops_evidences_reservation_service_id on ops_evidences (reservation_service_id);
create index ix_ops_evidences_incident_id on ops_evidences (incident_id);
create index ix_ops_evidences_uploaded_by on ops_evidences (uploaded_by);
create index ix_ops_evidences_removed_by on ops_evidences (removed_by);
create index ix_fin_receivables_reservation_id on fin_receivables (reservation_id);
create index ix_fin_receivables_client_id on fin_receivables (client_id);
create index ix_fin_receivable_reminders_receivable_id on fin_receivable_reminders (receivable_id);
create index ix_fin_receivable_reminders_sent_by on fin_receivable_reminders (sent_by);
create index ix_fin_payments_reservation_id on fin_payments (reservation_id);
create index ix_fin_payments_receivable_id on fin_payments (receivable_id);
create index ix_fin_payments_evidence_document_id on fin_payments (evidence_document_id);
create index ix_fin_payments_reverted_by on fin_payments (reverted_by);
create index ix_fin_payments_registered_by on fin_payments (registered_by);
create index ix_fin_payment_applications_payment_id on fin_payment_applications (payment_id);
create index ix_fin_payment_applications_receivable_id on fin_payment_applications (receivable_id);
create index ix_fin_payment_applications_applied_by on fin_payment_applications (applied_by);
create index ix_fin_payment_applications_reversed_by on fin_payment_applications (reversed_by);
create index ix_fin_status_history_user_id on fin_status_history (user_id);
create index ix_fin_payables_provider_id on fin_payables (provider_id);
create index ix_fin_payables_reservation_id on fin_payables (reservation_id);
create index ix_fin_payables_reservation_service_id on fin_payables (reservation_service_id);
create index ix_fin_payables_approved_by on fin_payables (approved_by);
create index ix_fin_payables_scheduled_bank_account_id on fin_payables (scheduled_bank_account_id);
create index ix_fin_payables_scheduled_by on fin_payables (scheduled_by);
create index ix_fin_payable_payouts_payable_id on fin_payable_payouts (payable_id);
create index ix_fin_payable_payouts_bank_account_id on fin_payable_payouts (bank_account_id);
create index ix_fin_commissions_reservation_id on fin_commissions (reservation_id);
create index ix_fin_commissions_beneficiary_user_id on fin_commissions (beneficiary_user_id);
create index ix_fin_commissions_rule_id on fin_commissions (rule_id);
create index ix_fin_commissions_approved_by on fin_commissions (approved_by);
create index ix_fin_settlements_reservation_id on fin_settlements (reservation_id);
create index ix_fin_settlements_closed_by on fin_settlements (closed_by);
create index ix_channel_support_tickets_crm_client_id on channel_support_tickets (crm_client_id);
create index ix_channel_support_tickets_reservation_id on channel_support_tickets (reservation_id);
create index ix_channel_support_tickets_owner_id on channel_support_tickets (owner_id);
create index ix_channel_support_tickets_created_by_user_id on channel_support_tickets (created_by_user_id);
create index ix_channel_support_ticket_events_ticket_id on channel_support_ticket_events (ticket_id);
create index ix_channel_support_ticket_events_user_id on channel_support_ticket_events (user_id);
create index ix_report_exports_requested_by on report_exports (requested_by);
create index ix_report_exports_scheduled_job_id on report_exports (scheduled_job_id);
create index ix_catalog_product_subcategories_tenant_id on catalog_product_subcategories (tenant_id);
create index ix_catalog_provider_contacts_tenant_id on catalog_provider_contacts (tenant_id);
create index ix_catalog_product_destinations_tenant_id on catalog_product_destinations (tenant_id);
create index ix_catalog_product_items_tenant_id on catalog_product_items (tenant_id);
create index ix_catalog_itineraries_tenant_id on catalog_itineraries (tenant_id);
create index ix_catalog_itinerary_days_tenant_id on catalog_itinerary_days (tenant_id);
create index ix_catalog_itinerary_items_tenant_id on catalog_itinerary_items (tenant_id);
create index ix_catalog_product_inclusions_tenant_id on catalog_product_inclusions (tenant_id);
create index ix_catalog_product_requirements_tenant_id on catalog_product_requirements (tenant_id);
create index ix_catalog_product_policies_tenant_id on catalog_product_policies (tenant_id);
create index ix_catalog_product_related_tenant_id on catalog_product_related (tenant_id);
create index ix_catalog_product_media_tenant_id on catalog_product_media (tenant_id);
create index ix_catalog_product_faqs_tenant_id on catalog_product_faqs (tenant_id);
create index ix_catalog_product_channels_tenant_id on catalog_product_channels (tenant_id);
create index ix_catalog_product_seasons_tenant_id on catalog_product_seasons (tenant_id);
create index ix_catalog_product_config_groups_tenant_id on catalog_product_config_groups (tenant_id);
create index ix_catalog_product_config_options_tenant_id on catalog_product_config_options (tenant_id);
create index ix_catalog_rate_conditions_tenant_id on catalog_rate_conditions (tenant_id);
create index ix_crm_lead_qualifications_tenant_id on crm_lead_qualifications (tenant_id);
create index ix_crm_client_contacts_tenant_id on crm_client_contacts (tenant_id);
create index ix_crm_case_events_tenant_id on crm_case_events (tenant_id);
create index ix_quote_items_tenant_id on quote_items (tenant_id);
create index ix_quote_access_tokens_tenant_id on quote_access_tokens (tenant_id);
create index ix_quote_views_tenant_id on quote_views (tenant_id);
create index ix_quote_negotiations_tenant_id on quote_negotiations (tenant_id);
create index ix_booking_passengers_tenant_id on booking_passengers (tenant_id);
create index ix_booking_cancellations_tenant_id on booking_cancellations (tenant_id);
create index ix_ops_order_tasks_tenant_id on ops_order_tasks (tenant_id);
create index ix_ops_assignment_checkins_tenant_id on ops_assignment_checkins (tenant_id);
create index ix_ops_rooming_guests_tenant_id on ops_rooming_guests (tenant_id);
create index ix_ops_voucher_versions_tenant_id on ops_voucher_versions (tenant_id);
create index ix_ops_incident_logs_tenant_id on ops_incident_logs (tenant_id);
create index ix_ops_evidences_tenant_id on ops_evidences (tenant_id);
create index ix_fin_receivable_reminders_tenant_id on fin_receivable_reminders (tenant_id);
create index ix_fin_payment_applications_tenant_id on fin_payment_applications (tenant_id);
create index ix_fin_commission_rules_tenant_id on fin_commission_rules (tenant_id);
create index ix_channel_support_ticket_events_tenant_id on channel_support_ticket_events (tenant_id);

-- ---------------------------------------------------------------- restricciones de exclusión y triggers específicos
create or replace function app_destinations_level_guard() returns trigger language plpgsql as $$
declare v_parent_level smallint;
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Un destino no puede ser su propio padre' using errcode = 'check_violation';
    end if;
    select level into v_parent_level from catalog_destinations where id = new.parent_id;
    if v_parent_level is not null and new.level <= v_parent_level then
      raise exception 'El nivel del destino (%) debe ser mayor que el del padre (%)', new.level, v_parent_level
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
create trigger trg_catalog_destinations_level_guard before insert or update of parent_id, level on catalog_destinations for each row execute function app_destinations_level_guard();
create or replace function app_product_versions_immutable() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'catalog_product_versions es inmutable' using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - 'status') <> (to_jsonb(old) - 'status') then
    raise exception 'catalog_product_versions es inmutable (solo cambia status)' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger trg_catalog_product_versions_immutable before update or delete on catalog_product_versions for each row execute function app_product_versions_immutable();
alter table catalog_seasons add constraint ex_catalog_seasons_overlap exclude using gist (tenant_id with =, priority with =, daterange(date_from, date_to, '[]') with &&) where (status = 'activa' and deleted_at is null);
alter table catalog_availability_ranges add constraint ex_avail_open exclude using gist (product_id with =, daterange(date_from, date_to, '[]') with &&) where (status = 'disponible' and deleted_at is null);
alter table catalog_availability_ranges add constraint ex_avail_closed exclude using gist (product_id with =, daterange(date_from, date_to, '[]') with &&) where (status in ('cerrado','agotado') and deleted_at is null);
create trigger trg_crm_case_events_append_only before update or delete on crm_case_events for each row execute function app_forbid_update_delete();
create or replace function app_quote_versions_frozen_guard() returns trigger language plpgsql as $$
begin
  if old.frozen_at is not null and (
       (to_jsonb(new) - array['status','lock_version','updated_at','updated_by','internal_approval_id','approval_request_id','pdf_document_id'])
    <> (to_jsonb(old) - array['status','lock_version','updated_at','updated_by','internal_approval_id','approval_request_id','pdf_document_id'])) then
    raise exception 'Versión congelada: solo puede cambiar status, aprobación interna y PDF' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger trg_quote_versions_frozen_guard before update on quote_versions for each row execute function app_quote_versions_frozen_guard();
create or replace function app_quote_items_frozen_guard() returns trigger language plpgsql as $$
declare v_frozen timestamptz;
begin
  select frozen_at into v_frozen from quote_versions where id = coalesce(new.quote_version_id, old.quote_version_id);
  if v_frozen is not null then
    raise exception 'La versión de cotización está congelada (frozen_at=%): no se pueden modificar sus ítems', v_frozen
      using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_quote_items_frozen_guard before insert or update or delete on quote_items for each row execute function app_quote_items_frozen_guard();
alter table ops_rooming_rooms add constraint ex_ops_rooming_rooms_overlap exclude using gist (tenant_id with =, hotel_provider_id with =, room_number with =, stay with &&);
alter table ops_rooming_guests add constraint ex_ops_rooming_guests_overlap exclude using gist (tenant_id with =, passenger_id with =, stay with &&);
create trigger trg_ops_incident_logs_append_only before update or delete on ops_incident_logs for each row execute function app_forbid_update_delete();
create trigger trg_fin_fx_rates_append_only before update or delete on fin_fx_rates for each row execute function app_forbid_update_delete();

-- ---------------------------------------------------------------- triggers de updated_at / lock_version
create trigger trg_catalog_product_types_updated_at before update on catalog_product_types for each row execute function app_set_updated_at();
create trigger trg_catalog_product_categories_updated_at before update on catalog_product_categories for each row execute function app_set_updated_at();
create trigger trg_catalog_product_subcategories_updated_at before update on catalog_product_subcategories for each row execute function app_set_updated_at();
create trigger trg_catalog_destinations_updated_at before update on catalog_destinations for each row execute function app_set_updated_at();
create trigger trg_catalog_providers_updated_at before update on catalog_providers for each row execute function app_set_updated_at();
create trigger trg_catalog_provider_contacts_updated_at before update on catalog_provider_contacts for each row execute function app_set_updated_at();
create trigger trg_catalog_services_updated_at before update on catalog_services for each row execute function app_set_updated_at();
create trigger trg_catalog_products_updated_at before update on catalog_products for each row execute function app_set_updated_at();
create trigger trg_catalog_products_lock_version before update on catalog_products for each row execute function app_bump_lock_version();
create trigger trg_catalog_product_destinations_updated_at before update on catalog_product_destinations for each row execute function app_set_updated_at();
create trigger trg_catalog_product_items_updated_at before update on catalog_product_items for each row execute function app_set_updated_at();
create trigger trg_catalog_itineraries_updated_at before update on catalog_itineraries for each row execute function app_set_updated_at();
create trigger trg_catalog_itinerary_days_updated_at before update on catalog_itinerary_days for each row execute function app_set_updated_at();
create trigger trg_catalog_itinerary_items_updated_at before update on catalog_itinerary_items for each row execute function app_set_updated_at();
create trigger trg_catalog_product_inclusions_updated_at before update on catalog_product_inclusions for each row execute function app_set_updated_at();
create trigger trg_catalog_product_requirements_updated_at before update on catalog_product_requirements for each row execute function app_set_updated_at();
create trigger trg_catalog_product_policies_updated_at before update on catalog_product_policies for each row execute function app_set_updated_at();
create trigger trg_catalog_product_related_updated_at before update on catalog_product_related for each row execute function app_set_updated_at();
create trigger trg_catalog_seasons_updated_at before update on catalog_seasons for each row execute function app_set_updated_at();
create trigger trg_catalog_product_promotions_updated_at before update on catalog_product_promotions for each row execute function app_set_updated_at();
create trigger trg_catalog_product_media_updated_at before update on catalog_product_media for each row execute function app_set_updated_at();
create trigger trg_catalog_product_faqs_updated_at before update on catalog_product_faqs for each row execute function app_set_updated_at();
create trigger trg_catalog_product_channels_updated_at before update on catalog_product_channels for each row execute function app_set_updated_at();
create trigger trg_catalog_product_seasons_updated_at before update on catalog_product_seasons for each row execute function app_set_updated_at();
create trigger trg_catalog_product_config_groups_updated_at before update on catalog_product_config_groups for each row execute function app_set_updated_at();
create trigger trg_catalog_product_config_options_updated_at before update on catalog_product_config_options for each row execute function app_set_updated_at();
create trigger trg_catalog_rates_updated_at before update on catalog_rates for each row execute function app_set_updated_at();
create trigger trg_catalog_rates_lock_version before update on catalog_rates for each row execute function app_bump_lock_version();
create trigger trg_catalog_rate_conditions_updated_at before update on catalog_rate_conditions for each row execute function app_set_updated_at();
create trigger trg_catalog_price_rules_updated_at before update on catalog_price_rules for each row execute function app_set_updated_at();
create trigger trg_catalog_product_departures_updated_at before update on catalog_product_departures for each row execute function app_set_updated_at();
create trigger trg_catalog_product_departures_lock_version before update on catalog_product_departures for each row execute function app_bump_lock_version();
create trigger trg_catalog_availability_holds_updated_at before update on catalog_availability_holds for each row execute function app_set_updated_at();
create trigger trg_catalog_availability_holds_lock_version before update on catalog_availability_holds for each row execute function app_bump_lock_version();
create trigger trg_catalog_availability_ranges_updated_at before update on catalog_availability_ranges for each row execute function app_set_updated_at();
create trigger trg_catalog_pax_rules_updated_at before update on catalog_pax_rules for each row execute function app_set_updated_at();
create trigger trg_crm_catalog_items_updated_at before update on crm_catalog_items for each row execute function app_set_updated_at();
create trigger trg_crm_clients_updated_at before update on crm_clients for each row execute function app_set_updated_at();
create trigger trg_crm_leads_updated_at before update on crm_leads for each row execute function app_set_updated_at();
create trigger trg_crm_leads_lock_version before update on crm_leads for each row execute function app_bump_lock_version();
create trigger trg_crm_lead_qualifications_updated_at before update on crm_lead_qualifications for each row execute function app_set_updated_at();
create trigger trg_crm_client_contacts_updated_at before update on crm_client_contacts for each row execute function app_set_updated_at();
create trigger trg_crm_pipeline_stages_updated_at before update on crm_pipeline_stages for each row execute function app_set_updated_at();
create trigger trg_crm_opportunities_updated_at before update on crm_opportunities for each row execute function app_set_updated_at();
create trigger trg_crm_opportunities_lock_version before update on crm_opportunities for each row execute function app_bump_lock_version();
create trigger trg_crm_activities_updated_at before update on crm_activities for each row execute function app_set_updated_at();
create trigger trg_crm_surveys_updated_at before update on crm_surveys for each row execute function app_set_updated_at();
create trigger trg_crm_cases_updated_at before update on crm_cases for each row execute function app_set_updated_at();
create trigger trg_crm_cases_lock_version before update on crm_cases for each row execute function app_bump_lock_version();
create trigger trg_crm_claim_book_settings_updated_at before update on crm_claim_book_settings for each row execute function app_set_updated_at();
create trigger trg_sys_holidays_updated_at before update on sys_holidays for each row execute function app_set_updated_at();
create trigger trg_quote_quotes_updated_at before update on quote_quotes for each row execute function app_set_updated_at();
create trigger trg_quote_quotes_lock_version before update on quote_quotes for each row execute function app_bump_lock_version();
create trigger trg_quote_versions_updated_at before update on quote_versions for each row execute function app_set_updated_at();
create trigger trg_quote_versions_lock_version before update on quote_versions for each row execute function app_bump_lock_version();
create trigger trg_quote_items_updated_at before update on quote_items for each row execute function app_set_updated_at();
create trigger trg_quote_internal_approvals_updated_at before update on quote_internal_approvals for each row execute function app_set_updated_at();
create trigger trg_booking_reservations_updated_at before update on booking_reservations for each row execute function app_set_updated_at();
create trigger trg_booking_reservations_lock_version before update on booking_reservations for each row execute function app_bump_lock_version();
create trigger trg_booking_passengers_updated_at before update on booking_passengers for each row execute function app_set_updated_at();
create trigger trg_booking_reservation_services_updated_at before update on booking_reservation_services for each row execute function app_set_updated_at();
create trigger trg_booking_reservation_services_lock_version before update on booking_reservation_services for each row execute function app_bump_lock_version();
create trigger trg_booking_inventory_holds_updated_at before update on booking_inventory_holds for each row execute function app_set_updated_at();
create trigger trg_booking_changes_updated_at before update on booking_changes for each row execute function app_set_updated_at();
create trigger trg_booking_cancel_requests_updated_at before update on booking_cancel_requests for each row execute function app_set_updated_at();
create trigger trg_booking_cancellations_updated_at before update on booking_cancellations for each row execute function app_set_updated_at();
create trigger trg_ops_guides_updated_at before update on ops_guides for each row execute function app_set_updated_at();
create trigger trg_ops_drivers_updated_at before update on ops_drivers for each row execute function app_set_updated_at();
create trigger trg_ops_vehicles_updated_at before update on ops_vehicles for each row execute function app_set_updated_at();
create trigger trg_ops_orders_updated_at before update on ops_orders for each row execute function app_set_updated_at();
create trigger trg_ops_orders_lock_version before update on ops_orders for each row execute function app_bump_lock_version();
create trigger trg_ops_order_tasks_updated_at before update on ops_order_tasks for each row execute function app_set_updated_at();
create trigger trg_ops_supplier_requests_updated_at before update on ops_supplier_requests for each row execute function app_set_updated_at();
create trigger trg_ops_assignments_updated_at before update on ops_assignments for each row execute function app_set_updated_at();
create trigger trg_ops_assignments_lock_version before update on ops_assignments for each row execute function app_bump_lock_version();
create trigger trg_ops_assignment_checkins_updated_at before update on ops_assignment_checkins for each row execute function app_set_updated_at();
create trigger trg_ops_rooming_lists_updated_at before update on ops_rooming_lists for each row execute function app_set_updated_at();
create trigger trg_ops_rooming_lists_lock_version before update on ops_rooming_lists for each row execute function app_bump_lock_version();
create trigger trg_ops_rooming_rooms_updated_at before update on ops_rooming_rooms for each row execute function app_set_updated_at();
create trigger trg_ops_rooming_guests_updated_at before update on ops_rooming_guests for each row execute function app_set_updated_at();
create trigger trg_ops_vouchers_updated_at before update on ops_vouchers for each row execute function app_set_updated_at();
create trigger trg_ops_vouchers_lock_version before update on ops_vouchers for each row execute function app_bump_lock_version();
create trigger trg_ops_incidents_updated_at before update on ops_incidents for each row execute function app_set_updated_at();
create trigger trg_ops_incidents_lock_version before update on ops_incidents for each row execute function app_bump_lock_version();
create trigger trg_ops_evidences_updated_at before update on ops_evidences for each row execute function app_set_updated_at();
create trigger trg_fin_bank_accounts_updated_at before update on fin_bank_accounts for each row execute function app_set_updated_at();
create trigger trg_fin_payment_methods_updated_at before update on fin_payment_methods for each row execute function app_set_updated_at();
create trigger trg_fin_receivables_updated_at before update on fin_receivables for each row execute function app_set_updated_at();
create trigger trg_fin_receivables_lock_version before update on fin_receivables for each row execute function app_bump_lock_version();
create trigger trg_fin_payments_updated_at before update on fin_payments for each row execute function app_set_updated_at();
create trigger trg_fin_payments_lock_version before update on fin_payments for each row execute function app_bump_lock_version();
create trigger trg_fin_payment_applications_updated_at before update on fin_payment_applications for each row execute function app_set_updated_at();
create trigger trg_fin_payables_updated_at before update on fin_payables for each row execute function app_set_updated_at();
create trigger trg_fin_payables_lock_version before update on fin_payables for each row execute function app_bump_lock_version();
create trigger trg_fin_payable_payouts_updated_at before update on fin_payable_payouts for each row execute function app_set_updated_at();
create trigger trg_fin_commission_rules_updated_at before update on fin_commission_rules for each row execute function app_set_updated_at();
create trigger trg_fin_commissions_updated_at before update on fin_commissions for each row execute function app_set_updated_at();
create trigger trg_fin_commissions_lock_version before update on fin_commissions for each row execute function app_bump_lock_version();
create trigger trg_fin_settlements_updated_at before update on fin_settlements for each row execute function app_set_updated_at();
create trigger trg_channel_support_tickets_updated_at before update on channel_support_tickets for each row execute function app_set_updated_at();

-- ---------------------------------------------------------------- comentarios (spec de origen)
comment on table catalog_product_types is '[Spec 02 §3.1] [Fase 1] Tipos de producto (TOUR, EXCURSIÓN, PAQUETE…).';
comment on table catalog_product_categories is '[Spec 02 §3.2] [Fase 1] Categorías de producto.';
comment on table catalog_product_subcategories is '[Spec 02 §3.2] [Fase 1] Subcategorías de producto.';
comment on table catalog_destinations is '[Spec 02 §3.3] [Fase 1] Árbol de destinos (País → Atracción/Ruta).';
comment on table catalog_providers is '[Spec 02 §3.4] [Fase 1] Proveedores (hoteles, transporte, guías…).';
comment on table catalog_provider_contacts is '[Spec 02 §3.4] [Fase 1] Contactos adicionales del proveedor.';
comment on table catalog_services is '[Spec 02 §3.5] [Fase 1] Servicios de proveedor (componentes de costo).';
comment on table catalog_products is '[Spec 02 §3.6 + 16 §3.3] [Fase 1] Ficha maestra de producto.';
comment on table catalog_product_versions is '[Spec 02 §3.7] [Fase 1] Versiones inmutables del producto (snapshot).';
comment on table catalog_product_destinations is '[Spec 02 §3.7] [Fase 1] Destinos secundarios del producto.';
comment on table catalog_product_items is '[Spec 02 §3.7] [Fase 1] Componentes del producto (servicio o producto; paquetes).';
comment on table catalog_itineraries is '[Spec 02 §3.7] [Fase 1] Itinerario del producto.';
comment on table catalog_itinerary_days is '[Spec 02 §3.7] [Fase 1] Días del itinerario.';
comment on table catalog_itinerary_items is '[Spec 02 §3.7] [Fase 1] Actividades por día del itinerario.';
comment on table catalog_product_inclusions is '[Spec 02 §3.7] [Fase 1] Incluye / no incluye.';
comment on table catalog_product_requirements is '[Spec 02 §3.7] [Fase 1] Requisitos del producto.';
comment on table catalog_product_policies is '[Spec 02 §3.7] [Fase 1] Políticas comerciales 1:1 con producto.';
comment on table catalog_product_related is '[Spec 02 §3.7] [Fase 1] Productos relacionados (cross-sell/upsell).';
comment on table catalog_seasons is '[Spec 02 §3.8] [Fase 1] Temporadas (factor de precio).';
comment on table catalog_product_promotions is '[Spec 02 §3.7 + 08 §3.9] [Fase 1] Promociones por producto (códigos promocionales).';
comment on table catalog_product_media is '[Spec 02 §3.7] [Fase 1] Galería del producto.';
comment on table catalog_product_faqs is '[Spec 02 §3.7] [Fase 1] Preguntas frecuentes del producto.';
comment on table catalog_product_channels is '[Spec 02 §3.7] [Fase 1] Publicación del producto por canal.';
comment on table catalog_product_seasons is '[Spec 02 §3.7] [Fase 1] Temporadas asociadas al producto.';
comment on table catalog_product_config_groups is '[Spec 02 §3.7] [Fase 1] Grupos de personalización del producto (§23).';
comment on table catalog_product_config_options is '[Spec 02 §3.7] [Fase 1] Opciones de personalización (delta de precio por pasajero).';
comment on table catalog_rates is '[Spec 02 §3.8] [Fase 1] Tarifas del producto por segmento/canal/vigencia.';
comment on table catalog_rate_conditions is '[Spec 02 §3.8] [Fase 1] Condiciones estructuradas de tarifa (propuesta; el prototipo no la usa).';
comment on table catalog_price_rules is '[Spec 02 §3.8] [Fase 1] Reglas de pricing a nivel tenant.';
comment on table catalog_product_departures is '[Spec 02 §3.9] [Fase 1] Salidas programadas (cupo por fecha/hora).';
comment on table catalog_availability_holds is '[Spec 02 §3.9 + 15 §3.13–3.14] [Fase 1] Retenciones de cupo (hold → confirmada/liberada/expirada/consumida).';
comment on table catalog_availability_ranges is '[Spec 16 §3.3] [Fase 1] Rangos de disponibilidad por producto (motor básico).';
comment on table catalog_pax_rules is '[Spec 16 §3.4] [Fase 1] Reglas de pasajeros por producto (edades, proporciones).';
comment on table crm_catalog_items is '[Spec 01 §3.1] [Fase 1] Catálogos configurables del CRM (fuentes, canales, motivos…).';
comment on table crm_clients is '[Spec 01 §3.4] [Fase 1] Clientes (personas y empresas).';
comment on table crm_leads is '[Spec 01 §3.2] [Fase 1] Leads comerciales.';
comment on table crm_lead_qualifications is '[Spec 01 §3.3] [Fase 1] Historial BANT del lead (vigente = último).';
comment on table crm_client_contacts is '[Spec 01 §3.5] [Fase 1] Contactos del cliente.';
comment on table crm_pipeline_stages is '[Spec 01 §3.6] [Fase 1] Etapas del embudo de oportunidades.';
comment on table crm_opportunities is '[Spec 01 §3.7] [Fase 1] Oportunidades de venta.';
comment on table crm_activities is '[Spec 01 §3.8] [Fase 1] Actividades comerciales (llamadas, reuniones, tareas…).';
comment on table crm_surveys is '[Spec 01 §3.9] [Fase 1] Encuestas NPS.';
comment on table crm_cases is '[Spec 01 §3.10 + 12 §3.10] [Fase 1] Casos de postventa y hojas del Libro de Reclamaciones (is_book).';
comment on table crm_case_events is '[Spec 01 §3.11 + 12 §3.10] [Fase 1] Bitácora del caso / hoja de reclamación (append-only).';
comment on table crm_claim_book_settings is '[Spec 12 §3.11] [Fase 1] Parámetros del Libro de Reclamaciones (1 fila por tenant).';
comment on table sys_holidays is '[Spec 12 §3.11] [Fase 1] Feriados (tenant NULL = nacionales) para plazos hábiles.';
comment on table quote_quotes is '[Spec 03 §3] [Fase 1] Cotización (cabecera).';
comment on table quote_versions is '[Spec 03 §3] [Fase 1] Versiones de cotización (congeladas al enviar).';
comment on table quote_items is '[Spec 03 §3] [Fase 1] Ítems de la versión (producto, tarifa, fecha, pax).';
comment on table quote_internal_approvals is '[Spec 03 §3] [Fase 1] Solicitud y decisión de aprobación interna (gerencia).';
comment on table quote_sends is '[Spec 03 §3] [Fase 1] Envíos de la cotización por canal.';
comment on table quote_access_tokens is '[Spec 03 §3] [Fase 1] Tokens (hash) del enlace público de la cotización.';
comment on table quote_views is '[Spec 03 §3] [Fase 1] Aperturas de la cotización (portal o registro manual).';
comment on table quote_negotiations is '[Spec 03 §3] [Fase 1] Registro de negociación con el cliente.';
comment on table quote_approvals is '[Spec 08 §3.15] [Fase 1] Evidencia de aprobación del cliente desde el portal.';
comment on table booking_reservations is '[Spec 04 §3] [Fase 1] Reserva.';
comment on table booking_passengers is '[Spec 04 §3 (+ v2.1)] [Fase 1] Pasajeros de la reserva.';
comment on table booking_reservation_services is '[Spec 04 §3 + 05 §3.3 + 08 §3.15] [Fase 1] Servicios de la reserva (estado de proveedor y operativo).';
comment on table booking_inventory_holds is '[Spec 04 §3] [Fase 1] Cupos retenidos por la reserva en salidas.';
comment on table booking_changes is '[Spec 04 §3] [Fase 1] Modificaciones y reprogramaciones de la reserva.';
comment on table booking_cancel_requests is '[Spec 04 §3 + 10 §3.11] [Fase 1] Solicitudes de anulación de reserva.';
comment on table booking_cancellations is '[Spec 04 §3] [Fase 1] Resultado de la cancelación (penalidad, reembolso).';
comment on table ops_guides is '[Spec 05 §3.7] [Fase 1] Guías (recurso operativo).';
comment on table ops_drivers is '[Spec 05 §3.7] [Fase 1] Conductores (recurso operativo).';
comment on table ops_vehicles is '[Spec 05 §3.7] [Fase 1] Vehículos.';
comment on table ops_orders is '[Spec 05 §3.1] [Fase 1] Orden operativa (una por reserva).';
comment on table ops_order_tasks is '[Spec 05 §3.2] [Fase 1] Checklist de la orden operativa.';
comment on table ops_supplier_requests is '[Spec 05 §3.4] [Fase 1] Solicitudes enviadas a proveedores por servicio (PROC-032).';
comment on table ops_assignments is '[Spec 05 §3.5] [Fase 1] Asignación de guía/conductor/vehículo por servicio.';
comment on table ops_assignment_checkins is '[Spec 05 §3.6] [Fase 1] Check-in por pasajero y servicio (idempotente).';
comment on table ops_rooming_lists is '[Spec 05 §3.8 + §3.14b] [Fase 1] Rooming list por reserva y hotel/ciudad.';
comment on table ops_rooming_rooms is '[Spec 05 §3.9] [Fase 1] Habitaciones de la rooming list.';
comment on table ops_rooming_guests is '[Spec 05 §3.9] [Fase 1] Huéspedes por habitación.';
comment on table ops_vouchers is '[Spec 05 §3.10] [Fase 1] Vouchers de servicio (versionados, QR firmado).';
comment on table ops_voucher_versions is '[Spec 05 §3.10] [Fase 1] Historial de versiones del voucher.';
comment on table ops_incidents is '[Spec 05 §3.11] [Fase 1] Incidencias operativas (SLA por severidad).';
comment on table ops_incident_logs is '[Spec 05 §3.11 + 06 §3] [Fase 1] Bitácora append-only de la incidencia.';
comment on table ops_evidences is '[Spec 05 §3.12] [Fase 1] Evidencias (fotos/PDF) de operación e incidencias (PROC-038).';
comment on table fin_bank_accounts is '[Spec 07 §3.8] [Fase 1] Cuentas bancarias para pagos a proveedores.';
comment on table fin_payment_methods is '[Spec 07 §3.9] [Fase 1] Medios de cobro configurables (PAY_METHODS).';
comment on table fin_receivables is '[Spec 07 §3.1] [Fase 1] Cuentas por cobrar (obligaciones de cobro).';
comment on table fin_receivable_reminders is '[Spec 07 §3.2] [Fase 1] Recordatorios de cobro enviados.';
comment on table fin_payments is '[Spec 07 §3.3 + 08 §3.15] [Fase 1] Pagos recibidos y reembolsos.';
comment on table fin_payment_applications is '[Spec 07 §3.4] [Fase 1] Aplicación / desaplicación de pagos a CxC.';
comment on table fin_status_history is '[Spec 07 §3.5] [Fase 1] Historial de estados de pagos, comisiones, comprobantes y CxP.';
comment on table fin_payables is '[Spec 07 §3.6] [Fase 1] Cuentas por pagar a proveedores y costos adicionales.';
comment on table fin_payable_payouts is '[Spec 07 §3.7] [Fase 1] Pagos a proveedores.';
comment on table fin_commission_rules is '[Spec 07 §3.10] [Fase 1] Reglas de comisión (vendedor / agencia B2B).';
comment on table fin_commissions is '[Spec 07 §3.11 + 14 §3.17] [Fase 1] Comisiones calculadas (vendedor, agencia B2B, bono por meta).';
comment on table fin_settlements is '[Spec 07 §3.12] [Fase 1] Liquidación / cierre financiero de la reserva.';
comment on table fin_fx_rates is '[Spec 07 §3.19 + 09 §3.9 + 17 §3.6] [Fase 1] Histórico de tipo de cambio (append-only).';
comment on table channel_support_tickets is '[Spec 08 §3.12] [Fase 1] Solicitudes desde portal cliente / pasajero.';
comment on table channel_support_ticket_events is '[Spec 08 §3.12] [Fase 1] Bitácora del ticket (log).';
comment on table report_exports is '[Spec 09 §3.16] [Fase 1] Exportaciones de reportes (PROC-061).';

