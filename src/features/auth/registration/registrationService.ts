import { getSupabaseClient } from '../../../lib/supabase/client';
import { getStudentConfirmRedirectUrl } from '../../../lib/supabase/siteUrl';
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
  const emailRedirectTo = getStudentConfirmRedirectUrl();

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      emailRedirectTo,
      data: {
        registration_intent: 'student_v2',
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
