function doGet(e){
  const action = e.parameter.action;
  if(action === "getNextCustomer") return getNextCustomer();
  if(action === "getById") return getLeadById(e.parameter.id);
  if(action === "listLeads") return listLeads();
  return ContentService.createTextOutput(JSON.stringify({error:"invalid_action"})).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e){
  const action = e.parameter.action;
  const body = JSON.parse(e.postData.contents || "{}");
  if(action === "updateLead") return updateLead(body);
  return ContentService.createTextOutput(JSON.stringify({error:"invalid_action"})).setMimeType(ContentService.MimeType.JSON);
}

function getSheet(){
  const ss = SpreadsheetApp.openById("YOUR_SHEET_ID");
  return ss.getSheetByName("Leads");
}

function getNextCustomer(){
  const sh = getSheet();
  const rows = sh.getDataRange().getValues();
  const headers = rows[0].map(h => String(h).trim());
  const statusIdx = headers.indexOf("status");
  if(statusIdx < 0) return json({error:"no_status_col"});
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][statusIdx]) === "PENDING"){
      const out = {};
      headers.forEach((h, idx) => out[h] = rows[i][idx]);
      return json(out);
    }
  }
  return json({phone:null});
}

function getLeadById(id){
  const sh = getSheet();
  const rows = sh.getDataRange().getValues();
  const headers = rows[0].map(h => String(h).trim());
  const idIdx = headers.indexOf("id");
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][idIdx]) === String(id)){
      const out = {};
      headers.forEach((h, idx) => out[h] = rows[i][idx]);
      return json(out);
    }
  }
  return json({});
}

function updateLead(body){
  const sh = getSheet();
  const rows = sh.getDataRange().getValues();
  const headers = rows[0].map(h => String(h).trim());
  const idIdx = headers.indexOf("id");
  const statusIdx = headers.indexOf("status");
  const respIdx = headers.indexOf("last_response");
  const attemptIdx = headers.indexOf("attempt_count");
  for(let i=1;i<rows.length;i++){
    if(String(rows[i][idIdx]) === String(body.id)){
      if(body.status) sh.getRange(i+1, statusIdx+1).setValue(body.status);
      if(body.response) sh.getRange(i+1, respIdx+1).setValue(body.response);
      if(attemptIdx >=0) {
        const curr = Number(rows[i][attemptIdx]) || 0;
        sh.getRange(i+1, attemptIdx+1).setValue(curr+1);
      }
      return json({success:true});
    }
  }
  return json({success:false});
}

function listLeads(){
  const sh = getSheet();
  const rows = sh.getDataRange().getValues();
  const headers = rows[0].map(h => String(h).trim());
  const out = [];
  for(let i=1;i<rows.length;i++){
    const obj = {};
    headers.forEach((h, idx) => obj[h] = rows[i][idx]);
    out.push(obj);
  }
  return json(out);
}

function json(o){
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
