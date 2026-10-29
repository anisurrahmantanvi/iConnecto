-- iConnecto 0013: post privacy. Each post is 'public' (everyone), 'followers' (people who follow the author) or 'only_me'.
-- Existing posts stay 'public' (that is how they behaved before). The rule lives in the posts SELECT policy, so every feed, profile,
-- search, comment list, like/reaction/save check (which all read through posts) respects it automatically.
-- Idempotent and non-destructive.

alter table public.posts add column if not exists visibility text not null default 'public';
select public._ic_add_constraint('public.posts', 'posts_visibility_chk',
  $$check (visibility in ('public', 'followers', 'only_me')) not valid$$);

-- The author may choose it when posting and change it later; nobody else can write it.
grant insert (visibility) on public.posts to authenticated;
grant update (visibility) on public.posts to authenticated;

drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts for select to authenticated
  using (
    not public.is_blocked_between(auth.uid(), author_id)
    and (community_id is null or public.can_view_community(community_id))
    and (
      visibility = 'public'
      or author_id = auth.uid()
      or (
        visibility = 'followers'
        and exists (
          select 1 from public.followers f
          where f.follower_id = auth.uid() and f.following_id = posts.author_id
        )
      )
    )
  );
