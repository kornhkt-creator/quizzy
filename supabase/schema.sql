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
  line_user_id  text not null unique,   -- LINE user ID หรือ "auth:<id>" สำหรับครูที่ login ด้วยอีเมล
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

-- แต้มสะสมของนักเรียน: คิดจากข้อมูลจริงทุกครั้ง (ไม่มีตารางแต้มแยก)
--   เช็คชื่อ: มา 10 แต้ม, สาย 5 แต้ม · ข้อสอบ: เท่ากับคะแนนที่ได้
-- ครูแก้สถานะเช็คชื่อหรือลบคาบ/ชุดสอบ แต้มจะเปลี่ยนตามเอง
-- (เป็น plpgsql เพราะตาราง att_records ถูกสร้างทีหลังในไฟล์นี้)
create or replace function public.qz_points(p_profile_id uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_checkin int; v_exam int;
begin
  select coalesce(sum(case status when 'present' then 10 when 'late' then 5 else 0 end), 0) into v_checkin
  from att_records where profile_id = p_profile_id;
  select coalesce(sum(score), 0) into v_exam
  from attempts where profile_id = p_profile_id and submitted_at is not null;
  return jsonb_build_object('total', v_checkin + v_exam, 'checkin', v_checkin, 'exam', v_exam);
end $$;

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
  return qz_profile_json(r) || jsonb_build_object('points', qz_points(r.id));
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
  return qz_profile_json(r) || jsonb_build_object('points', qz_points(r.id));
end $$;

-- =========================================================
-- API: ครูจัดการชุดสอบ (Phase 2)
-- =========================================================

-- แปลงข้อความเป็นตัวเลข/เวลา ถ้าแปลงไม่ได้คืน null
create or replace function public.qz_int(v text) returns int language plpgsql immutable as $$
begin return v::int; exception when others then return null; end $$;
create or replace function public.qz_ts(v text) returns timestamptz language plpgsql stable as $$
begin return nullif(v, '')::timestamptz; exception when others then return null; end $$;
create or replace function public.qz_uuid(v text) returns uuid language plpgsql immutable as $$
begin return nullif(v, '')::uuid; exception when others then return null; end $$;

-- มีนักเรียนเริ่มสอบแล้วหรือยัง (ถ้าเริ่มแล้ว ห้ามแก้ข้อสอบ)
create or replace function public.qz_exam_locked(p_exam_id uuid)
returns boolean language sql stable set search_path = public as $$
  select exists (select 1 from attempts where exam_id = p_exam_id)
$$;

-- สถานะชุดสอบ: draft = ยังไม่เผยแพร่, scheduled = ยังไม่ถึงเวลาเปิด, open = เปิดอยู่, closed = ปิดแล้ว
create or replace function public.qz_exam_status(e public.exams)
returns text language sql stable as $$
  select case
    when not e.is_published then 'draft'
    when e.open_at is not null and now() < e.open_at then 'scheduled'
    when e.close_at is not null and now() >= e.close_at then 'closed'
    else 'open' end
$$;

-- ชุดสอบพร้อมข้อสอบและเฉลย (สำหรับครูเท่านั้น)
create or replace function public.qz_exam_full_json(p_exam_id uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', e.id, 'title', e.title, 'description', e.description,
    'duration_minutes', e.duration_minutes, 'pass_percent', e.pass_percent,
    'open_at', e.open_at, 'close_at', e.close_at, 'is_published', e.is_published,
    'status', qz_exam_status(e), 'locked', qz_exam_locked(e.id),
    'created_at', e.created_at, 'updated_at', e.updated_at,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'order_no', q.order_no, 'question_text', q.question_text,
        'option_a', q.option_a, 'option_b', q.option_b, 'option_c', q.option_c, 'option_d', q.option_d,
        'correct_answer', q.correct_answer, 'points', q.points, 'explanation', q.explanation
      ) order by q.order_no)
      from questions q where q.exam_id = e.id), '[]'::jsonb))
  from exams e where e.id = p_exam_id
$$;

create or replace function public.api_teacher_list_exams(p_line_user_id text)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_students int;
begin
  perform qz_teacher(p_line_user_id);
  select count(*) into v_students from profiles where role = 'student' and full_name is not null;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'title', e.title, 'description', e.description,
      'duration_minutes', e.duration_minutes, 'pass_percent', e.pass_percent,
      'open_at', e.open_at, 'close_at', e.close_at, 'is_published', e.is_published,
      'status', qz_exam_status(e), 'created_at', e.created_at,
      'question_count', (select count(*) from questions q where q.exam_id = e.id),
      'max_score', (select coalesce(sum(q.points), 0) from questions q where q.exam_id = e.id),
      'started_count', (select count(*) from attempts a where a.exam_id = e.id),
      'submitted_count', (select count(*) from attempts a where a.exam_id = e.id and a.submitted_at is not null),
      'student_count', v_students
    ) order by e.created_at desc)
    from exams e), '[]'::jsonb);
end $$;

create or replace function public.api_get_exam(p_line_user_id text, p_exam_id uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare r jsonb;
begin
  perform qz_teacher(p_line_user_id);
  r := qz_exam_full_json(p_exam_id);
  if r is null then raise exception 'ไม่พบชุดสอบนี้'; end if;
  return r;
end $$;

-- สร้าง (ไม่มี id) หรือแก้ไข (มี id) ข้อมูลชุดสอบ
create or replace function public.api_save_exam(p_line_user_id text, p_exam jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  t profiles;
  e exams;
  v_id    uuid := qz_uuid(p_exam->>'id');
  v_title text := trim(coalesce(p_exam->>'title', ''));
  v_desc  text := trim(coalesce(p_exam->>'description', ''));
  v_dur   int  := qz_int(p_exam->>'duration_minutes');
  v_pass  int  := coalesce(qz_int(nullif(p_exam->>'pass_percent', '')), 50);
  v_open  timestamptz := qz_ts(p_exam->>'open_at');
  v_close timestamptz := qz_ts(p_exam->>'close_at');
begin
  t := qz_teacher(p_line_user_id);
  if v_title = '' then raise exception 'กรุณาตั้งชื่อชุดสอบ'; end if;
  if length(v_title) > 200 then raise exception 'ชื่อชุดสอบยาวเกิน 200 ตัวอักษร'; end if;
  if length(v_desc) > 2000 then raise exception 'คำอธิบายยาวเกิน 2000 ตัวอักษร'; end if;
  if v_dur is null or v_dur not between 1 and 300 then raise exception 'เวลาทำข้อสอบต้องอยู่ระหว่าง 1–300 นาที'; end if;
  if v_pass not between 0 and 100 then raise exception 'เกณฑ์ผ่านต้องอยู่ระหว่าง 0–100%%'; end if;
  if coalesce(p_exam->>'open_at', '') <> '' and v_open is null then raise exception 'รูปแบบเวลาเปิดสอบไม่ถูกต้อง'; end if;
  if coalesce(p_exam->>'close_at', '') <> '' and v_close is null then raise exception 'รูปแบบเวลาปิดสอบไม่ถูกต้อง'; end if;
  if v_open is not null and v_close is not null and v_close <= v_open then raise exception 'เวลาปิดสอบต้องอยู่หลังเวลาเปิดสอบ'; end if;

  if v_id is null then
    insert into exams (title, description, duration_minutes, pass_percent, open_at, close_at, created_by)
    values (v_title, v_desc, v_dur, v_pass, v_open, v_close, t.id)
    returning * into e;
  else
    select * into e from exams where id = v_id for update;
    if not found then raise exception 'ไม่พบชุดสอบนี้'; end if;
    if qz_exam_locked(v_id) and v_dur <> e.duration_minutes then
      raise exception 'มีนักเรียนเริ่มสอบแล้ว เปลี่ยนเวลาทำข้อสอบไม่ได้';
    end if;
    update exams set title = v_title, description = v_desc, duration_minutes = v_dur,
      pass_percent = v_pass, open_at = v_open, close_at = v_close
    where id = v_id returning * into e;
  end if;
  return qz_exam_full_json(e.id);
end $$;

-- บันทึกข้อสอบ: mode 'replace' = แทนที่ทั้งชุด, 'append' = ต่อท้าย (ใช้ตอนนำเข้า Excel)
-- ถ้าข้อใดผิด จะไม่บันทึกเลยสักข้อ (ทั้งคำสั่งยกเลิกทั้งหมด)
create or replace function public.api_save_questions(p_line_user_id text, p_exam_id uuid, p_questions jsonb, p_mode text default 'replace')
returns jsonb language plpgsql set search_path = public as $$
declare
  e exams;
  q jsonb;
  i int := 0;
  v_start int := 0;
  v_count int;
  v_text text; a text; b text; c text; d text; v_ans text; v_pts int; v_exp text;
begin
  perform qz_teacher(p_line_user_id);
  select * into e from exams where id = p_exam_id for update;
  if not found then raise exception 'ไม่พบชุดสอบนี้'; end if;
  if qz_exam_locked(p_exam_id) then raise exception 'มีนักเรียนเริ่มสอบชุดนี้แล้ว แก้ไขหรือเพิ่มข้อสอบไม่ได้'; end if;
  if jsonb_typeof(p_questions) is distinct from 'array' then raise exception 'ข้อมูลข้อสอบไม่ถูกต้อง'; end if;
  if p_mode not in ('replace', 'append') then raise exception 'ข้อมูลไม่ถูกต้อง'; end if;

  if p_mode = 'replace' then
    delete from questions where exam_id = p_exam_id;
  else
    select coalesce(max(order_no), 0) into v_start from questions where exam_id = p_exam_id;
  end if;

  for q in select * from jsonb_array_elements(p_questions) loop
    i := i + 1;
    v_text := trim(coalesce(q->>'question_text', ''));
    a := nullif(trim(coalesce(q->>'option_a', '')), '');
    b := nullif(trim(coalesce(q->>'option_b', '')), '');
    c := nullif(trim(coalesce(q->>'option_c', '')), '');
    d := nullif(trim(coalesce(q->>'option_d', '')), '');
    v_ans := translate(upper(trim(coalesce(q->>'correct_answer', ''))), 'กขคง', 'ABCD');
    v_exp := nullif(trim(coalesce(q->>'explanation', '')), '');
    v_pts := case when coalesce(q->>'points', '') = '' then 1 else qz_int(q->>'points') end;

    if v_text = '' then raise exception 'ข้อ %: กรุณากรอกคำถาม', i; end if;
    if length(v_text) > 2000 then raise exception 'ข้อ %: คำถามยาวเกิน 2000 ตัวอักษร', i; end if;
    if a is null or b is null then raise exception 'ข้อ %: ต้องมีตัวเลือก A และ B เป็นอย่างน้อย', i; end if;
    if d is not null and c is null then raise exception 'ข้อ %: มีตัวเลือก D แต่ไม่มีตัวเลือก C', i; end if;
    if greatest(length(a), length(b), length(coalesce(c, '')), length(coalesce(d, ''))) > 500 then
      raise exception 'ข้อ %: ตัวเลือกยาวเกิน 500 ตัวอักษร', i;
    end if;
    if v_ans not in ('A', 'B', 'C', 'D') then raise exception 'ข้อ %: เฉลยต้องเป็น A, B, C หรือ D', i; end if;
    if (v_ans = 'C' and c is null) or (v_ans = 'D' and d is null) then raise exception 'ข้อ %: เฉลยชี้ไปที่ตัวเลือกที่ว่าง', i; end if;
    if v_pts is null or v_pts not between 1 and 100 then raise exception 'ข้อ %: คะแนนต้องเป็นตัวเลข 1–100', i; end if;

    insert into questions (exam_id, order_no, question_text, option_a, option_b, option_c, option_d, correct_answer, points, explanation)
    values (p_exam_id, v_start + i, v_text, a, b, c, d, v_ans, v_pts, v_exp);
  end loop;

  select count(*) into v_count from questions where exam_id = p_exam_id;
  if v_count > 200 then raise exception 'ชุดสอบหนึ่งชุดมีได้ไม่เกิน 200 ข้อ'; end if;
  if v_count = 0 and e.is_published then raise exception 'ชุดสอบที่เผยแพร่แล้วต้องมีอย่างน้อย 1 ข้อ'; end if;
  update exams set updated_at = now() where id = p_exam_id;
  return qz_exam_full_json(p_exam_id);
end $$;

create or replace function public.api_set_published(p_line_user_id text, p_exam_id uuid, p_publish boolean)
returns jsonb language plpgsql set search_path = public as $$
begin
  perform qz_teacher(p_line_user_id);
  if not exists (select 1 from exams where id = p_exam_id) then raise exception 'ไม่พบชุดสอบนี้'; end if;
  if p_publish and not exists (select 1 from questions where exam_id = p_exam_id) then
    raise exception 'เพิ่มข้อสอบอย่างน้อย 1 ข้อก่อนเผยแพร่';
  end if;
  update exams set is_published = coalesce(p_publish, false) where id = p_exam_id;
  return qz_exam_full_json(p_exam_id);
end $$;

-- ลบชุดสอบ (ข้อสอบและผลสอบของชุดนี้จะถูกลบด้วย)
create or replace function public.api_delete_exam(p_line_user_id text, p_exam_id uuid)
returns jsonb language plpgsql set search_path = public as $$
begin
  perform qz_teacher(p_line_user_id);
  delete from exams where id = p_exam_id;
  if not found then raise exception 'ไม่พบชุดสอบนี้'; end if;
  return jsonb_build_object('deleted', true);
end $$;

-- =========================================================
-- API: นักเรียนทำข้อสอบ (Phase 3)
-- =========================================================

-- ต้องลงทะเบียนแล้ว
create or replace function public.qz_student(p_line_user_id text)
returns public.profiles language plpgsql stable set search_path = public as $$
declare r public.profiles;
begin
  r := qz_profile(p_line_user_id);
  if r.full_name is null then raise exception 'กรุณาลงทะเบียนก่อนเข้าสอบ'; end if;
  return r;
end $$;

-- สรุปผลสอบของ attempt หนึ่งครั้ง
create or replace function public.qz_attempt_json(a public.attempts, e public.exams)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'status', case when a.submitted_at is null then 'in_progress' else 'submitted' end,
    'started_at', a.started_at, 'deadline_at', a.deadline_at, 'submitted_at', a.submitted_at,
    'score', a.score, 'max_score', a.max_score, 'correct_count', a.correct_count,
    'question_count', (select count(*) from questions q where q.exam_id = e.id),
    'percent', case when a.submitted_at is null then null
                    when coalesce(a.max_score, 0) = 0 then 0
                    else round(a.score * 100.0 / a.max_score) end,
    'passed', case when a.submitted_at is null then null
                   else coalesce(a.score * 100.0 / nullif(a.max_score, 0), 0) >= e.pass_percent end,
    'is_late', a.is_late,
    'exam_title', e.title, 'exam_id', e.id, 'pass_percent', e.pass_percent)
$$;

-- รายการชุดสอบที่นักเรียนเห็น: เผยแพร่แล้วและยังไม่ปิด + ชุดที่เคยเริ่มสอบแล้ว
create or replace function public.api_list_exams(p_line_user_id text)
returns jsonb language plpgsql stable set search_path = public as $$
declare p profiles;
begin
  p := qz_student(p_line_user_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'title', e.title, 'description', e.description,
      'duration_minutes', e.duration_minutes, 'pass_percent', e.pass_percent,
      'open_at', e.open_at, 'close_at', e.close_at, 'status', qz_exam_status(e),
      'question_count', (select count(*) from questions q where q.exam_id = e.id),
      'max_score', (select coalesce(sum(q.points), 0) from questions q where q.exam_id = e.id),
      'attempt', case when a.id is null then null else qz_attempt_json(a, e) end
    ) order by e.created_at desc)
    from exams e
    left join attempts a on a.exam_id = e.id and a.profile_id = p.id
    where a.id is not null
       or (e.is_published and qz_exam_status(e) in ('open', 'scheduled')
           and exists (select 1 from questions q where q.exam_id = e.id))
  ), '[]'::jsonb);
end $$;

-- ข้อสอบสำหรับนักเรียน: ไม่มีเฉลยและคำอธิบายเฉลย
create or replace function public.qz_exam_paper(a public.attempts, e public.exams)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'status', 'in_progress',
    'exam', jsonb_build_object('id', e.id, 'title', e.title, 'duration_minutes', e.duration_minutes, 'pass_percent', e.pass_percent),
    'started_at', a.started_at, 'deadline_at', a.deadline_at, 'server_now', now(),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id, 'order_no', q.order_no, 'question_text', q.question_text, 'points', q.points,
        'options', (select jsonb_agg(jsonb_build_object('key', o.k, 'text', o.t) order by o.k)
                    from (values ('A', q.option_a), ('B', q.option_b), ('C', q.option_c), ('D', q.option_d)) o(k, t)
                    where o.t is not null)
      ) order by q.order_no)
      from questions q where q.exam_id = e.id), '[]'::jsonb))
$$;

-- เริ่มสอบ (หรือกลับมาทำต่อ) เวลาเริ่มและเวลาสิ้นสุดใช้เวลาของ server
create or replace function public.api_start_exam(p_line_user_id text, p_exam_id uuid)
returns jsonb language plpgsql set search_path = public as $$
declare p profiles; e exams; a attempts; v_status text;
begin
  p := qz_student(p_line_user_id);
  select * into e from exams where id = p_exam_id;
  if not found then raise exception 'ไม่พบชุดสอบนี้'; end if;

  select * into a from attempts where exam_id = e.id and profile_id = p.id;
  if found then
    if a.submitted_at is not null then
      return jsonb_build_object('status', 'submitted', 'result', qz_attempt_json(a, e));
    end if;
    return qz_exam_paper(a, e); -- กลับมาทำต่อ เวลายังเดินตามเดิม
  end if;

  v_status := qz_exam_status(e);
  if v_status = 'draft' then raise exception 'ชุดสอบนี้ยังไม่เปิดให้สอบ'; end if;
  if v_status = 'scheduled' then raise exception 'ยังไม่ถึงเวลาเปิดสอบ'; end if;
  if v_status = 'closed' then raise exception 'ชุดสอบนี้ปิดรับคำตอบแล้ว'; end if;
  if not exists (select 1 from questions where exam_id = e.id) then raise exception 'ชุดสอบนี้ยังไม่มีข้อสอบ'; end if;

  insert into attempts (exam_id, profile_id, started_at, deadline_at)
  values (e.id, p.id, now(), least(now() + make_interval(mins => e.duration_minutes), coalesce(e.close_at, 'infinity')))
  on conflict (exam_id, profile_id) do nothing;   -- กดเริ่มซ้อนกัน 2 ครั้ง ได้ attempt เดียว
  select * into a from attempts where exam_id = e.id and profile_id = p.id;
  return qz_exam_paper(a, e);
end $$;

-- ส่งคำตอบและตรวจคะแนนที่ server
-- ส่งซ้ำได้ผลเดิม (ไม่ตรวจใหม่) / ส่งช้ากว่าเวลาเกิน 60 วินาที ยังบันทึกแต่ทำเครื่องหมาย is_late
create or replace function public.api_submit_exam(p_line_user_id text, p_exam_id uuid, p_answers jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  p profiles; e exams; a attempts;
  v_answers jsonb := case when jsonb_typeof(p_answers) = 'object' then p_answers else '{}'::jsonb end;
  v_clean jsonb; v_score int; v_max int; v_correct int;
begin
  p := qz_student(p_line_user_id);
  select * into e from exams where id = p_exam_id;
  if not found then raise exception 'ไม่พบชุดสอบนี้'; end if;
  select * into a from attempts where exam_id = e.id and profile_id = p.id for update;
  if not found then raise exception 'ยังไม่ได้เริ่มสอบชุดนี้'; end if;
  if a.submitted_at is not null then
    return jsonb_build_object('status', 'submitted', 'result', qz_attempt_json(a, e), 'points', qz_points(p.id));
  end if;

  -- เก็บเฉพาะคำตอบของข้อในชุดนี้ และเป็นตัวเลือกที่มีอยู่จริง
  select coalesce(jsonb_object_agg(q.id::text, ans), '{}'::jsonb) into v_clean
  from questions q
  cross join lateral (select upper(v_answers->>q.id::text) as ans) x
  where q.exam_id = e.id
    and (x.ans in ('A', 'B') or (x.ans = 'C' and q.option_c is not null) or (x.ans = 'D' and q.option_d is not null));

  select coalesce(sum(q.points) filter (where v_clean->>q.id::text = q.correct_answer), 0),
         coalesce(sum(q.points), 0),
         count(*) filter (where v_clean->>q.id::text = q.correct_answer)
    into v_score, v_max, v_correct
  from questions q where q.exam_id = e.id;

  update attempts set
    submitted_at = now(), answers = v_clean, score = v_score, max_score = v_max,
    correct_count = v_correct, is_late = now() > a.deadline_at + interval '60 seconds'
  where id = a.id returning * into a;
  return jsonb_build_object('status', 'submitted', 'result', qz_attempt_json(a, e), 'points', qz_points(p.id));
end $$;

-- =========================================================
-- API: ครูดูผลสอบ (Phase 4)
-- =========================================================

-- ผลสอบทั้งชุด: สรุป + รายคน (นักเรียนที่ลงทะเบียนทุกคน) + วิเคราะห์รายข้อ
create or replace function public.api_exam_results(p_line_user_id text, p_exam_id uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare e exams; v_rows jsonb; v_summary jsonb; v_questions jsonb;
begin
  perform qz_teacher(p_line_user_id);
  select * into e from exams where id = p_exam_id;
  if not found then raise exception 'ไม่พบชุดสอบนี้'; end if;

  -- รายคน: นักเรียนที่ลงทะเบียนแล้วทุกคน + ทุกคนที่เคยเริ่มสอบชุดนี้
  select coalesce(jsonb_agg(jsonb_build_object(
      'student_code', p.student_code, 'full_name', p.full_name, 'display_name', p.display_name,
      'status', case
        when a.id is null then 'not_started'
        when a.submitted_at is not null then 'submitted'
        when now() > a.deadline_at + interval '60 seconds' then 'expired'
        else 'in_progress' end,
      'score', a.score, 'max_score', a.max_score, 'correct_count', a.correct_count,
      'percent', case when a.submitted_at is null then null when coalesce(a.max_score, 0) = 0 then 0 else round(a.score * 100.0 / a.max_score) end,
      'passed', case when a.submitted_at is null then null else coalesce(a.score * 100.0 / nullif(a.max_score, 0), 0) >= e.pass_percent end,
      'started_at', a.started_at, 'submitted_at', a.submitted_at, 'is_late', coalesce(a.is_late, false)
    ) order by p.student_code nulls last, p.full_name), '[]'::jsonb)
  into v_rows
  from profiles p
  left join attempts a on a.profile_id = p.id and a.exam_id = e.id
  where (p.role = 'student' and p.full_name is not null) or a.id is not null;

  select jsonb_build_object(
      'student_count', jsonb_array_length(v_rows),
      'started_count', count(a.id),
      'submitted_count', count(a.submitted_at),
      'avg_score', round(avg(a.score) filter (where a.submitted_at is not null), 1),
      'max_score_got', max(a.score) filter (where a.submitted_at is not null),
      'min_score_got', min(a.score) filter (where a.submitted_at is not null),
      'avg_percent', round(avg(a.score * 100.0 / nullif(a.max_score, 0)) filter (where a.submitted_at is not null)),
      'pass_count', count(*) filter (where a.submitted_at is not null and coalesce(a.score * 100.0 / nullif(a.max_score, 0), 0) >= e.pass_percent),
      'late_count', count(*) filter (where a.is_late))
  into v_summary
  from attempts a where a.exam_id = e.id;

  -- รายข้อ: คนที่ส่งแล้วตอบถูก/ผิดกี่คน และเลือกตัวเลือกไหนบ้าง (ไม่ตอบ = ผิด)
  select coalesce(jsonb_agg(jsonb_build_object(
      'order_no', q.order_no, 'question_text', q.question_text, 'correct_answer', q.correct_answer, 'points', q.points,
      'option_a', q.option_a, 'option_b', q.option_b, 'option_c', q.option_c, 'option_d', q.option_d,
      'submitted', s.n, 'correct', s.correct,
      'wrong_percent', case when s.n = 0 then 0 else round((s.n - s.correct) * 100.0 / s.n) end,
      'choices', jsonb_build_object('A', s.ca, 'B', s.cb, 'C', s.cc, 'D', s.cd, 'none', s.n - s.ca - s.cb - s.cc - s.cd)
    ) order by q.order_no), '[]'::jsonb)
  into v_questions
  from questions q
  cross join lateral (
    select count(*) as n,
           count(*) filter (where a.answers->>q.id::text = q.correct_answer) as correct,
           count(*) filter (where a.answers->>q.id::text = 'A') as ca,
           count(*) filter (where a.answers->>q.id::text = 'B') as cb,
           count(*) filter (where a.answers->>q.id::text = 'C') as cc,
           count(*) filter (where a.answers->>q.id::text = 'D') as cd
    from attempts a where a.exam_id = e.id and a.submitted_at is not null
  ) s
  where q.exam_id = e.id;

  return jsonb_build_object(
    'exam', jsonb_build_object(
      'id', e.id, 'title', e.title, 'duration_minutes', e.duration_minutes, 'pass_percent', e.pass_percent,
      'open_at', e.open_at, 'close_at', e.close_at, 'status', qz_exam_status(e),
      'question_count', jsonb_array_length(v_questions),
      'max_score', (select coalesce(sum(points), 0) from questions where exam_id = e.id)),
    'summary', v_summary, 'rows', v_rows, 'questions', v_questions);
end $$;

-- =========================================================
-- เช็คชื่อเข้าเรียน (Phase 5)
-- ครูเปิดคาบ → ระบบสุ่มรหัส 4 หลักขึ้นจอ → นักเรียนกรอกรหัสในแอปภายในเวลาที่กำหนด
-- =========================================================

create table if not exists public.att_sessions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (length(trim(title)) between 1 and 200),
  code        text not null check (code ~ '^[0-9]{4}$'),
  opens_at    timestamptz not null default now(),
  late_at     timestamptz not null,   -- เช็คหลังเวลานี้ = สาย (เท่ากับ closes_at = ไม่นับสาย)
  closes_at   timestamptz not null,   -- หลังเวลานี้เช็คเองไม่ได้ คนที่ไม่ได้เช็ค = ขาด
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (late_at >= opens_at and late_at <= closes_at and closes_at > opens_at)
);
create index if not exists att_sessions_code_idx on public.att_sessions (code, closes_at);

create table if not exists public.att_records (
  session_id  uuid not null references public.att_sessions (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  status      text not null check (status in ('present', 'late', 'absent', 'leave')),
  checked_at  timestamptz,                     -- เวลาที่นักเรียนเช็คเอง (null = ครูบันทึกให้)
  edited      boolean not null default false,  -- ครูแก้สถานะเอง
  updated_at  timestamptz not null default now(),
  primary key (session_id, profile_id)
);
create index if not exists att_records_profile_idx on public.att_records (profile_id);

-- รหัสผิด: เก็บไว้กันการสุ่มรหัส (ผิดเกิน 5 ครั้งใน 10 นาที ต้องรอ)
create table if not exists public.att_failures (
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  at          timestamptz not null default now()
);
create index if not exists att_failures_idx on public.att_failures (profile_id, at);

alter table public.att_sessions enable row level security;
alter table public.att_records  enable row level security;
alter table public.att_failures enable row level security;
revoke all on public.att_sessions, public.att_records, public.att_failures from anon, authenticated;
grant select, insert, update, delete on public.att_sessions, public.att_records, public.att_failures to service_role;

-- รายชื่อของคาบหนึ่ง: นักเรียนที่ลงทะเบียนก่อนคาบปิด + ทุกคนที่มีบันทึกในคาบนี้
-- status: present มา / late สาย / absent ขาด / leave ลา / pending ยังไม่เช็ค (คาบยังเปิดอยู่)
create or replace function public.qz_att_roster(p_session_id uuid)
returns table (profile_id uuid, student_code text, full_name text, display_name text, status text, checked_at timestamptz, edited boolean)
language sql stable set search_path = public as $$
  select p.id, p.student_code, p.full_name, p.display_name,
         coalesce(r.status, case when now() < s.closes_at then 'pending' else 'absent' end),
         r.checked_at, coalesce(r.edited, false)
  from att_sessions s
  join profiles p on (p.role = 'student' and p.full_name is not null and p.created_at <= s.closes_at)
                  or exists (select 1 from att_records x where x.session_id = s.id and x.profile_id = p.id)
  left join att_records r on r.session_id = s.id and r.profile_id = p.id
  where s.id = p_session_id
$$;

create or replace function public.qz_att_json(s public.att_sessions)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', s.id, 'title', s.title, 'code', s.code,
    'opens_at', s.opens_at, 'late_at', s.late_at, 'closes_at', s.closes_at,
    'status', case when now() < s.closes_at then 'open' else 'closed' end,
    'server_now', now(),
    'counts', (select jsonb_build_object(
        'total', count(*),
        'present', count(*) filter (where r.status = 'present'),
        'late', count(*) filter (where r.status = 'late'),
        'absent', count(*) filter (where r.status = 'absent'),
        'leave', count(*) filter (where r.status = 'leave'),
        'pending', count(*) filter (where r.status = 'pending'))
      from qz_att_roster(s.id) r))
$$;

create or replace function public.qz_att_detail(p_session_id uuid)
returns jsonb language plpgsql stable set search_path = public as $$
declare s att_sessions;
begin
  select * into s from att_sessions where id = p_session_id;
  if not found then raise exception 'ไม่พบคาบเช็คชื่อนี้'; end if;
  return qz_att_json(s) || jsonb_build_object('rows', coalesce((
    select jsonb_agg(jsonb_build_object(
      'profile_id', r.profile_id, 'student_code', r.student_code, 'full_name', r.full_name,
      'display_name', r.display_name, 'status', r.status, 'checked_at', r.checked_at, 'edited', r.edited
    ) order by r.student_code nulls last, r.full_name)
    from qz_att_roster(s.id) r), '[]'::jsonb));
end $$;

-- ครูเปิดคาบเช็คชื่อ: { title, minutes (เปิดกี่นาที), late_minutes (เกินกี่นาทีนับว่าสาย, ว่าง = ไม่นับสาย) }
create or replace function public.api_att_open(p_line_user_id text, p_session jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  t profiles;
  s att_sessions;
  v_title text := trim(coalesce(p_session->>'title', ''));
  v_min   int  := coalesce(qz_int(nullif(p_session->>'minutes', '')), 15);
  v_late  int  := qz_int(nullif(p_session->>'late_minutes', ''));
  v_code  text;
  i int := 0;
begin
  t := qz_teacher(p_line_user_id);
  if v_title = '' then v_title := 'เช็คชื่อ ' || to_char(now() at time zone 'Asia/Bangkok', 'DD/MM/YYYY HH24:MI'); end if;
  if length(v_title) > 200 then raise exception 'ชื่อคาบยาวเกิน 200 ตัวอักษร'; end if;
  if v_min not between 1 and 240 then raise exception 'เวลาเปิดเช็คชื่อต้องอยู่ระหว่าง 1–240 นาที'; end if;
  if coalesce(p_session->>'late_minutes', '') <> '' and (v_late is null or v_late < 0) then
    raise exception 'เวลานับสายต้องเป็นตัวเลข 0 ขึ้นไป';
  end if;

  -- สุ่มรหัสที่ไม่ซ้ำกับคาบที่ยังเปิดอยู่
  loop
    i := i + 1;
    v_code := lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from att_sessions where code = v_code and closes_at > now());
    if i > 50 then raise exception 'เปิดคาบพร้อมกันมากเกินไป ปิดคาบเก่าก่อนแล้วลองใหม่'; end if;
  end loop;

  insert into att_sessions (title, code, opens_at, late_at, closes_at, created_by)
  values (v_title, v_code, now(),
          now() + make_interval(mins => least(coalesce(v_late, v_min), v_min)),
          now() + make_interval(mins => v_min), t.id)
  returning * into s;
  return qz_att_detail(s.id);
end $$;

create or replace function public.api_att_list(p_line_user_id text)
returns jsonb language plpgsql stable set search_path = public as $$
begin
  perform qz_teacher(p_line_user_id);
  return coalesce((select jsonb_agg(qz_att_json(s) order by s.opens_at desc) from att_sessions s), '[]'::jsonb);
end $$;

create or replace function public.api_att_detail(p_line_user_id text, p_session_id uuid)
returns jsonb language plpgsql stable set search_path = public as $$
begin
  perform qz_teacher(p_line_user_id);
  return qz_att_detail(p_session_id);
end $$;

-- ครูแก้สถานะรายคน: present / late / absent / leave หรือ none = ลบบันทึก (กลับเป็นยังไม่เช็ค/ขาด)
create or replace function public.api_att_set(p_line_user_id text, p_session_id uuid, p_profile_id uuid, p_status text)
returns jsonb language plpgsql set search_path = public as $$
begin
  perform qz_teacher(p_line_user_id);
  if not exists (select 1 from att_sessions where id = p_session_id) then raise exception 'ไม่พบคาบเช็คชื่อนี้'; end if;
  if not exists (select 1 from profiles where id = p_profile_id and role = 'student') then raise exception 'ไม่พบนักเรียนคนนี้'; end if;
  if p_status = 'none' then
    delete from att_records where session_id = p_session_id and profile_id = p_profile_id;
  elsif p_status in ('present', 'late', 'absent', 'leave') then
    insert into att_records (session_id, profile_id, status, edited)
    values (p_session_id, p_profile_id, p_status, true)
    on conflict (session_id, profile_id) do update set status = excluded.status, edited = true, updated_at = now();
  else
    raise exception 'สถานะไม่ถูกต้อง';
  end if;
  return qz_att_detail(p_session_id);
end $$;

-- ปิดคาบทันที (คนที่ยังไม่เช็ค = ขาด)
create or replace function public.api_att_close(p_line_user_id text, p_session_id uuid)
returns jsonb language plpgsql set search_path = public as $$
declare v_end timestamptz;
begin
  perform qz_teacher(p_line_user_id);
  select greatest(now(), opens_at + interval '1 second') into v_end from att_sessions where id = p_session_id;
  if not found then raise exception 'ไม่พบคาบเช็คชื่อนี้'; end if;
  update att_sessions set closes_at = least(closes_at, v_end), late_at = least(late_at, v_end) where id = p_session_id;
  return qz_att_detail(p_session_id);
end $$;

create or replace function public.api_att_delete(p_line_user_id text, p_session_id uuid)
returns jsonb language plpgsql set search_path = public as $$
begin
  perform qz_teacher(p_line_user_id);
  delete from att_sessions where id = p_session_id;
  if not found then raise exception 'ไม่พบคาบเช็คชื่อนี้'; end if;
  return jsonb_build_object('deleted', true);
end $$;

-- นักเรียนกรอกรหัส
-- ผลลัพธ์ result: ok = เช็คสำเร็จ, already = เคยเช็คแล้ว, wrong_code = รหัสไม่ถูก (ไม่ raise เพื่อให้บันทึกครั้งที่ผิดไว้ได้)
create or replace function public.api_att_checkin(p_line_user_id text, p_code text)
returns jsonb language plpgsql set search_path = public as $$
declare
  p profiles; s att_sessions; r att_records; v_fails int;
  v_code text := regexp_replace(translate(coalesce(p_code, ''), '๐๑๒๓๔๕๖๗๘๙', '0123456789'), '[^0-9]', '', 'g');
begin
  p := qz_student(p_line_user_id);
  if p.role <> 'student' then raise exception 'เช็คชื่อได้เฉพาะบัญชีนักเรียน'; end if;
  delete from att_failures where profile_id = p.id and at < now() - interval '10 minutes';
  select count(*) into v_fails from att_failures where profile_id = p.id;
  if v_fails >= 5 then raise exception 'ใส่รหัสผิดหลายครั้ง รอ 10 นาทีแล้วลองใหม่ หรือแจ้งครู'; end if;
  if length(v_code) <> 4 then raise exception 'รหัสเช็คชื่อมี 4 หลัก'; end if;

  select * into s from att_sessions
  where code = v_code and opens_at <= now() and closes_at > now()
  order by opens_at desc limit 1;

  if not found then
    if exists (select 1 from att_sessions where code = v_code and closes_at <= now() and closes_at > now() - interval '3 hours') then
      raise exception 'หมดเวลาเช็คชื่อคาบนี้แล้ว แจ้งครูได้เลย';
    end if;
    insert into att_failures (profile_id) values (p.id);
    return jsonb_build_object('result', 'wrong_code', 'attempts_left', 4 - v_fails);
  end if;

  select * into r from att_records where session_id = s.id and profile_id = p.id;
  if found then
    return jsonb_build_object('result', 'already', 'status', r.status, 'checked_at', r.checked_at, 'title', s.title);
  end if;

  insert into att_records (session_id, profile_id, status, checked_at)
  values (s.id, p.id, case when now() > s.late_at then 'late' else 'present' end, now())
  on conflict (session_id, profile_id) do nothing
  returning * into r;
  if r.session_id is null then   -- กดซ้อนกันสองครั้ง
    select * into r from att_records where session_id = s.id and profile_id = p.id;
    return jsonb_build_object('result', 'already', 'status', r.status, 'checked_at', r.checked_at, 'title', s.title);
  end if;
  return jsonb_build_object('result', 'ok', 'status', r.status, 'checked_at', r.checked_at, 'title', s.title,
    'earned', case r.status when 'present' then 10 when 'late' then 5 else 0 end, 'points', qz_points(p.id));
end $$;

-- ประวัติการเข้าเรียนของนักเรียน
create or replace function public.api_att_history(p_line_user_id text)
returns jsonb language plpgsql stable set search_path = public as $$
declare p profiles; v_rows jsonb;
begin
  p := qz_student(p_line_user_id);
  select coalesce(jsonb_agg(x.j order by x.opens_at desc), '[]'::jsonb) into v_rows
  from (
    select s.opens_at, jsonb_build_object(
      'id', s.id, 'title', s.title, 'opens_at', s.opens_at, 'closes_at', s.closes_at,
      'session_status', case when now() < s.closes_at then 'open' else 'closed' end,
      'status', r.status, 'checked_at', r.checked_at) as j
    from att_sessions s
    cross join lateral (select * from qz_att_roster(s.id) q where q.profile_id = p.id) r
    order by s.opens_at desc
    limit 200
  ) x;
  return jsonb_build_object(
    'rows', v_rows,
    'summary', (select jsonb_build_object(
        'present', count(*) filter (where e->>'status' = 'present'),
        'late', count(*) filter (where e->>'status' = 'late'),
        'absent', count(*) filter (where e->>'status' = 'absent'),
        'leave', count(*) filter (where e->>'status' = 'leave'))
      from jsonb_array_elements(v_rows) e));
end $$;

-- ข้อมูลสรุปทุกคาบ (ใช้ทำตาราง Excel นักเรียน × คาบ)
create or replace function public.api_att_report(p_line_user_id text)
returns jsonb language plpgsql stable set search_path = public as $$
begin
  perform qz_teacher(p_line_user_id);
  return jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'title', s.title, 'opens_at', s.opens_at) order by s.opens_at)
                          from att_sessions s), '[]'::jsonb),
    'students', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'student_code', p.student_code, 'full_name', coalesce(p.full_name, p.display_name))
                                           order by p.student_code nulls last, p.full_name)
                          from profiles p
                          where (p.role = 'student' and p.full_name is not null)
                             or exists (select 1 from att_records r where r.profile_id = p.id)), '[]'::jsonb),
    'cells', coalesce((select jsonb_agg(jsonb_build_object('session_id', s.id, 'profile_id', r.profile_id, 'status', r.status))
                       from att_sessions s cross join lateral qz_att_roster(s.id) r), '[]'::jsonb));
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
