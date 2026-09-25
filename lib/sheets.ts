import { createSign } from 'node:crypto';
const sheetId=()=>{const id=process.env.GOOGLE_SHEET_ID;if(!id)throw Error('GOOGLE_SHEET_ID não configurado.');return id};
let cached:{token:string,expires:number}|null=null;
const enc=(v:string)=>Buffer.from(v).toString('base64url');
async function accessToken(){
 if(cached&&cached.expires>Date.now()+60000)return cached.token;
 const email=process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,key=process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g,'\n');
 if(!email||!key)throw Error('Credenciais de serviço do Google não configuradas.');
 const now=Math.floor(Date.now()/1000);
 const header=enc(JSON.stringify({alg:'RS256',typ:'JWT'}));
 const body=enc(JSON.stringify({iss:email,scope:'https://www.googleapis.com/auth/spreadsheets',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
 const sign=createSign('RSA-SHA256');sign.update(`${header}.${body}`);sign.end();
 const assertion=`${header}.${body}.${sign.sign(key).toString('base64url')}`;
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion})});
 if(!response.ok)throw Error('A conta de serviço não conseguiu autenticar no Google.');
 const data=await response.json() as {access_token:string,expires_in:number};cached={token:data.access_token,expires:Date.now()+data.expires_in*1000};return data.access_token;
}
async function api(path:string,method='GET',body?:unknown){
 const response=await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId()}${path}`,{method,headers:{Authorization:`Bearer ${await accessToken()}`,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,cache:'no-store'});
 if(!response.ok){console.error('Sheets API',response.status,await response.text());throw Error(response.status===403?'Sem acesso à planilha. Compartilhe com a conta de serviço como Editora.':'Não foi possível acessar a planilha Google.');}
 return response.json() as Promise<{values?:string[][]}>;
}
const range=(v:string)=>`/values/${encodeURIComponent(v)}`;
export async function getRows(tab:'Clientes'|'Ações'){
 const response=await api(range(`'${tab}'!A1:${tab==='Clientes'?'D':'J'}`));
 const rows=response.values??[];
 const expected=tab==='Clientes'?['ID do cliente','Nome da conta','E-mail de acesso','Situação']:['ID da ação','ID do cliente','Conta','Origem','Título da ação','Detalhes e links','Status','Data de criação','Última atualização','Responsável'];
 if(!expected.every((v,i)=>rows[0]?.[i]===v))throw Error(`Cabeçalhos da aba ${tab} diferentes do modelo.`);
 return rows.slice(1).map((cells,i)=>({row:i+2,cells})).filter(r=>r.cells[0]);
}
export async function appendRow(tab:'Clientes'|'Ações',cells:(string|number)[]){await api(`${range(`'${tab}'!A1`)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,'POST',{values:[cells]});}
export async function updateCell(tab:'Clientes'|'Ações',cell:string,value:string){await api(`${range(`'${tab}'!${cell}`)}?valueInputOption=RAW`,'PUT',{values:[[value]]});}
export function today(){return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date());}
