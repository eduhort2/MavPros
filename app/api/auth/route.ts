import { NextResponse } from 'next/server';
import { makeSession, sessionCookie, verifyGoogleCredential } from '@/lib/auth';
import { getRows } from '@/lib/sheets';
export const runtime='nodejs';
export async function GET(){return Response.json({clientId:process.env.GOOGLE_CLIENT_ID||null});}
export async function POST(request:Request){
 const origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Origem não autorizada.'},{status:403});
 try{
  const {credential}=await request.json() as {credential?:string};if(!credential)return Response.json({error:'Credencial ausente.'},{status:400});
  const email=await verifyGoogleCredential(credential);
  const admin=(process.env.ADMIN_EMAIL||'').toLowerCase();
  if(email!==admin){const clients=await getRows('Clientes');if(!clients.some(r=>r.cells[2]?.trim().toLowerCase()===email&&r.cells[3]!=='Inativo'))return Response.json({error:'Este e-mail ainda não foi cadastrado para acesso.'},{status:403});}
  const result=NextResponse.json({ok:true});result.cookies.set(sessionCookie.name,makeSession(email),sessionCookie);return result;
 }catch(e){console.error(e);return Response.json({error:e instanceof Error?e.message:'Não foi possível entrar.'},{status:401});}
}
export async function DELETE(){const result=NextResponse.json({ok:true});result.cookies.set(sessionCookie.name,'',{...sessionCookie,maxAge:0});return result;}
