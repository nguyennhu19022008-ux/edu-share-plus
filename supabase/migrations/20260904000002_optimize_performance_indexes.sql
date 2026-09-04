-- Performance Index Optimization Migration for EduShare+
-- Creates compound indexes to speed up filtering, pagination and sorting.

-- 1. Posts table compound indexes
CREATE INDEX IF NOT EXISTS idx_posts_school_status_created 
  ON public.posts(school_id, moderation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_category_status 
  ON public.posts(category_id, moderation_status);

CREATE INDEX IF NOT EXISTS idx_posts_owner_lifecycle 
  ON public.posts(owner_id, lifecycle_status, created_at DESC);

-- 2. Post Media sorting index
CREATE INDEX IF NOT EXISTS idx_post_media_post_sort 
  ON public.post_media(post_id, sort_order);

-- 3. Contact Events lookup index
CREATE INDEX IF NOT EXISTS idx_contact_events_post_req 
  ON public.contact_events(post_id, requester_id);

-- 4. Saved Posts lookup index
CREATE INDEX IF NOT EXISTS idx_saved_posts_user_post 
  ON public.saved_posts(user_id, post_id);

-- 5. Comments ordering index
CREATE INDEX IF NOT EXISTS idx_comments_post_created 
  ON public.comments(post_id, created_at ASC);

-- 6. Roster Entries lookup index
CREATE INDEX IF NOT EXISTS idx_roster_entries_school_email 
  ON public.roster_entries(school_id, normalized_email);
