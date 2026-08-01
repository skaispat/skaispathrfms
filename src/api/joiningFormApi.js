import { supabase } from '../supabaseClient';

export const checkEmpIdExistsInUsers = async (empId) => {
  const { data, error } = await supabase
    .from('users')
    .select('emp_id')
    .eq('emp_id', empId);

  if (error) throw error;
  return data;
};

export const checkUsernameExistsInUsers = async (username) => {
  const { data, error } = await supabase
    .from('users')
    .select('username')
    .eq('username', username);

  if (error) throw error;
  return data;
};

export const getLastJoiningId = async () => {
  const { data, error } = await supabase
    .from('joining_form')
    .select('joining_id')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data;
};

export const uploadJoiningFormFile = async (file, path) => {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${path}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(filePath, file);

  if (uploadError) {
    console.error(`Error uploading ${path}:`, uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('images')
    .getPublicUrl(filePath);

  return data.publicUrl;
};

export const submitNewJoiningForm = async (payload) => {
  const { data, error } = await supabase
    .from('joining_form')
    .insert([payload]);

  if (error) throw error;
  return data;
};
