import { createClient } from '@supabase/supabase-js';

export async function loadAdminConfig<T extends Record<string, unknown>>(key: string): Promise<Partial<T>> {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return {};
  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data } = await supabase
      .from('admin_app_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return (data?.value ?? {}) as Partial<T>;
  } catch {
    return {};
  }
}

export function firstNonEmpty(...values: Array<unknown>): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}
