import { createContext,useContext,useEffect,useMemo,useState,type ReactNode } from 'react';
type Theme='light'|'dark';
const Context=createContext<{theme:Theme;toggle:()=>void}>({theme:'light',toggle:()=>undefined});
export function ThemeProvider({children}:{children:ReactNode}) { const [theme,setTheme]=useState<Theme>(()=>localStorage.getItem('mvm-theme')==='dark'?'dark':'light'); useEffect(()=>{document.documentElement.classList.toggle('dark',theme==='dark');localStorage.setItem('mvm-theme',theme)},[theme]); const value=useMemo(()=>({theme,toggle:()=>setTheme(t=>t==='dark'?'light':'dark')}),[theme]); return <Context.Provider value={value}>{children}</Context.Provider> }
export const useTheme=()=>useContext(Context);
