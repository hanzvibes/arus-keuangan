const FALLBACK_SUPABASE_URL = "https://mtoswyittiipcuewrheo.supabase.co";
const FALLBACK_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_HMU7V228g8prrl0b8YTmJA_Q1BP8OMN";

export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;

export const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  FALLBACK_SUPABASE_PUBLISHABLE_KEY;
