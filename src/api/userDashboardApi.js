import { supabase } from '../supabaseClient';

export const getUserDashboardInitialData = async (user, fiscalYear, firstDayOfMonth) => {
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select('emp_id, is_active, department, designation, joining_date, full_name, profile_picture');

  if (usersError) throw usersError;

  let balanceData = null;
  let quotaData = null;

  if (user) {
    const { data: bData } = await supabase
      .from('employee_leave_balances')
      .select('*')
      .eq('emp_id', user.emp_id)
      .maybeSingle();
    balanceData = bData;

    const { data: qData } = await supabase
      .from('yearly_quota')
      .select('carried_forward_el')
      .eq('emp_id', user.emp_id)
      .eq('year', fiscalYear)
      .maybeSingle();
    quotaData = qData;
  }

  let leavesQuery = supabase.from('leave_management')
    .select('id, employee_name, leave_type, status, leave_date_start, created_at')
    .order('created_at', { ascending: false });
  if (user) {
    leavesQuery = leavesQuery.eq('employee_name', user.full_name)
      .gte('leave_date_start', firstDayOfMonth);
  }

  let gatepassQuery = supabase.from('gate_pass')
    .select('id, emp_name, place_reason_to_visit, status, timestamp')
    .order('timestamp', { ascending: false });
  if (user) {
    gatepassQuery = gatepassQuery.eq('emp_name', user.full_name)
      .gte('timestamp', firstDayOfMonth);
  }

  const [leavesRes, gatepassRes, birthdaysRes] = await Promise.all([
    leavesQuery.limit(5),
    gatepassQuery.limit(5),
    supabase.from('birthday')
      .select('*')
      .order('created_at', { ascending: false })
  ]);

  return {
    usersData: usersData || [],
    balanceData,
    quotaData,
    leavesData: leavesRes.data || [],
    gatepassData: gatepassRes.data || [],
    birthdaysData: birthdaysRes.data || []
  };
};

export const updateBirthdayWishFromUserDashboard = async (recordId, column, newSentBy) => {
  const { data, error } = await supabase
    .from('birthday')
    .update({ [column]: newSentBy })
    .eq('id', recordId);

  if (error) throw error;
  return data;
};
