'use strict';
function createNutricaoRepository(db) {
  const select = { inputs: true, formulaVersion: true, updatedAt: true };
  return {
    find: userId => db.nutritionScenario.findUnique({ where: { userId }, select }),
    save: (userId, data) => db.nutritionScenario.upsert({ where: { userId }, create: { userId, ...data }, update: data, select }),
    remove: userId => db.nutritionScenario.deleteMany({ where: { userId } }),
  };
}
module.exports = { createNutricaoRepository };
