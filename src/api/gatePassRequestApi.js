import { supabase } from '../supabaseClient';

export const getGatePassRequestUserData = async (empId) => {
  const { data: currentUserData } = await supabase
    .from('users')
    .select('is_hod, phone_number')
    .eq('emp_id', empId)
    .single();

  const { data: teamData } = await supabase
    .from('team_members')
    .select('hod_id')
    .eq('emp_id', empId)
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

  const { data: hrData } = await supabase
    .from('users')
    .select('full_name, emp_id')
    .eq('department', 'HR')
    .order('is_hod', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: historyData, error: historyError } = await supabase
    .from('gate_pass')
    .select('*, users(full_name)')
    .eq('emp_id', empId)
    .order('timestamp', { ascending: false });

  if (historyError) throw historyError;

  return { currentUserData, teamData, hodUser, hrData, historyData };
};

export const uploadGatePassRequestAttachment = async (file) => {
  const fileExt = file.name.split('.').pop();
  const fileName = `gate-passes/${Date.now()}.${fileExt}`;

  const { error } = await supabase
    .storage
    .from('images')
    .upload(fileName, file);

  if (error) throw error;

  const { data: { publicUrl } } = supabase
    .storage
    .from('images')
    .getPublicUrl(fileName);

  return publicUrl;
};

export const submitGatePassRequest = async (insertData, logData) => {
  const { data, error } = await supabase
    .from('gate_pass')
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
