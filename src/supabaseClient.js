import { createClient } from '@supabase/supabase-js'

// These will be set in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase environment variables are not set. Please check your .env file.')
}

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey)