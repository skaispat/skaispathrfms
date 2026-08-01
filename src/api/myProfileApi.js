import { supabase } from '../supabaseClient';

export const getMyProfileData = async (sessionUser) => {
  let query = supabase.from('users').select('*');
  if (sessionUser.emp_id) {
    query = query.eq('emp_id', sessionUser.emp_id);
  } else {
    query = query.eq('username', sessionUser.username);
  }

  const { data, error } = await query.single();
  if (error) throw error;
  if (!data) throw new Error("User profile not found.");

  return data;
};

export const getMyActivityHistory = async (empId) => {
  const { data: leaves, error: leaveError } = await supabase
    .from('leave_management')
    .select('*')
    .eq('emp_id', empId)
    .order('timestamp', { ascending: false });

  if (leaveError) throw leaveError;

  const { data: passes, error: passError } = await supabase
    .from('gate_pass')
    .select('*')
    .eq('emp_id', empId)
    .order('timestamp', { ascending: false });

  if (passError) throw passError;

  return { leaves: leaves || [], passes: passes || [] };
};

export const uploadMyProfilePicture = async (file, empId, autoSave = false) => {
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

  const publicUrl = data.publicUrl;

  if (autoSave && empId) {
    await supabase.from('users').update({ profile_picture: publicUrl }).eq('emp_id', empId);
  }

  return publicUrl;
};

export const updateMyProfileData = async (empId, updates) => {
  const { data, error } = await supabase
    .from('users')
    .update(updates)
    .eq('emp_id', empId);

  if (error) throw error;
  return data;
};
