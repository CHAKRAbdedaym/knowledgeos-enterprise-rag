import { createContext, useContext } from 'react';
export const AuthContext = createContext<{ logout: () => Promise<void> }>({
  logout: async () => {},
});
export const useAdminAuth = () => useContext(AuthContext);
