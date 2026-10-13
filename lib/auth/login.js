// Same message for a wrong email or a wrong password (SFDS 6.1.1, item 5).
export const LOGIN_FAILED = 'Invalid email or password.';

export async function login(supabase, { email, password }) {
  if (!email?.trim() || !password) {
    return { status: 400, body: { error: 'Email and password are required.' } };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data?.user) {
    return { status: 401, body: { error: LOGIN_FAILED } };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, role')
    .eq('id', data.user.id)
    .maybeSingle();

  return {
    status: 200,
    body: {
      username: profile?.username ?? data.user.email,
      role: profile?.role ?? 'Staff',
    },
  };
}
