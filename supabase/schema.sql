-- =========================================================
-- Quizzy Lite: ฐานข้อมูล
-- วิธีใช้: คัดลอกทั้งไฟล์ไปวางใน Supabase > SQL Editor แล้วกด Run
-- รันซ้ำได้ (ไม่ลบข้อมูลเดิม) ทุกครั้งที่อัปเดตโค้ดให้รันไฟล์นี้ใหม่
--
-- หลักความปลอดภัย:
-- 1) เปิด RLS ทุกตารางและไม่สร้าง policy = หน้าเว็บอ่าน/เขียนตารางตรงไม่ได้
-- 2) ทุกอย่างทำผ่านฟังก์ชัน api_* ซึ่งเรียกได้จาก Edge Function (service_role) เท่านั้น
-- 3) Edge Function ตรวจ LINE ID token ก่อน แล้วส่ง line_user_id ที่ยืนยันแล้วมาให้
-- =========================================================

-- ---------- ตาราง ----------

create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  line_user_id  text not null unique,
  display_name  text,
  picture_url   text,
  full_name     text,
  student_code  text,
  role          text not null default 'student' check (role in ('student', 'teacher')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- รหัสนักเรียนห้ามซ้ำกัน
create unique index if not exists profiles_student_code_key on public.profiles (student_code) where student_code is not null;

create table if not exists public.exams (
  id                uuid primary key default gen_random_uuid(),
  title             text not null check (length(trim(title)) between 1 and 200),
  description       text not null default '',
  duration_minutes  int  not null check (duration_minutes between 1 and 300),
  pass_percent      int  not null default 50 check (pass_percent between 0 and 100),
  open_at           timestamptz,
  close_at          timestamptz,
  is_published      boolean not null default false,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (open_at is null or close_at is null or close_at > open_at)
);

create table if not exists public.questions (
  id              uuid primary key default gen_random_uuid(),
  exam_id         uuid not null references public.exams (id) on delete cascade,
  order_no        int  not null,
  question_text   text not null check (length(trim(question_text)) between 1 and 2000),
  option_a        text not null check (length(trim(option_a)) between 1 and 500),
  option_b        text not null check (length(trim(option_b)) between 1 and 500),
  option_c        text check (option_c is null or length(trim(option_c)) between 1 and 500),
  option_d        text check (option_d is null or length(trim(option_d)) between 1 and 500),
  correct_answer  char(1) not null check (correct_answer in ('A', 'B', 'C', 'D')),
  points          int  not null default 1 check (points between 1 and 100),
  explanation     text,
  created_at      timestamptz not null default now(),
  -- ต้องมีตัวเลือก C ก่อนจึงมี D ได้ และเฉลยต้องชี้ไปที่ตัวเลือกที่มีอยู่จริง
  check (option_d is null or option_c is not null),
  check (correct_answer in ('A', 'B') or (correct_answer = 'C' and option_c is not null) or (correct_answer = 'D' and option_d is not null))
);
create index if not exists questions_exam_idx on public.questions (exam_id, order_no);

create table if not exists public.attempts (
  id             uuid primary key default gen_random_uuid(),
  exam_id        uuid not null references public.exams (id) on delete cascade,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  started_at     timestamptz not null default now(),
  deadline_at    timestamptz not null,
  submitted_at   timestamptz,
  answers        jsonb not null default '{}'::jsonb,
  score          int,
  max_score      int,
  correct_count  int,
  is_late        boolean not null default false,
  unique (exam_id, profile_id)   -- สอบได้ครั้งเดียว และกันส่งซ้ำ
);
create index if not exists attempts_profile_idx on public.attempts (profile_id);

-- updated_at อัปเดตอัตโนมัติ
create or replace function public.qz_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles for each row execute function public.qz_touch();
drop trigger if exists exams_touch on public.exams;
create trigger exams_touch before update on public.exams for each row execute function public.qz_touch();

-- ---------- ปิดการเข้าถึงตารางโดยตรง ----------
alter table public.profiles  enable row level security;
alter table public.exams     enable row level security;
alter table public.questions enable row level security;
alter table public.attempts  enable row level security;
revoke all on public.profiles, public.exams, public.questions, public.attempts from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.exams, public.questions, public.attempts to service_role;

-- =========================================================
-- ฟังก์ชันช่วย (ใช้ภายใน)
-- =========================================================

-- หาโปรไฟล์จาก line_user_id (ต้องเรียก api_me ก่อนเสมอ)
create or replace function public.qz_profile(p_line_user_id text)
returns public.profiles language plpgsql stable set search_path = public as $$
declare r public.profiles;
begin
  select * into r from profiles where line_user_id = p_line_user_id;
  if not found then raise exception 'ไม่พบบัญชีผู้ใช้ กรุณาเปิดแอปใหม่อีกครั้ง'; end if;
  return r;
end $$;

-- ต้องเป็นครู
create or replace function public.qz_teacher(p_line_user_id text)
returns public.profiles language plpgsql stable set search_path = public as $$
declare r public.profiles;
begin
  r := qz_profile(p_line_user_id);
  if r.role <> 'teacher' then raise exception 'หน้านี้สำหรับครูเท่านั้น'; end if;
  return r;
end $$;

-- ข้อมูลโปรไฟล์ที่ส่งกลับไปหน้าเว็บ (ไม่ส่ง line_user_id)
create or replace function public.qz_profile_json(r public.profiles)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'id', r.id, 'display_name', r.display_name, 'picture_url', r.picture_url,
    'full_name', r.full_name, 'student_code', r.student_code, 'role', r.role,
    'registered', r.full_name is not null, 'created_at', r.created_at)
$$;

-- =========================================================
-- API: ผู้ใช้
-- =========================================================

-- เปิดแอปทุกครั้ง: สร้างโปรไฟล์ถ้ายังไม่มี และอัปเดตชื่อ/รูปจาก LINE
create or replace function public.api_me(p_line_user_id text, p_display_name text, p_picture_url text)
returns jsonb language plpgsql set search_path = public as $$
declare r profiles;
begin
  insert into profiles (line_user_id, display_name, picture_url)
  values (p_line_user_id, left(p_display_name, 200), left(p_picture_url, 1000))
  on conflict (line_user_id) do update
    set display_name = excluded.display_name, picture_url = excluded.picture_url
  returning * into r;
  return qz_profile_json(r);
end $$;

-- ลงทะเบียนครั้งแรก (ทำได้ครั้งเดียว ถ้าต้องแก้ ให้ครูแก้ใน Table Editor)
create or replace function public.api_register(p_line_user_id text, p_full_name text, p_student_code text)
returns jsonb language plpgsql set search_path = public as $$
declare
  r profiles;
  v_name text := trim(coalesce(p_full_name, ''));
  v_code text := nullif(trim(coalesce(p_student_code, '')), '');
begin
  r := qz_profile(p_line_user_id);
  if r.full_name is not null then raise exception 'ลงทะเบียนไว้แล้ว ถ้าต้องการแก้ไขข้อมูลให้แจ้งครู'; end if;
  if length(v_name) < 2 or length(v_name) > 100 then raise exception 'กรุณากรอกชื่อ-นามสกุล (2–100 ตัวอักษร)'; end if;
  if r.role = 'student' and v_code is null then raise exception 'กรุณากรอกรหัสนักเรียน'; end if;
  if v_code is not null and length(v_code) > 30 then raise exception 'รหัสนักเรียนยาวเกินไป'; end if;
  if v_code is not null and exists (select 1 from profiles where student_code = v_code and id <> r.id) then
    raise exception 'รหัสนักเรียนนี้ถูกใช้แล้ว ถ้าเป็นรหัสของคุณจริงให้แจ้งครู';
  end if;

  update profiles set full_name = v_name, student_code = v_code where id = r.id returning * into r;
  return qz_profile_json(r);
end $$;

-- =========================================================
-- สิทธิ์: ฟังก์ชัน api_* และ qz_* เรียกได้เฉพาะ service_role (Edge Function)
-- =========================================================
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and (p.proname like 'api\_%' or p.proname like 'qz\_%')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
