import { createContext,useContext,useEffect,useMemo,useState,type ReactNode } from 'react';
import { api,setAccessToken } from '../lib/api';
import type { User } from '../types';
interface State { user:User|null;loading:boolean;signIn:(email:string,password:string)=>Promise<User>;signOut:()=>Promise<void>;setUser:(user:User|null)=>void }
const Context=createContext<State|null>(null);
export function AuthProvider({children}:{children:ReactNode}) { const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);useEffect(()=>{let alive=true;const expired=()=>{setAccessToken(null);setUser(null)};window.addEventListener('mvm:session-expired',expired);void api.restore().then(u=>{if(alive)setUser(u)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false;window.removeEventListener('mvm:session-expired',expired)}},[]);const value=useMemo<State>(()=>({user,loading,setUser,async signIn(email,password){const result=await api.login(email,password);setUser(result.user);return result.user},async signOut(){try{await api.logout()}finally{setAccessToken(null);setUser(null)}}}),[user,loading]);return <Context.Provider value={value}>{children}</Context.Provider> }
export function useAuth():State {const value=useContext(Context);if(!value)throw new Error('useAuth must be used within AuthProvider');return value}
