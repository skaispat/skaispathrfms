import { supabase } from '../supabaseClient';

export const getTotalLeaveDetailsData = async (fiscalYear) => {
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("emp_id, full_name, department, designation")
    .order("full_name");
  if (userError) throw userError;

  const { data: leaveData, error: leaveError } = await supabase
    .from("leave_management")
    .select("*")
    .order("leave_date_start", { ascending: false });
  if (leaveError) throw leaveError;

  const { data: quotaData, error: quotaError } = await supabase
    .from("yearly_quota")
    .select("*")
    .eq("year", fiscalYear);
  if (quotaError) throw quotaError;

  return {
    users: userData || [],
    leaves: leaveData || [],
    quotaData: quotaData || []
  };
};

export const updateTotalLeaveRecordAndQuota = async (recordId, empId, tempRecordData, deltaCasual, deltaEarned, deltaUnpaid, currentYear) => {
  const { error: updateError } = await supabase
    .from("leave_management")
    .update({
      casual: tempRecordData.casual,
      earned: tempRecordData.earned,
      unpaid: tempRecordData.unpaid,
    })
    .eq("id", recordId);

  if (updateError) throw updateError;

  const { data: q } = await supabase
    .from("yearly_quota")
    .select("*")
    .eq("emp_id", empId)
    .eq("year", currentYear)
    .maybeSingle();

  if (q) {
    let updatePayload = {};

    if (deltaCasual !== 0) {
      updatePayload.casual_leave_used = (q.casual_leave_used || 0) + deltaCasual;
    }

    if (deltaUnpaid !== 0) {
      updatePayload.unpaid_leave_used = (q.unpaid_leave_used || 0) + deltaUnpaid;
    }

    if (deltaEarned !== 0) {
      if (deltaEarned > 0) {
        const carried = q.carried_forward_el || 0;
        if (carried >= deltaEarned) {
          updatePayload.carried_forward_el = carried - deltaEarned;
        } else {
          updatePayload.carried_forward_el = 0;
          updatePayload.earned_leave_used = (q.earned_leave_used || 0) + (deltaEarned - carried);
        }
      } else {
        const absDelta = Math.abs(deltaEarned);
        const used = q.earned_leave_used || 0;
        if (used >= absDelta) {
          updatePayload.earned_leave_used = used - absDelta;
        } else {
          updatePayload.earned_leave_used = 0;
          updatePayload.carried_forward_el = (q.carried_forward_el || 0) + (absDelta - used);
        }
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      await supabase.from("yearly_quota").update(updatePayload).eq("id", q.id);
    }
  }
};
