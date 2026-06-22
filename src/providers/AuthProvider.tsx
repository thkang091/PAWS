import { createContext, type PropsWithChildren, useContext } from "react";

import {
  type AuthBootstrapState,
  useAuthBootstrap,
} from "@/hooks/useAuthBootstrap";

const AuthContext = createContext<AuthBootstrapState | null>(null);

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const auth = useAuthBootstrap();

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthBootstrapState => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
};
