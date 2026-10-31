import { supabase } from '../supabaseClient';
import { getActiveHr } from './hrResolver';

export const getLeaveRequestInitialData = async (userEmpId, fiscalYear) => {
  const [teamRes, userRes, historyRes, balanceRes, quotaRes] = await Promise.all([
    supabase
      .from('team_members')
      .select('hod_id')
      .eq('emp_id', userEmpId)
      .maybeSingle(),
    supabase
      .from('users')
      .select('is_leave_allowed, designation, department')
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
  const [hodRes, activeHr] = await Promise.all([
    teamData?.hod_id
      ? supabase
        .from('users')
        .select('full_name, department, phone_number, is_active')
        .eq('emp_id', teamData.hod_id)
        .eq('is_active', true)
        .maybeSingle()
      : Promise.resolve({ data: null }),
    getActiveHr(teamData?.hod_id)
  ]);
  const hodUser = hodRes.data;

  const hrData = activeHr || {
    name: 'HR',
    full_name: 'HR',
    role: 'HR',
    emp_id: 'HR' // sentinel — NOT a real emp_id
  };

  return {
    teamData,
    hodUser,
    hrData,
    userData: userRes.data,
    historyData: historyRes.data || [],
    balanceData: balanceRes.data,
    quotaData: quotaRes.data
  };
};

// Always take designation from the employee's live users row at insert time.
// Page state (persisted login user, employee list loaded earlier) can be stale or
// empty, which saved '' or the role ('employee') into leave_management.designation.
export const withLiveDesignation = async (insertData) => {
  const { data } = await supabase
    .from('users')
    .select('designation')
    .eq('emp_id', insertData.emp_id)
    .maybeSingle();

  const live = data?.designation?.trim();
  const given = insertData.designation?.trim();
  return { ...insertData, designation: live || given || null };
};

export const createLeaveRequestWithLog = async (insertData, logData) => {
  const { data, error } = await supabase
    .from('leave_management')
    .insert([await withLiveDesignation(insertData)])
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
