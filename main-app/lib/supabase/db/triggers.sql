drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_auth_user_created();

create function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
	insert into public.users_profile (
		user_id,
		role,
		is_active,
		email_verified,
		created_at,
		updated_at
	)
	values (
		new.id,
		'buyer',
		true,
		false,
		now(),
		now()
	)
	on conflict (user_id) do nothing;

	return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_auth_user_created();
