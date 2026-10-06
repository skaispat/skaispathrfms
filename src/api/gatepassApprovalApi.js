import { supabase } from '../supabaseClient';

export const getGatePassApprovalData = async (id, approverId) => {
  const { data, error } = await supabase
    .from('gate_pass')
    .select('*, users(full_name, emp_id, phone_number)')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) throw new Error('Request not found');

  let { data: approverData } = await supabase
    .from('users')
    .select('*')
    .eq('full_name', approverId)
    .maybeSingle();

  if (!approverData) {
    const { data: approverEmpData } = await supabase
      .from('users')
      .select('*')
      .eq('emp_id', approverId)
      .maybeSingle();
    approverData = approverEmpData;
  }

  if (!approverData) {
    const { data: approverUuidData } = await supabase
      .from('users')
      .select('*')
      .eq('id', approverId)
      .maybeSingle();
    approverData = approverUuidData;
  }

  const { data: rawHr } = await supabase
    .from('users')
    .select('full_name, phone_number, emp_id, role, is_active')
    .or('department.eq.HR,role.ilike.hr')
    .eq('is_active', true)
    .order('is_hod', { ascending: false })
    .limit(1)
    .maybeSingle();

  const hrData = rawHr ? {
    ...rawHr,
    name: rawHr.full_name || 'HR',
    full_name: rawHr.full_name || 'HR',
    role: rawHr.role ? rawHr.role.toUpperCase() : 'HR'
  } : {
    name: 'HR',
    full_name: 'HR',
    role: 'HR',
    emp_id: 'HR'
  };

  return { data, approverData, hrData };
};

export const updateGatePassApprovalAction = async (id, updateData, logUpdateData) => {
  const { error: updateError } = await supabase
    .from('gate_pass')
    .update(updateData)
    .eq('id', id);

  if (updateError) throw updateError;

  await supabase
    .from('logs')
    .update(logUpdateData)
    .eq('request_id', id)
    .eq('request_type', 'Gate Pass');
};
