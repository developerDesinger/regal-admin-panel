import { createContext, useContext, useState, type ReactNode } from 'react';

type Language = 'eng' | 'spanish';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations: Record<Language, Record<string, string>> = {
  eng: {
    'Dashboard': 'Dashboard',
    'User Management': 'User Management',
    'Categories': 'Categories',
    'Trending Deals': 'Trending Deals',
    'Events': 'Events',
    'Transactions': 'Transactions',
    'Reports': 'Reports',
    'Risk Alerts': 'Risk Alerts',
    'Platform Fee': 'Platform Fee',
    'Logout': 'Logout'
  },
  spanish: {
    'Dashboard': 'Tablero',
    'User Management': 'Gestión de Usuarios',
    'Categories': 'Categorías',
    'Trending Deals': 'Ofertas de Tendencia',
    'Events': 'Eventos',
    'Transactions': 'Transacciones',
    'Reports': 'Reportes',
    'Risk Alerts': 'Alertas de Riesgo',
    'Platform Fee': 'Tarifa de Plataforma',
    'Logout': 'Cerrar Sesión'
  }
};

const LANGUAGE_STORAGE_KEY = 'admin_language';

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return (stored === 'eng' || stored === 'spanish') ? stored : 'eng';
  });

  const toggleLanguage = () => {
    setLanguage(prev => {
      const newLang = prev === 'eng' ? 'spanish' : 'eng';
      localStorage.setItem(LANGUAGE_STORAGE_KEY, newLang);
      return newLang;
    });
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
