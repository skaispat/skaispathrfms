import { supabase } from '../supabaseClient';

export const getLastJoiningFormId = async () => {
  const { data, error } = await supabase
    .from('joining_form')
    .select('joining_id')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('Error fetching last ID:', error);
    return null;
  }
  return data;
};

export const uploadJoiningImage = async (file, path) => {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${path}/${fileName}`;
  const { error: uploadError } = await supabase.storage.from('images').upload(filePath, file);
  if (uploadError) {
    console.error(`Error uploading ${path}:`, uploadError);
    throw uploadError;
  }
  const { data } = supabase.storage.from('images').getPublicUrl(filePath);
  return data.publicUrl;
};

export const upsertJoiningForm = async (existingData, payload, newJoiningId) => {
  if (existingData && existingData.joining_id) {
    const { error: updateError } = await supabase
      .from('joining_form')
      .update(payload)
      .eq('joining_id', existingData.joining_id);
    if (updateError) throw updateError;
    return existingData.joining_id;
  } else {
    const { error: insertError } = await supabase.from('joining_form').insert([payload]);
    if (insertError) throw insertError;
    return newJoiningId;
  }
};

export const getAllJoiningForms = async () => {
  const { data, error } = await supabase
    .from('joining_form')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};
