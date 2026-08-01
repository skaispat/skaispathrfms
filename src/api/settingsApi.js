import { supabase } from '../supabaseClient';

export const getSettingsInitialData = async () => {
  const [usersResponse, teamResponse, joiniResponse] = await Promise.all([
    supabase.from('users').select('*').order('created_at', { ascending: false }),
    supabase.from('team_members').select('*'),
    supabase.from('joining_form').select('*')
  ]);

  if (usersResponse.error) throw usersResponse.error;

  return {
    users: usersResponse.data || [],
    teamMembers: teamResponse.data || [],
    joiningForms: joiniResponse.data || []
  };
};

export const getLeaveQuotaForEmpId = async (empId) => {
  const { data, error } = await supabase
    .from('employee_leave_balances')
    .select('*')
    .eq('emp_id', empId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const uploadSettingsProfilePicture = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `profile-pictures/${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  let { error: uploadError } = await supabase.storage
    .from('images')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('images')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

export const checkEmpAndUsernameExists = async (empId, username) => {
  const [empCheck, usernameCheck] = await Promise.all([
    supabase.from('users').select('emp_id').ilike('emp_id', empId),
    supabase.from('users').select('emp_id, username').eq('username', username)
  ]);

  if (empCheck.error) throw empCheck.error;
  if (usernameCheck.error) throw usernameCheck.error;

  return {
    empCheck: empCheck.data || [],
    usernameCheck: usernameCheck.data || []
  };
};

export const updateUserRecordInSettings = async (empId, userData) => {
  const { data, error } = await supabase
    .from('users')
    .update(userData)
    .eq('emp_id', empId);

  if (error) throw error;
  return data;
};

export const createUserRecordInSettings = async (userData) => {
  const { data, error } = await supabase
    .from('users')
    .insert([userData]);

  if (error) throw error;
  return data;
};

export const updateTeamMembersForHod = async (hodId, toRemoveEmpIds, newTeamEmpIds) => {
  if (toRemoveEmpIds && toRemoveEmpIds.length > 0) {
    await supabase.from('team_members').delete().in('emp_id', toRemoveEmpIds);
  }

  if (newTeamEmpIds && newTeamEmpIds.length > 0) {
    const updates = newTeamEmpIds.map(empId => ({
      hod_id: hodId,
      emp_id: empId
    }));
    await supabase.from('team_members').upsert(updates);
  }
};

export const shiftEmployeesToHod = async (employeesToShift, targetHodId) => {
  const { error: deleteError } = await supabase
    .from('team_members')
    .delete()
    .in('emp_id', employeesToShift);

  if (deleteError) throw deleteError;

  const updates = employeesToShift.map(empId => ({
    hod_id: targetHodId,
    emp_id: empId
  }));

  const { error: upsertError } = await supabase
    .from('team_members')
    .upsert(updates);

  if (upsertError) throw upsertError;
};

export const assignEmployeesToHod = async (selectedEmployees, hodId) => {
  const updates = selectedEmployees.map(empId => ({
    hod_id: hodId,
    emp_id: empId
  }));

  const { error } = await supabase
    .from('team_members')
    .upsert(updates);

  if (error) throw error;
};

export const removeEmployeeFromHod = async (empId) => {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('emp_id', empId);

  if (error) throw error;
};

export const insertLeaveFromSettings = async (insertData) => {
  const { data, error } = await supabase
    .from('leave_management')
    .insert([insertData]);

  if (error) throw error;
  return data;
};

export const toggleUserLeaveAccess = async (empId, newStatus) => {
  const { error } = await supabase
    .from('users')
    .update({ is_leave_allowed: newStatus })
    .eq('emp_id', empId);

  if (error) throw error;
};

export const getNewJoiningFormsForSettings = async () => {
  const { data, error } = await supabase
    .from('joining_form')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};
