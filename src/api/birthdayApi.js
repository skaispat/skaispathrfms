import { supabase } from '../supabaseClient';

export const getEmployeesForBirthday = async () => {
  const { data, error } = await supabase
    .from('users')
    .select('emp_id, full_name');
  if (error) throw error;
  return data;
};

export const getBirthdayRecords = async () => {
  const { data, error } = await supabase
    .from('birthday')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
};

export const deleteBirthdayRecord = async (id) => {
  const { data, error } = await supabase
    .from('birthday')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return data;
};

export const uploadBirthdayPhoto = async (file) => {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `birthdays/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('images').getPublicUrl(filePath);
  return data.publicUrl;
};

export const insertBirthdayRecords = async (recordsToInsert) => {
  const { data, error } = await supabase
    .from('birthday')
    .insert(recordsToInsert);
  if (error) throw error;
  return data;
};

export const updateBirthdayRecord = async (id, updatePayload) => {
  const { data, error } = await supabase
    .from('birthday')
    .update(updatePayload)
    .eq('id', id);
  if (error) throw error;
  return data;
};
