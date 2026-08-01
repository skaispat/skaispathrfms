import { supabase } from '../supabaseClient';

export const getJobApplicantCount = async (jobId) => {
  const { count, error } = await supabase
    .from('job_leads')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId);

  if (error) return 0;
  return count || 0;
};

export const getActiveJobVacanciesWithCounts = async () => {
  const { data, error } = await supabase
    .from('job_vacancy')
    .select('*')
    .order('id', { ascending: false });

  if (error) throw error;

  if (data && data.length > 0) {
    const jobsWithCounts = await Promise.all(
      data.map(async (job) => {
        const count = await getJobApplicantCount(job.id);
        return { ...job, applicantCount: count };
      })
    );
    return jobsWithCounts;
  }
  return [];
};

export const getUserByUsername = async (username) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  return { data, error };
};

export const uploadCandidateResume = async (file) => {
  if (!file) return '';
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(fileName, file);

  if (uploadError) {
    console.warn('Could not upload to images bucket');
    const { error: fallbackError } = await supabase.storage.from('images').upload(fileName, file);
    if (fallbackError) {
      throw new Error('Resume upload failed: ' + fallbackError.message);
    }
  }

  const { data } = supabase.storage.from('images').getPublicUrl(fileName);
  return data.publicUrl;
};

export const submitJobLead = async (leadPayload) => {
  const { data, error } = await supabase
    .from('job_leads')
    .insert([leadPayload]);

  if (error) throw error;
  return data;
};
