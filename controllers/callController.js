// ============================================
// FILE: controllers/callController.js
// ADD THIS NEW ENDPOINT
// ============================================

const twilio = require('twilio');
const { VoiceResponse } = require('twilio').twiml;
const sheetService = require('../utils/googleSheet');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * NEW: Initiate outbound call
 * Called by Google Apps Script time trigger
 */
exports.initiateCall = async (req, res) => {
  try {
    const { customer_id, phone } = req.body;
    
    if (!customer_id || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'customer_id and phone required' 
      });
    }

    // Get customer details from sheet
    const customer = await sheetService.getLeadById(customer_id);
    
    if (!customer || !customer.id) {
      return res.status(404).json({ 
        success: false, 
        error: 'customer not found' 
      });
    }

    // Initiate Twilio call
    const call = await twilioClient.calls.create({
      to: phone,
      from: process.env.TWILIO_CALLER_ID,
      url: `${process.env.BASE_URL}/call-script?customer_id=${customer_id}`,
      method: 'GET',
      statusCallback: `${process.env.BASE_URL}/call-status?customer_id=${customer_id}`,
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
      statusCallbackMethod: 'POST',
      timeout: 30, // Ring timeout in seconds
      record: false // Set to true if you want to record calls
    });

    console.log(`✓ Call initiated: ${call.sid} for customer ${customer_id}`);

    res.json({
      success: true,
      call_sid: call.sid,
      customer_id: customer_id,
      status: 'initiated'
    });

  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
};

/**
 * Call Status Callback
 * Twilio calls this when call completes/fails
 */
exports.callStatus = async (req, res) => {
  try {
    const customerId = req.query.customer_id;
    const callStatus = req.body.CallStatus; // completed, no-answer, busy, failed
    const callDuration = req.body.CallDuration;
    const callSid = req.body.CallSid;

    console.log(`Call status for ${customerId}: ${callStatus} (Duration: ${callDuration}s)`);

    // Update lead based on call status
    let newStatus = 'DONE';
    let response = callStatus;

    if (callStatus === 'no-answer' || callStatus === 'busy') {
      newStatus = 'PENDING'; // Will retry
      response = `NO_ANSWER_${callStatus}`;
    } else if (callStatus === 'failed') {
      newStatus = 'FAILED';
      response = 'CALL_FAILED';
    }

    // Only update if customer didn't already respond
    // (If they pressed 1 or 2, that takes precedence)
    const customer = await sheetService.getLeadById(customerId);
    
    if (customer.status === 'IN_PROGRESS') {
      await sheetService.updateLead({
        id: customerId,
        status: newStatus,
        response: response
      });
    }

    res.sendStatus(200);

  } catch (error) {
    console.error('Error in call status callback:', error);
    res.sendStatus(500);
  }
};

/**
 * EXISTING: Generate call script (TwiML)
 * Twilio calls this when call connects
 */
exports.callScript = async (req, res) => {
  try {
    const id = req.query.customer_id;
    if (!id) return res.status(400).send('customer_id required');

    const customer = await sheetService.getLeadById(id);
    if (!customer || !customer.id) {
      return res.status(404).send('customer not found');
    }

    const twiml = new VoiceResponse();

    // Multi-language support
    const scripts = {
      EN: `Hello! This is Lodha Group calling regarding your inquiry for ${customer.project}. Press 1 if you are interested, or press 2 if you are not interested.`,
      HI: `Namaste! Lodha Group aapko ${customer.project} ke baare mein call kar raha hai. Agar interested hain toh 1 press karein, nahin interested hain toh 2 press karein.`,
      MR: `Namaskar! Lodha Group tumhala ${customer.project} baabat call karat ahe. Interest asel tar 1 press kara, nasel tar 2 press kara.`
    };

    const message = scripts[customer.language] || scripts.EN;

    // Gather customer response
    const gather = twiml.gather({
      input: 'dtmf', // digit input
      numDigits: 1,
      timeout: 5,
      action: `${process.env.BASE_URL}/handle-input?cid=${customer.id}`,
      method: 'POST'
    });
    
    gather.say({ voice: 'Polly.Aditi', language: 'hi-IN' }, message);

    // If no input received
    twiml.say('We did not receive any input. Thank you for your time. Goodbye.');

    res.set('Content-Type', 'text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error('Error generating call script:', error);
    res.status(500).send('error');
  }
};

/**
 * EXISTING: Handle customer input (DTMF response)
 * Twilio calls this when customer presses 1 or 2
 */
exports.handleInput = async (req, res) => {
  try {
    const customerId = req.query.cid;
    const digits = req.body.Digits;
    const response = digits || 'NO_INPUT';

    console.log(`Customer ${customerId} responded: ${response}`);

    // Update sheet with customer response
    await sheetService.updateLead({
      id: customerId,
      status: 'DONE',
      response: response === '1' ? 'INTERESTED' : response === '2' ? 'NOT_INTERESTED' : 'NO_INPUT'
    });

    const twiml = new VoiceResponse();
    
    if (response === '1') {
      twiml.say('Thank you for your interest! Our team will contact you soon. Goodbye.');
    } else if (response === '2') {
      twiml.say('Thank you for your time. Goodbye.');
    } else {
      twiml.say('Thank you. Goodbye.');
    }

    res.set('Content-Type', 'text/xml');
    res.send(twiml.toString());

  } catch (error) {
    console.error('Error handling input:', error);
    res.status(500).send('error');
  }
};

// ============================================
// EXISTING ENDPOINTS (Keep these)
// ============================================

exports.getNextCustomer = async (req, res) => {
  try {
    const customer = await sheetService.getNextCustomer();
    if (!customer || !customer.phone) return res.json({ phone: null });
    res.json({
      phone: customer.phone,
      customer_id: customer.id,
      project: customer.project,
      language: customer.language
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
};

exports.saveResponse = async (req, res) => {
  try {
    const { customer_id, response } = req.body;
    if (!customer_id) return res.status(400).json({ error: 'customer_id required' });
    await sheetService.updateLead({ id: customer_id, status: 'DONE', response });
    res.json({ saved: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
};

exports.listLeads = async (req, res) => {
  try {
    const leads = await sheetService.listLeads();
    res.json(leads);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
};