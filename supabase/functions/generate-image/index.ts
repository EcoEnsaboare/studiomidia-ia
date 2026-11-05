import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { createHandler } from './core.mjs';
Deno.serve(createHandler({createClient,env:(key:string)=>Deno.env.get(key)}));
