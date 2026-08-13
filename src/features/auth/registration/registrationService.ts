import { getSupabaseClient } from '../../../lib/supabase/client';
import type { RegistrationSchool, StudentRegistrationInput } from './types';

export async function listRegistrationSchools(): Promise<RegistrationSchool[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('schools')
    .select('id, code, name')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as RegistrationSchool[];
}

export async function signUpStudent(input: StudentRegistrationInput) {
  const supabase = getSupabaseClient();
  const redirectUrl = new URL('/', window.location.origin);
  redirectUrl.searchParams.set('page', 'loginStudent');
  redirectUrl.searchParams.set('confirmed', '1');

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo: redirectUrl.toString(),
      data: {
        full_name: input.fullName,
        school_id: input.schoolId,
        class_name: input.className,
        phone: input.phone,
      },
    },
  });

  if (error) throw error;
  return data;
}
