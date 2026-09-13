-- Switched from Google OAuth to Supabase magic link auth, so there is no
-- longer a third-party identity subject to track on the profile.
alter table profiles drop column google_sub;
