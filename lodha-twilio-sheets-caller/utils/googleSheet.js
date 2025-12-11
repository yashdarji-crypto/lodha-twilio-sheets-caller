// Simple wrapper that calls the Google Apps Script WebApp URL
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const SHEET_API = process.env.SHEET_WEBAPP_URL;

async function getNextCustomer() {
  const url = `${SHEET_API}?action=getNextCustomer`;
  const res = await fetch(url);
  return res.json();
}

async function getLeadById(id) {
  const url = `${SHEET_API}?action=getById&id=${encodeURIComponent(id)}`;
  const res = await fetch(url);
  const data = await res.json();
  return data;
}

async function updateLead(payload) {
  const url = `${SHEET_API}?action=updateLead`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}

async function listLeads() {
  const url = `${SHEET_API}?action=listLeads`;
  const res = await fetch(url);
  return res.json();
}

module.exports = {
  getNextCustomer,
  getLeadById,
  updateLead,
  listLeads
};
