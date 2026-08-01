import { supabase } from '../supabaseClient';

export const getAfterJoiningWorkData = async () => {
  const { data: joiningData, error: joiningError } = await supabase
    .from('joining_form')
    .select('*');

  if (joiningError) throw new Error(`Supabase joining_form error: ${joiningError.message}`);

  const { data: checklistData, error: checklistError } = await supabase
    .from('after_joining')
    .select('*');

  if (checklistError) throw new Error(`Supabase after_joining error: ${checklistError.message}`);

  return { joiningData, checklistData };
};

export const getAssetsDataByEmployeeId = async (employeeId) => {
  const { data, error } = await supabase
    .from('assets')
    .select('*')
    .eq('employee_id', employeeId)
    .limit(1);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  return data;
};

export const checkEmployeeIdExists = async (id) => {
  const { data, error } = await supabase
    .from('users')
    .select('emp_id')
    .eq('emp_id', id)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    console.error("Error checking emp_id:", error);
    return null;
  }
  return data;
};

export const saveAssetsRecord = async (employeeId, employeeName, assetsData) => {
  const now = new Date();
  const timestamp = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

  const { data: existingData, error: fetchError } = await supabase
    .from('assets')
    .select('id')
    .eq('employee_id', employeeId)
    .limit(1);

  if (fetchError) throw new Error(`Supabase fetch error: ${fetchError.message}`);

  const assetRecord = {
    timestamp: timestamp,
    employee_id: employeeId,
    employee_name: employeeName,
    email_id: assetsData.emailId || "",
    email_password: assetsData.emailPassword || "",
    laptop: assetsData.laptop || "",
    mobile: assetsData.mobile || "",
    vehicle: assetsData.vehicle || "",
    sim: assetsData.other || "",
    manual: assetsData.manualImageUrl || "",
    punch_code: assetsData.punchCode || ""
  };

  if (existingData && existingData.length > 0) {
    const { data, error } = await supabase
      .from('assets')
      .update(assetRecord)
      .eq('employee_id', employeeId);

    if (error) throw new Error(`Supabase update error: ${error.message}`);
    return data;
  } else {
    const { data, error } = await supabase
      .from('assets')
      .insert([assetRecord]);

    if (error) throw new Error(`Supabase insert error: ${error.message}`);
    return data;
  }
};

export const ensureUserExistsForAssets = async (targetEmployeeId, userPayload) => {
  const { data: userCheck } = await supabase
    .from('users')
    .select('emp_id')
    .eq('emp_id', targetEmployeeId)
    .maybeSingle();

  if (!userCheck) {
    const { error: createUserError } = await supabase
      .from('users')
      .insert([userPayload]);

    if (createUserError) {
      console.error("Failed to auto-create user in 'users' table:", createUserError);
      throw new Error(`Failed to create user record: ${createUserError.message}`);
    }
  }
};

export const saveAfterJoiningChecklist = async (joiningNo, upsertData) => {
  const { data: existing, error: existError } = await supabase
    .from('after_joining')
    .select('id')
    .eq('joining_id', joiningNo)
    .limit(1);

  if (existError) throw existError;

  let result;
  if (existing && existing.length > 0) {
    result = await supabase
      .from('after_joining')
      .update(upsertData)
      .eq('id', existing[0].id);
  } else {
    result = await supabase
      .from('after_joining')
      .insert([upsertData]);
  }

  if (result.error) {
    throw new Error(`Supabase error: ${result.error.message}`);
  }
  return result;
};
