import { createClient } from "@supabase/supabase-js";

// These will be set in your .env file
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;



// Check if environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  const missingVars = [];
  if (!supabaseUrl) missingVars.push("VITE_SUPABASE_URL");
  if (!supabaseAnonKey) missingVars.push("VITE_SUPABASE_ANON_KEY");

  console.error(
    `Missing Supabase environment variables: ${missingVars.join(", ")}`
  );
  console.error(
    "Please create a .env file in the root directory with these variables."
  );
  throw new Error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
}

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
