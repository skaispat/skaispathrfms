import { supabase } from '../supabaseClient';

export const getLeaveRequestInitialData = async (userEmpId, fiscalYear) => {
  // 1. Fetch HOD Details
  const { data: teamData } = await supabase
    .from('team_members')
    .select('hod_id')
    .eq('emp_id', userEmpId)
    .maybeSingle();

  let hodUser = null;
  if (teamData?.hod_id) {
    const { data } = await supabase
      .from('users')
      .select('full_name, department, phone_number')
      .eq('emp_id', teamData.hod_id)
      .single();
    hodUser = data;
  }

  // 2. Fetch HR Details
  const { data: hrData } = await supabase
    .from('users')
    .select('full_name, emp_id')
    .eq('department', 'HR')
    .order('is_hod', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 3. Fetch current user details
  const { data: userData } = await supabase
    .from('users')
    .select('is_leave_allowed')
    .eq('emp_id', userEmpId)
    .single();

  // 4. Fetch Leave History
  const { data: historyData, error: historyError } = await supabase
    .from('leave_management')
    .select('*')
    .eq('emp_id', userEmpId)
    .order('timestamp', { ascending: false });

  if (historyError) throw historyError;

  // 5. Fetch leave balances
  const { data: balanceData } = await supabase
    .from('employee_leave_balances')
    .select('*')
    .eq('emp_id', userEmpId)
    .maybeSingle();

  const { data: quotaData } = await supabase
    .from('yearly_quota')
    .select('carried_forward_el')
    .eq('emp_id', userEmpId)
    .eq('year', fiscalYear)
    .maybeSingle();

  return {
    teamData,
    hodUser,
    hrData,
    userData,
    historyData: historyData || [],
    balanceData,
    quotaData
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
