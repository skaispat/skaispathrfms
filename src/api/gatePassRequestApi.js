import { supabase } from '../supabaseClient';

export const getGatePassRequestUserData = async (empId) => {
  const [userRes, teamRes, hrRes, historyRes] = await Promise.all([
    supabase
      .from('users')
      .select('is_hod, phone_number')
      .eq('emp_id', empId)
      .maybeSingle(),
    supabase
      .from('team_members')
      .select('hod_id')
      .eq('emp_id', empId)
      .maybeSingle(),
    supabase
      .from('users')
      .select('full_name, emp_id')
      .eq('department', 'HR')
      .order('is_hod', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('gate_pass')
      .select('*, users(full_name)')
      .eq('emp_id', empId)
      .order('timestamp', { ascending: false })
  ]);

  if (historyRes.error) throw historyRes.error;

  const teamData = teamRes.data;
  let hodUser = null;
  if (teamData?.hod_id) {
    const { data } = await supabase
      .from('users')
      .select('full_name, department, phone_number')
      .eq('emp_id', teamData.hod_id)
      .single();
    hodUser = data;
  }

  return {
    currentUserData: userRes.data,
    teamData: teamData,
    hodUser,
    hrData: hrRes.data,
    historyData: historyRes.data
  };
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
