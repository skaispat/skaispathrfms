import { supabase } from '../supabaseClient';

export const getJobLeadsForEnquiry = async () => {
  const { data, error } = await supabase
    .from('job_leads')
    .select('*');

  if (error) throw error;
  return data;
};
