import { supabase } from '../supabaseClient';

export const getEmployeesForGatePass = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('emp_id, full_name, phone_number');

  if (error) throw error;
  return data;
};

export const getHodAndHrForEmployee = async (employeeId) => {
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('hod_id')
    .eq('emp_id', employeeId)
    .maybeSingle();

  let hodUser = null;
  if (teamMember?.hod_id) {
    const { data } = await supabase
      .from('users')
      .select('full_name')
      .eq('emp_id', teamMember.hod_id)
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

  return { teamMember, hodUser, hrData };
};

export const getGatePasses = async () => {
  const { data, error } = await supabase
    .from('gate_pass')
    .select('*, users(full_name, phone_number, emp_id)')
    .order('timestamp', { ascending: false });

  if (error) throw error;
  return data;
};

export const updateGatePassStatus = async (requestId, updatePayload, logUpdates) => {
  const { data, error } = await supabase
    .from('gate_pass')
    .update(updatePayload)
    .eq('id', requestId);

  if (error) throw error;

  await supabase
    .from('logs')
    .update(logUpdates)
    .eq('request_id', requestId)
    .eq('request_type', 'Gate Pass');

  return data;
};

export const getApprovedGatePassesForExport = async (startOfMonth, endOfMonth) => {
  const { data, error } = await supabase
    .from('gate_pass')
    .select(`
      *,
      users(full_name, emp_id)
    `)
    .eq('status', 'Approved')
    .gte('departure_from_plant', startOfMonth)
    .lte('departure_from_plant', endOfMonth)
    .order('departure_from_plant', { ascending: true });

  if (error) throw error;
  return data;
};

export const uploadGatePassImage = async (file) => {
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

export const checkAndCreateGatePass = async (employeeId, todayStart, todayEnd, firstDayOfMonth, lastDayOfMonth, insertData, logPayload) => {
  const { data: todayRequests, error: todayError } = await supabase
    .from("gate_pass")
    .select("id")
    .eq("emp_id", employeeId)
    .gte("timestamp", todayStart)
    .lte("timestamp", todayEnd);

  if (todayError) return { error: "Error checking daily limit" };
  if (todayRequests.length > 0) return { error: "Only 1 gate pass request allowed per day" };

  const { data: monthlyRequests, error: monthError } = await supabase
    .from("gate_pass")
    .select("id")
    .eq("emp_id", employeeId)
    .gte("timestamp", firstDayOfMonth)
    .lte("timestamp", lastDayOfMonth);

  if (monthError) return { error: "Error checking monthly limit" };
  if (monthlyRequests.length >= 3) return { error: "You can only request 3 gate passes in a month" };

  const { data, error } = await supabase.from('gate_pass').insert([insertData]).select();
  if (error) throw error;

  if (data && data[0]) {
    await supabase.from('logs').insert({
      ...logPayload,
      request_id: data[0].id
    });
  }

  return { data };
};
