import { createClient } from 'npm:@supabase/supabase-js@2.119.0';
import { createHandler } from './core.mjs';
console.info('STUDIO_AI_CONFIGURATION',JSON.stringify({keyPresent:Boolean(Deno.env.get('OPENAI_API_KEY')?.trim()),activationEnabled:Deno.env.get('STUDIO_AI_ENABLED')?.trim().toLowerCase()==='true'}));
Deno.serve(createHandler({createClient,env:(key:string)=>Deno.env.get(key)?.trim()}));
