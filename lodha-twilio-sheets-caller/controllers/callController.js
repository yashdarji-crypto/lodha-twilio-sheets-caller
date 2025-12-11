const { VoiceResponse } = require('twilio').twiml;
const sheetService = require('../utils/googleSheet');

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
