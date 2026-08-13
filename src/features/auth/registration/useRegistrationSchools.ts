import { useCallback, useEffect, useState } from 'react';
import { listRegistrationSchools } from './registrationService';
import type { RegistrationSchool } from './types';

export function useRegistrationSchools() {
  const [schools, setSchools] = useState<RegistrationSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const nextSchools = await listRegistrationSchools();
      setSchools(nextSchools);
      if (nextSchools.length === 0) {
        setError('Hiện chưa có trường nào được mở đăng ký.');
      }
    } catch (loadError) {
      setSchools([]);
      setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách trường.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { schools, loading, error, reload: load };
}
