import { supabase } from '../supabaseClient';

export const getLeaveRequestInitialData = async (userEmpId, fiscalYear) => {
  const [teamRes, hrRes, userRes, historyRes, balanceRes, quotaRes] = await Promise.all([
    supabase
      .from('team_members')
      .select('hod_id')
      .eq('emp_id', userEmpId)
      .maybeSingle(),
    supabase
      .from('users')
      .select('full_name, emp_id')
      .eq('department', 'HR')
      .order('is_hod', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('users')
      .select('is_leave_allowed')
      .eq('emp_id', userEmpId)
      .maybeSingle(),
    supabase
      .from('leave_management')
      .select('*')
      .eq('emp_id', userEmpId)
      .order('timestamp', { ascending: false }),
    supabase
      .from('employee_leave_balances')
      .select('*')
      .eq('emp_id', userEmpId)
      .maybeSingle(),
    supabase
      .from('yearly_quota')
      .select('carried_forward_el')
      .eq('emp_id', userEmpId)
      .eq('year', fiscalYear)
      .maybeSingle()
  ]);

  if (historyRes.error) throw historyRes.error;

  const teamData = teamRes.data;
  let hodUser = null;
  if (teamData?.hod_id) {
    const { data } = await supabase
      .from('users')
      .select('full_name, department, phone_number')
      .eq('emp_id', teamData.hod_id)
      .single();
    hodUser = data;
  }

  return {
    teamData,
    hodUser,
    hrData: hrRes.data,
    userData: userRes.data,
    historyData: historyRes.data || [],
    balanceData: balanceRes.data,
    quotaData: quotaRes.data
  };
};

export const createLeaveRequestWithLog = async (insertData, logData) => {
  const { data, error } = await supabase
    .from('leave_management')
    .insert([insertData])
    .select();

  if (error) throw error;

  if (data && data[0]) {
    await supabase.from('logs').insert({
      ...logData,
      request_id: data[0].id
    });
  }

  return data;
};
