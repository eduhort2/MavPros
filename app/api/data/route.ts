import { randomUUID } from 'node:crypto';
import { sessionEmail } from '@/lib/auth';
import { appendRow,getRows,today,updateCell } from '@/lib/sheets';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const statuses:Record<string,string>={solicitada:'Solicitada',a_fazer:'A fazer',em_andamento:'Em andamento',concluida:'Concluída'};
const reverse=Object.fromEntries(Object.entries(statuses).map(([k,v])=>[v,k]));
const fail=(error:string,status:number)=>Response.json({error},{status});
const adminEmail=()=>process.env.ADMIN_EMAIL?.trim().toLowerCase()||'';
async function identity(){const email=await sessionEmail();if(!email)return null;const admin=email===adminEmail();const rows=await getRows('Clientes');const clients=rows.map(({row,cells})=>({row,id:cells[0],name:cells[1],email:(cells[2]||'').trim().toLowerCase(),situation:cells[3]||'Ativo'})).filter(c=>c.id&&c.name&&c.situation!=='Inativo');if(new Set(clients.map(c=>c.id)).size!==clients.length)throw Error('Há IDs de cliente repetidos na planilha. Corrija antes de continuar.');const mine=clients.filter(c=>c.email===email);if(!admin&&!mine.length)return null;return {email,admin,clients,mine};}
function originValid(request:Request){const origin=request.headers.get('origin');return !origin||origin===new URL(request.url).origin;}
export async function GET(){try{
 const me=await identity();if(!me)return fail('Entre com uma conta Google autorizada.',401);
 const actions=await getRows('Ações');const allowed=new Set((me.admin?me.clients:me.mine).map(c=>c.id));
 const tasks=actions.map(({cells})=>({id:cells[0],clientId:cells[1],title:cells[4]||'',detail:cells[5]||'',status:reverse[cells[6]]||'a_fazer',origin:cells[3]==='Cliente'?'cliente':'equipe',createdAt:cells[7]||'',updatedAt:cells[8]||''})).filter(t=>allowed.has(t.clientId));
 return Response.json({me:{email:me.email,role:me.admin?'admin':'client',clientId:me.admin?null:me.mine[0].id},clients:(me.admin?me.clients:me.mine).map(c=>({id:c.id,name:c.name})),tasks,members:me.admin?me.clients.filter(c=>c.email).map(c=>({id:c.id,email:c.email,clientId:c.id})):[]});
 }catch(e){console.error(e);return fail(e instanceof Error?e.message:'Falha ao carregar.',500);}}
export async function POST(request:Request){if(!originValid(request))return fail('Origem não autorizada.',403);try{
 const me=await identity();if(!me)return fail('Entre com uma conta Google autorizada.',401);
 const body=await request.json() as Record<string,unknown>;const kind=String(body.kind||'');const date=today();
 if(kind==='client'&&me.admin){const name=String(body.name||'').trim();if(name.length<2||name.length>100)return fail('Informe o nome do cliente.',400);await appendRow('Clientes',[randomUUID(),name,'','Ativo']);}
 else if(kind==='member'&&me.admin){const email=String(body.email||'').trim().toLowerCase();const client=me.clients.find(c=>c.id===String(body.clientId));if(!client||!/^\S+@\S+\.\S+$/.test(email))return fail('Cliente ou e-mail inválido.',400);await updateCell('Clientes',`C${client.row}`,email);}
 else if(kind==='task'){
  const clientId=me.admin?String(body.clientId):me.mine[0].id;
  const client=(me.admin?me.clients:me.mine).find(c=>c.id===clientId);const title=String(body.title||'').trim(),detail=String(body.detail||'').trim();
  if(!client||title.length<3||title.length>160||detail.length>1000)return fail('Preencha o título da ação.',400);
  await appendRow('Ações',[randomUUID(),client.id,client.name,me.admin?'Equipe':'Cliente',title,detail,me.admin?'A fazer':'Solicitada',date,date,me.email]);
 }else if(kind==='status'&&me.admin){
  const status=statuses[String(body.status)];if(!status)return fail('Status inválido.',400);
  const target=(await getRows('Ações')).find(r=>r.cells[0]===String(body.id));if(!target)return fail('Ação não encontrada.',404);
  await updateCell('Ações',`G${target.row}`,status);await updateCell('Ações',`I${target.row}`,date);
 }else return fail('Ação não autorizada.',403);
 return Response.json({ok:true});
 }catch(e){console.error(e);return fail(e instanceof Error?e.message:'Falha ao salvar.',500);}}
