import { createContext, useContext, type ReactNode } from 'react';
import type { DataAccessRepositories } from '../../data/contracts/repositories';

const DataAccessContext = createContext<DataAccessRepositories | null>(null);

interface DataAccessProviderProps {
  value: DataAccessRepositories;
  children: ReactNode;
}

export function DataAccessProvider({ value, children }:DataAccessProviderProps) {
  return <DataAccessContext.Provider value={value}>{children}</DataAccessContext.Provider>;
}

export function useDataAccess():DataAccessRepositories {
  const value = useContext(DataAccessContext);
  if (!value) throw new Error('DataAccessProvider chưa được cấu hình.');
  return value;
}
