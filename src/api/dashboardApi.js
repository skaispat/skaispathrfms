import { supabase } from '../supabaseClient';

export const getDashboardUsers = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('emp_id, is_active, department, designation, joining_date, full_name, profile_picture');
  if (error) throw error;
  return data;
};

export const getDashboardEmployeeLeaving = async () => {
  const { data, error } = await supabase
    .from('employee_leaving')
    .select('date_of_leaving, actual_date');
  if (error) throw error;
  return data;
};

export const getDashboardOperationalData = async (isAdmin, user) => {
  let leavesQuery = supabase.from('leave_management')
    .select('id, employee_name, leave_type, status, leave_date_start, created_at')
    .order('created_at', { ascending: false });
  if (!isAdmin && user) leavesQuery = leavesQuery.eq('employee_name', user.full_name);

  let gatepassQuery = supabase.from('gate_pass')
    .select('id, emp_name, place_reason_to_visit, status, timestamp')
    .order('timestamp', { ascending: false });
  if (!isAdmin && user) gatepassQuery = gatepassQuery.eq('emp_name', user.full_name);

  const [leavesRes, gatepassRes, applicantsRes, birthdaysRes] = await Promise.all([
    leavesQuery.limit(5),
    gatepassQuery.limit(5),
    supabase.from('job_leads')
      .select('id, candidate_name, post, candidate_experience, created_at')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('birthday')
      .select('*')
      .order('created_at', { ascending: false })
  ]);

  return { leavesRes, gatepassRes, applicantsRes, birthdaysRes };
};

export const getDashboardRecentVacancies = async () => {
  const { data: jobs, error: jobsError } = await supabase
    .from('job_vacancy')
    .select('*')
    .order('id', { ascending: false })
    .limit(3);

  if (jobsError || !jobs) return [];

  const jobsWithCounts = await Promise.all(jobs.map(async (job) => {
    const { count } = await supabase
      .from('job_leads')
      .select('*', { count: 'exact', head: true })
      .eq('post', job.post);
    return { ...job, applied_count: count || 0 };
  }));

  return jobsWithCounts;
};

export const updateDashboardBirthdayWish = async (recordId, column, newSentBy) => {
  const { data, error } = await supabase
    .from('birthday')
    .update({ [column]: newSentBy })
    .eq('id', recordId);
  if (error) throw error;
  return data;
};
