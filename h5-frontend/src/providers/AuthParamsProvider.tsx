import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface AuthParamsContextType {
  role?: string;
  workshop_id?: string;
  workshop_name?: string;
}

const AuthParamsContext = createContext<AuthParamsContextType>({});

export const useAuthParams = () => useContext(AuthParamsContext);

export default function AuthParamsProvider({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const [params, setParams] = useState<AuthParamsContextType>({});

  useEffect(() => {
    // In actual scenario, these might come from internal enterprise links 
    // Example: ?role=applicant&workshop_id=w123&workshop_name=炼铁厂
    const role = searchParams.get('role');
    const workshop_id = searchParams.get('workshop_id');
    const workshop_name = searchParams.get('workshop_name');

    if (role) {
      setParams({ 
        role: role, 
        workshop_id: workshop_id || 'default_ws', 
        workshop_name: workshop_name || '默认车间' 
      });
      console.log('Detected entry params:', { role, workshop_id, workshop_name });
    }
  }, [searchParams]);

  return (
    <AuthParamsContext.Provider value={params}>
      {children}
    </AuthParamsContext.Provider>
  );
}
