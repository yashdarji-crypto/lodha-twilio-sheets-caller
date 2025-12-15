const express = require('express');
const router = express.Router();
const controller = require('../controllers/callController');

router.post('/initiate-call', controller.initiateCall);
router.post('/call-status', controller.callStatus);
router.get('/get-next-customer', controller.getNextCustomer);
router.get('/call-script', controller.callScript);
router.post('/handle-input', controller.handleInput);
router.post('/save-response', controller.saveResponse);
router.get('/leads', controller.listLeads);

module.exports = router;
