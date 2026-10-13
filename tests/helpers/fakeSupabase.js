// A stand-in for the Supabase client in unit tests. Every query-builder
// method (from, select, eq, insert, ...) is recorded in `calls`, and
// awaiting the query resolves to `result`.
export function fakeSupabase({ result = { data: null, error: null }, auth = {} } = {}) {
  const calls = [];

  const query = new Proxy({}, {
    get(_, method) {
      if (method === 'then') return (resolve) => resolve(result);
      return (...args) => {
        calls.push([method, ...args]);
        return query;
      };
    },
  });

  const client = {
    from(table) {
      calls.push(['from', table]);
      return query;
    },
    auth: {
      signInWithPassword: async (credentials) => {
        calls.push(['signInWithPassword', credentials]);
        return auth.signIn ?? { data: null, error: { message: 'Invalid login credentials' } };
      },
    },
  };

  return { client, calls };
}
