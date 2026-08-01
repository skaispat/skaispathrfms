import { supabase } from '../supabaseClient';

export const getEmployeesForVisitors = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('emp_id, full_name');

  if (error) throw error;
  return data;
};

export const getVisitorsList = async (isAdmin, userEmpId) => {
  let query = supabase
    .from('visitors')
    .select('*')
    .order('created_at', { ascending: false });

  if (!isAdmin && userEmpId) {
    query = query.eq('person_to_meet', userEmpId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
};

export const updateVisitorApprovalStatus = async (id, isApprove, approverName, timestamp) => {
  const { data, error } = await supabase
    .from('visitors')
    .update({
      approval_status: isApprove,
      approved_by: approverName,
      approved_at: timestamp
    })
    .eq('id', id);

  if (error) throw error;
  return data;
};
