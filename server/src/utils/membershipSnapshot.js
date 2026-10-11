'use strict';
function membershipSnapshot(student) {
  const civil = value => value ? new Date(value).toISOString().slice(0, 10) : null;
  return { planId: student.planId ?? null, planStartDate: civil(student.planStartDate), planEndDate: civil(student.planEndDate),
    status: student.status, membershipRevision: student.membershipRevision ?? 0, userActive: student.user?.active ?? true };
}
function membershipGrant(student, changes, durationDays, applied = true) {
  const before = membershipSnapshot(student);
  const after = applied ? membershipSnapshot({ ...student, ...changes, membershipRevision: before.membershipRevision + 1 }) : { ...before };
  return { version: 1, durationDays, applied, before, after };
}
module.exports = { membershipSnapshot, membershipGrant };
