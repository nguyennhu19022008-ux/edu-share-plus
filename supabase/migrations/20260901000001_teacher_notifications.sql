-- =============================================================================
-- Migration: 20260901000001_teacher_notifications.sql
-- Description: Automated in-app notification triggers and RPCs for school teachers
-- =============================================================================

-- 1. Function to notify school teachers when a new student registers needing review
CREATE OR REPLACE FUNCTION public.notify_school_staff_on_student_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  staff_record RECORD;
BEGIN
  -- Only trigger for newly registered accounts waiting for review
  IF (TG_OP = 'INSERT' AND NEW.account_status = 'pending_review') OR
     (TG_OP = 'UPDATE' AND OLD.account_status IS DISTINCT FROM 'pending_review' AND NEW.account_status = 'pending_review') THEN
    
    -- Find all staff members in the same school
    FOR staff_record IN
      SELECT ur.user_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.school_id = NEW.school_id
        AND r.code IN ('teacher_moderator', 'school_admin', 'admin', 'system_admin')
    LOOP
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        link_target,
        metadata
      ) VALUES (
        staff_record.user_id,
        'student_registration',
        '📋 Yêu cầu duyệt tài khoản học sinh mới',
        COALESCE(NEW.full_name, 'Một học sinh') || ' vừa đăng ký tài khoản cần đối chiếu danh sách.',
        '/?page=admin',
        jsonb_build_object(
          'student_user_id', NEW.user_id,
          'student_name', NEW.full_name,
          'school_id', NEW.school_id,
          'class_id', NEW.class_id,
          'event', 'student_signup'
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_school_staff_on_student_signup ON public.profiles;
CREATE TRIGGER trg_notify_school_staff_on_student_signup
AFTER INSERT OR UPDATE OF account_status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_school_staff_on_student_signup();


-- 2. Function to notify school teachers when a new marketplace post is published
CREATE OR REPLACE FUNCTION public.notify_school_staff_on_post_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  staff_record RECORD;
  author_name TEXT;
  school_id_val UUID;
BEGIN
  -- Get author info and school
  SELECT full_name, school_id INTO author_name, school_id_val
  FROM public.profiles
  WHERE user_id = NEW.author_id;

  IF school_id_val IS NOT NULL THEN
    FOR staff_record IN
      SELECT ur.user_id
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.school_id = school_id_val
        AND r.code IN ('teacher_moderator', 'school_admin', 'admin', 'system_admin')
    LOOP
      INSERT INTO public.notifications (
        user_id,
        type,
        title,
        body,
        link_target,
        metadata
      ) VALUES (
        staff_record.user_id,
        'post_created',
        '📦 Đồ dùng học tập mới đăng trên Chợ',
        COALESCE(author_name, 'Học sinh') || ' vừa đăng: "' || COALESCE(NEW.title, 'Đồ dùng học tập') || '".',
        '/?page=admin',
        jsonb_build_object(
          'post_id', NEW.id,
          'author_id', NEW.author_id,
          'title', NEW.title,
          'trade_type', NEW.trade_type,
          'school_id', school_id_val,
          'event', 'post_created'
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_school_staff_on_post_created ON public.posts;
CREATE TRIGGER trg_notify_school_staff_on_post_created
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.notify_school_staff_on_post_created();


-- 3. RPC to list staff notifications
CREATE OR REPLACE FUNCTION public.list_school_staff_notifications(
  p_limit INTEGER DEFAULT 30
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_items JSONB;
  v_unread_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('items', '[]'::jsonb, 'unread_count', 0);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(n)), '[]'::jsonb)
  INTO v_items
  FROM (
    SELECT 
      id,
      type,
      title,
      body,
      link_target,
      metadata,
      created_at,
      read_at
    FROM public.notifications
    WHERE user_id = v_user_id
      AND type IN ('student_registration', 'post_created', 'post_reported', 'staff_alert')
    ORDER BY created_at DESC
    LIMIT LEAST(p_limit, 100)
  ) n;

  SELECT COUNT(*)::INTEGER
  INTO v_unread_count
  FROM public.notifications
  WHERE user_id = v_user_id
    AND type IN ('student_registration', 'post_created', 'post_reported', 'staff_alert')
    AND read_at IS NULL;

  RETURN jsonb_build_object(
    'items', v_items,
    'unread_count', v_unread_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_school_staff_notifications(INTEGER) TO authenticated;
