'use strict';
module.exports = async function settledBatch(promises) {
  const results = await Promise.allSettled(promises);
  const failures = results.filter(result => result.status === 'rejected').map(result => result.reason);
  if (failures.length) {
    const error = new AggregateError(failures, 'Concurrent test operations failed after all settled');
    error.failureCodes = failures.map(failure => {
      const code = String(failure?.code || failure?.statusCode || failure?.name || 'unknown');
      return /^[A-Za-z0-9_]{1,40}$/.test(code) ? code : 'omitted';
    });
    throw error;
  }
  return results.map(result => result.value);
};
