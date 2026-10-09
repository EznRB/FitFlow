const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const controller = require('../controllers/sessoes.controller');
router.use(authenticate, authorize('student'));
router.post('/start', controller.start);
router.post('/:id/sets', controller.addSet);
router.post('/:id/complete', controller.complete);
router.get('/mine', controller.mine);
module.exports = router;
