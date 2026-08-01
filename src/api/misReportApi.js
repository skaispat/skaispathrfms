import { supabase } from '../supabaseClient';

export const getMisReports = async () => {
  const { data, error } = await supabase
    .from('mis_report')
    .select('*')
    .order('id', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
};

export const getMisLeaveReportData = async (startDate, endDate) => {
  const { data: employees, error: empError } = await supabase
    .from('users')
    .select('emp_id, full_name')
    .order('emp_id', { ascending: true });

  if (empError) throw new Error(empError.message);

  const { data: leaves, error: leaveError } = await supabase
    .from('leave_management')
    .select('*')
    .ilike('status', '%Approved%')
    .lte('leave_date_start', endDate)
    .gte('leave_date_end', startDate);

  if (leaveError) throw new Error(leaveError.message);

  return { employees, leaves };
};
