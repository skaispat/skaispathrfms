import { supabase } from '../supabaseClient';

export const getCallTrackerEnquiries = async () => {
  const { data, error } = await supabase
    .from('employee_enquiry')
    .select('*')
    .order('id', { ascending: false });

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  return data;
};

export const updateCallTrackerEnquiry = async (id, updateData) => {
  const { data, error } = await supabase
    .from('employee_enquiry')
    .update(updateData)
    .eq('id', id);

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  return data;
};

export const getLatestJoiningFormId = async () => {
  const { data, error } = await supabase
    .from('joining_form')
    .select('joining_id')
    .order('created_at', { ascending: false })
    .limit(1);

  return { data, error };
};

export const insertJoiningFormRecord = async (joiningPayload) => {
  const { data, error } = await supabase
    .from('joining_form')
    .insert([joiningPayload]);

  return { data, error };
};
