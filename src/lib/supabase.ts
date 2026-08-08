import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = "https://bmevvqkivylkyzerrhjk.supabase.co";
const supabasePublishableKey =
  "sb_publishable_WuyMBwerywyBCVAdiw8lOw_ayJL0tnU";

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    flowType: "implicit",
    detectSessionInUrl: true,
    // In preview environments, use the origin for emailRedirectTo
    // This is set automatically by the Supabase client
  },
});
