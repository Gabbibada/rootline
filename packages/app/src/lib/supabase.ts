import { createClient } from '@supabase/supabase-js'
import AsyncStorage from '@react-native-async-storage/async-storage'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
})

export const signUpWithEmail  = (email: string, password: string) => supabase.auth.signUp({ email, password })
export const signInWithEmail  = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password })
export const signOut          = () => supabase.auth.signOut()
export const getSession       = () => supabase.auth.getSession()
