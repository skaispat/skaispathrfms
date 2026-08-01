import { supabase } from '../supabaseClient';

export const getApprovalFormDetails = async (id, approverId) => {
  const { data, error } = await supabase
    .from('leave_management')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Request not found');

  let { data: approverData } = await supabase
    .from('users')
    .select('*')
    .eq('emp_id', approverId);

  if (!approverData) {
    const { data: approverUuidData } = await supabase
      .from('users')
      .select('*')
      .eq('id', approverId)
      .maybeSingle();
    approverData = approverUuidData;
  }

  const { data: hrData } = await supabase
    .from('users')
    .select('full_name, phone_number, emp_id')
    .eq('department', 'HR')
    .order('is_hod', { ascending: false })
    .limit(1)
    .maybeSingle();

  return { data, approverData, hrData };
};

export const updateApprovalFormAction = async (id, updateData, logUpdateData) => {
  const { error: updateError } = await supabase
    .from('leave_management')
    .update(updateData)
    .eq('id', id);

  if (updateError) throw updateError;

  await supabase
    .from('logs')
    .update(logUpdateData)
    .eq('request_id', id)
    .eq('request_type', 'Leave');
};
