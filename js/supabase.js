const SUPABASE_URL = 'https://hqzugbxutgefjilgmxqu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RRdq-futHfTDJoQgFVLvTQ_gie9dLmd';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
