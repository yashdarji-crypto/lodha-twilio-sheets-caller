const twilio = require('twilio');
const { VoiceResponse } = require('twilio').twiml;
const sheetService = require('../utils/googleSheet');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ============================================
// NEW ENDPOINT: Initiate outbound call
// Called by Google Apps Script
// ============================================
exports.initiateCall = async (req, res) => {
  try {
    const { customer_id, phone } = req.body;
    
    if (!customer_id || !phone) {
      return res.status(400).json({ 
        success: false, 
        error: 'customer_id and phone required' 
      });
    }

    console.log(`Initiating call for customer ${customer_id} to ${phone}`);

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
      timeout: 30,
      record: false
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

// ============================================
// NEW ENDPOINT: Call status callback
// Twilio calls this when call completes
// ============================================
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
      newStatus = 'PENDING'; // Will retry later
      response = `NO_ANSWER_${callStatus}`;
    } else if (callStatus === 'failed') {
      newStatus = 'FAILED';
      response = 'CALL_FAILED';
    }

    // Only update if customer didn't already respond
    // (If they pressed 1 or 2, that takes precedence)
    const customer = await sheetService.getLeadById(customerId);
    
    if (customer && customer.status === 'IN_PROGRESS') {
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

// ============================================
// EXISTING ENDPOINTS (Keep these as-is)
// ============================================

exports.getNextCustomer = async (req, res) => {
  try {
    const customer = await sheetService.getNextCustomer();
    if (!customer || !customer.phone) return res.json({ phone: null });
    res.json({
      phone: customer.phone,
      customer_id: customer.id,
      project: customer.project,
      language: customer.language,
      script_url: `/call-script?customer_id=${customer.id}`
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal' });
  }
};

exports.callScript = async (req, res) => {
  try {
    const id = req.query.customer_id;
    if (!id) return res.status(400).send('customer_id required');

    const customer = await sheetService.getLeadById(id);
    if (!customer) return res.status(404).send('not found');

    const twiml = new VoiceResponse();

    const msgEN = `Hello! This is Lodha Group regarding your enquiry for ${customer.project}. Press 1 for yes, 2 for no.`;
    const msgHI = `Namaste! Lodha Group aapko call kar raha hai regarding ${customer.project}. Press 1 for haan, 2 for nahin.`;

    const message = (customer.language === 'HI') ? msgHI : msgEN;

    const gather = twiml.gather({
      input: 'dtmf speech',
      numDigits: 1,
      timeout: 5,
      action: `${process.env.BASE_URL || ''}/handle-input?cid=${customer.id}`,
      method: 'POST'
    });
    gather.say(message);

    twiml.say('We did not receive any input. Thank you.');

    res.set('Content-Type', 'text/xml');
    res.send(twiml.toString());
  } catch (err) {
    console.error(err);
    res.status(500).send('error');
  }
};

exports.handleInput = async (req, res) => {
  try {
    const customerId = req.query.cid;
    const digits = req.body.Digits;
    const speech = req.body.SpeechResult;
    const response = digits || speech || 'NO_INPUT';

    await sheetService.updateLead({
      id: customerId,
      status: 'DONE',
      response
    });

    const twiml = new VoiceResponse();
    twiml.say('Thank you for your response. Goodbye.');
    res.set('Content-Type', 'text/xml');
    res.send(twiml.toString());
  } catch (err) {
    console.error(err);
    res.status(500).send('error');
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
