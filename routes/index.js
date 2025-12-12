// ============================================
// FILE: routes/index.js
// UPDATE YOUR ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const controller = require('../controllers/callController');

// NEW: Called by Google Apps Script
router.post('/initiate-call', controller.initiateCall);
router.post('/call-status', controller.callStatus);

// Existing routes
router.get('/get-next-customer', controller.getNextCustomer);
router.get('/call-script', controller.callScript);
router.post('/handle-input', controller.handleInput);
router.post('/save-response', controller.saveResponse);
router.get('/leads', controller.listLeads);

module.exports = router;