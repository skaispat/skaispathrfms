export const calculateLeaveSplitsDayByDay = (
    leaveType,
    startDateStr,
    endDateStr,
    usedEL = 0,
    usedCL = 0,
    carriedForwardEL = 0
) => {
    if (!startDateStr || !endDateStr) {
        return { casual: 0, earned: 0, unpaid: 0, warning: null, note: null };
    }

    let start = new Date(startDateStr);
    let end = new Date(endDateStr);

    // Enforce end date >= start date
    if (end < start) {
        end = new Date(start);
    }

    const diffTime = Math.abs(end - start);
    const appliedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    if (leaveType === 'UnPaid Leave') {
        return {
            casual: 0,
            earned: 0,
            unpaid: appliedDays,
            warning: `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपने LWP (बिना वेतन की छुट्टी) का चयन किया है। आपके पूरे ${appliedDays} दिन का वेतन काटा जाएगा।`,
            note: null
        };
    }

    let instanceCLUsed = 0;
    let instanceELUsed = 0;
    let instanceLWPUsed = 0;

    let currentDate = new Date(start);

    for (let i = 0; i < appliedDays; i++) {
        // Calculate fiscal month index for currentDate (April = 1, March = 12)
        const month = currentDate.getMonth();
        const fyMonthIndex = month >= 3 ? month - 2 : month + 10;

        const accruedEL = fyMonthIndex * 2 + carriedForwardEL;
        const accruedCL = fyMonthIndex * 1;

        const availCL = Math.max(0, accruedCL - usedCL - instanceCLUsed);
        const availEL = Math.max(0, accruedEL - usedEL - instanceELUsed);

        const totalPaidThisInstance = instanceCLUsed + instanceELUsed;

        if (totalPaidThisInstance < 10) {
            if (availCL > 0 && instanceCLUsed < 3) {
                instanceCLUsed++;
            } else if (availEL > 0) {
                instanceELUsed++;
            } else {
                instanceLWPUsed++;
            }
        } else {
            instanceLWPUsed++;
        }

        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
    }

    let warning = null;
    let note = null;

    const endMonth = end.getMonth();
    const endFyMonthIndex = endMonth >= 3 ? endMonth - 2 : endMonth + 10;
    const finalAccruedEL = endFyMonthIndex * 2 + carriedForwardEL;
    const finalAccruedCL = endFyMonthIndex * 1;
    const totalAvailableEL = Math.max(0, finalAccruedEL - usedEL);
    const totalAvailableCL = Math.max(0, finalAccruedCL - usedCL);

    if (instanceLWPUsed > 0) {
        warning = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। इस अवधि के दौरान आपके पास केवल ${instanceCLUsed + instanceELUsed} छुट्टियां (EL: ${instanceELUsed}, CL: ${instanceCLUsed}) उपलब्ध हैं। आपके अतिरिक्त ${instanceLWPUsed} दिन LWP (बिना वेतन) माने जाएंगे।`;
    } else {
        note = `आपने कुल ${appliedDays} दिन की छुट्टी के लिए आवेदन किया है। आपके पास पर्याप्त छुट्टियां (EL: ${totalAvailableEL}, CL: ${totalAvailableCL}) उपलब्ध हैं। आपके वेतन से कोई कटौती नहीं होगी।`;
    }

    return {
        casual: instanceCLUsed,
        earned: instanceELUsed,
        unpaid: instanceLWPUsed,
        warning,
        note
    };
};
