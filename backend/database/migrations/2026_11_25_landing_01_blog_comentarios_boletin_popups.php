<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::unprepared(<<<'SQL'
            alter table platform_blog_posts
                add column if not exists site varchar(12) not null default 'rutaslibres' check (site in ('kipucontrol', 'rutaslibres')),
                add column if not exists category varchar(40) check (category is null or category ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
                add column if not exists title_accent varchar(120),
                add column if not exists author_name varchar(80),
                add column if not exists author_role varchar(120),
                add column if not exists featured boolean not null default false,
                add column if not exists allow_comments boolean not null default true,
                add column if not exists faq jsonb not null default '[]'::jsonb check (jsonb_typeof(faq) = 'array'),
                add column if not exists reads integer not null default 0 check (reads >= 0),
                add column if not exists useful_yes integer not null default 0 check (useful_yes >= 0),
                add column if not exists useful_no integer not null default 0 check (useful_no >= 0);

            alter table platform_blog_posts drop constraint if exists ck_platform_blog_posts_1;
            alter table platform_blog_posts add constraint ck_platform_blog_posts_1 check (status <> 'publicado' or (published_at is not null and (site <> 'rutaslibres' or word_count >= 800)));
            create index if not exists ix_platform_blog_posts_site on platform_blog_posts (site, status, published_at desc);

            comment on column platform_blog_posts.site is '[Spec 25 §3] Sitio del artículo: kipucontrol (blog de la landing) o rutaslibres (vitrina). Reemplaza el campo site de Payload.';
            comment on column platform_blog_posts.category is '[Spec 25 §3] Categoría del blog de KipuControl: ventas, marketing-seo, operaciones, finanzas o ia.';
            comment on column platform_blog_posts.faq is '[Spec 25 §2] Preguntas frecuentes del artículo como [{q, a}], publicadas también como FAQPage.';
            comment on column platform_blog_posts.reads is '[Spec 25 §2] Lecturas contadas una vez por visitante y día.';

            create table platform_blog_comments (
                id uuid not null default app_uuid_v7(),
                code varchar(12) not null,
                post_id uuid not null references platform_blog_posts (id) on delete cascade,
                parent_id uuid references platform_blog_comments (id) on delete cascade,
                name varchar(80) not null,
                email text,
                email_hash char(64),
                body varchar(1500) not null check (char_length(body) >= 10),
                status varchar(10) not null default 'pendiente' check (status in ('pendiente', 'aprobado', 'rechazado', 'spam')),
                useful integer not null default 0 check (useful >= 0),
                staff boolean not null default false,
                staff_user_id uuid references platform_users (id),
                ip_hash char(64),
                user_agent varchar(240),
                consent_at timestamptz,
                moderated_by uuid references platform_users (id),
                moderated_at timestamptz,
                previous_status varchar(10),
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_platform_blog_comments primary key (id),
                constraint uq_platform_blog_comments_code unique (code),
                constraint ck_platform_blog_comments_1 check (staff or (email_hash is not null and consent_at is not null))
            );
            create index ix_platform_blog_comments_post on platform_blog_comments (post_id, status, created_at);
            create index ix_platform_blog_comments_status on platform_blog_comments (status, created_at desc);
            create index ix_platform_blog_comments_email_hash on platform_blog_comments (email_hash, status);
            create index ix_platform_blog_comments_ip_hash on platform_blog_comments (ip_hash, created_at desc);
            create trigger trg_platform_blog_comments_updated_at before update on platform_blog_comments for each row execute function app_set_updated_at();
            comment on table platform_blog_comments is '[Spec 25 §3 comments] Comentarios moderados del blog de KipuControl (LND-11 y LND-12). El correo solo lo ve la moderación; ip_hash es SHA-256 con sal diaria.';

            create table platform_blog_votes (
                id uuid not null default app_uuid_v7(),
                target varchar(8) not null check (target in ('post', 'comment')),
                target_id uuid not null,
                visitor_hash char(64) not null,
                value smallint not null default 1 check (value in (-1, 1)),
                created_at timestamptz not null default now(),
                constraint pk_platform_blog_votes primary key (id),
                constraint uq_platform_blog_votes unique (target, target_id, visitor_hash)
            );
            comment on table platform_blog_votes is '[Spec 25 LND-12] «Útil» de artículos y comentarios: un voto por visitante (hash diario).';

            create table platform_newsletter_subscribers (
                id uuid not null default app_uuid_v7(),
                email text not null,
                email_hash char(64) not null,
                site varchar(12) not null default 'kipucontrol' check (site in ('kipucontrol', 'rutaslibres')),
                source varchar(16) not null check (source in ('pie', 'blog', 'scroll_60', 'popup_salida', 'chatbot')),
                status varchar(10) not null default 'pendiente' check (status in ('pendiente', 'confirmado', 'baja')),
                token_hash char(64) not null,
                consent_text varchar(300) not null,
                ip_hash char(64),
                confirmation_sent_at timestamptz,
                confirmed_at timestamptz,
                unsubscribed_at timestamptz,
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_platform_newsletter_subscribers primary key (id),
                constraint uq_platform_newsletter_subscribers unique (site, email_hash),
                constraint uq_platform_newsletter_subscribers_token unique (token_hash),
                constraint ck_platform_newsletter_subscribers_1 check (status <> 'confirmado' or confirmed_at is not null),
                constraint ck_platform_newsletter_subscribers_2 check (status <> 'baja' or unsubscribed_at is not null)
            );
            create index ix_platform_newsletter_subscribers_status on platform_newsletter_subscribers (site, status, created_at desc);
            create trigger trg_platform_newsletter_subscribers_updated_at before update on platform_newsletter_subscribers for each row execute function app_set_updated_at();
            comment on table platform_newsletter_subscribers is '[Spec 25 §3 subscribers] Boletín de KipuControl con doble confirmación y baja en 1 clic (LND-14).';

            create table platform_landing_popups (
                id uuid not null default app_uuid_v7(),
                code varchar(12) not null,
                name varchar(80) not null,
                trigger varchar(12) not null check (trigger in ('salida', 'scroll_60', 'tiempo_30s')),
                kind varchar(10) not null default 'enlace' check (kind in ('prueba', 'boletin', 'enlace')),
                pages text[] not null default '{}',
                freq_days smallint not null default 7 check (freq_days between 1 and 90),
                status varchar(10) not null default 'borrador' check (status in ('borrador', 'activo', 'pausado')),
                eyebrow varchar(40),
                title varchar(90) not null,
                body varchar(280) not null,
                cta_label varchar(40) not null,
                cta_href varchar(200) check (cta_href is null or cta_href ~ '^/'),
                views integer not null default 0 check (views >= 0),
                conversions integer not null default 0 check (conversions >= 0),
                created_by uuid references platform_users (id),
                updated_by uuid references platform_users (id),
                created_at timestamptz not null default now(),
                updated_at timestamptz not null default now(),
                constraint pk_platform_landing_popups primary key (id),
                constraint uq_platform_landing_popups_code unique (code),
                constraint ck_platform_landing_popups_1 check (kind <> 'enlace' or cta_href is not null)
            );
            create trigger trg_platform_landing_popups_updated_at before update on platform_landing_popups for each row execute function app_set_updated_at();
            comment on table platform_landing_popups is '[Spec 25 §3 popups] Popups de captación de la landing (LND-13): uno por visita, frecuencia en días, nunca en el alta.';

            alter table platform_blog_comments disable row level security;
            alter table platform_blog_votes disable row level security;
            alter table platform_newsletter_subscribers disable row level security;
            alter table platform_landing_popups disable row level security;
            revoke all on platform_blog_comments, platform_blog_votes, platform_newsletter_subscribers, platform_landing_popups from app_role;
            grant select, insert, update, delete on platform_blog_comments, platform_blog_votes, platform_newsletter_subscribers, platform_landing_popups to platform_role;
            SQL);
    }

    public function down(): void
    {
        DB::unprepared(<<<'SQL'
            drop table if exists platform_landing_popups;
            drop table if exists platform_newsletter_subscribers;
            drop table if exists platform_blog_votes;
            drop table if exists platform_blog_comments;
            alter table platform_blog_posts drop constraint if exists ck_platform_blog_posts_1;
            delete from platform_blog_posts where site = 'kipucontrol';
            alter table platform_blog_posts add constraint ck_platform_blog_posts_1 check (status <> 'publicado' or (published_at is not null and word_count >= 800));
            drop index if exists ix_platform_blog_posts_site;
            alter table platform_blog_posts
                drop column if exists site, drop column if exists category, drop column if exists title_accent, drop column if exists author_name,
                drop column if exists author_role, drop column if exists featured, drop column if exists allow_comments, drop column if exists faq,
                drop column if exists reads, drop column if exists useful_yes, drop column if exists useful_no;
            SQL);
    }
};
