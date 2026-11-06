-- iConnecto 0032: "Who can comment on your posts" (everyone | followers | nobody).
-- Enforced inside the existing comments_validate() insert trigger (the comments RLS policies are not touched).
-- You can always comment on your own posts. People you blocked (or who blocked you) are already stopped by RLS. Idempotent.
alter table public.profiles add column if not exists who_can_comment text not null default 'everyone';
alter table public.profiles drop constraint if exists profiles_who_can_comment_check;
alter table public.profiles add constraint profiles_who_can_comment_check check (who_can_comment in ('everyone','followers','nobody'));
grant update (who_can_comment) on public.profiles to authenticated;

create or replace function public.comments_validate() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  par public.comments;
  owner uuid;
  rule text;
begin
  if new.parent_id is not null then
    select * into par from public.comments where id = new.parent_id;
    if not found then raise exception 'parent comment not found'; end if;
    if par.post_id <> new.post_id then raise exception 'reply must be on the same post'; end if;
    if par.parent_id is not null then raise exception 'replies can only be one level deep'; end if;
  end if;

  select author_id into owner from public.posts where id = new.post_id;
  if owner is not null and owner <> new.author_id then
    select coalesce(who_can_comment, 'everyone') into rule from public.profiles where id = owner;
    if rule = 'nobody' then
      raise exception 'comments are turned off for this post';
    elsif rule = 'followers' and not exists (
      select 1 from public.followers f where f.follower_id = new.author_id and f.following_id = owner
    ) then
      raise exception 'only friends can comment on this post';
    end if;
  end if;
  return new;
end $$;
