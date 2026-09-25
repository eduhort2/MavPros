import { createHmac, createPublicKey, timingSafeEqual, verify as verifySignature } from 'node:crypto';
import { cookies } from 'next/headers';
const cookieName='mav_session';
const b64=(v:Buffer|string)=>Buffer.from(v).toString('base64url');
const parse=(v:string)=>JSON.parse(Buffer.from(v,'base64url').toString('utf8'));
function secret(){const v=process.env.SESSION_SECRET;if(!v||v.length<32)throw Error('SESSION_SECRET não configurado (mínimo 32 caracteres).');return v;}
function signature(v:string){return b64(createHmac('sha256',secret()).update(v).digest());}
export function makeSession(email:string){const payload=b64(JSON.stringify({email,exp:Math.floor(Date.now()/1000)+7*86400}));return `${payload}.${signature(payload)}`;}
export async function sessionEmail(){
 const value=(await cookies()).get(cookieName)?.value;
 if(!value)return null;
 const [payload,mac]=value.split('.');if(!payload||!mac)return null;
 const expected=signature(payload);if(mac.length!==expected.length||!timingSafeEqual(Buffer.from(mac),Buffer.from(expected)))return null;
 try{const data=parse(payload);return data.exp>Date.now()/1000&&typeof data.email==='string'?data.email.toLowerCase():null}catch{return null}
}
export const sessionCookie={name:cookieName,httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax' as const,path:'/',maxAge:7*86400};
export async function verifyGoogleCredential(token:string){
 const parts=token.split('.');if(parts.length!==3)throw Error('Credencial inválida.');
 const header=parse(parts[0]);const claims=parse(parts[1]);
 if(header.alg!=='RS256'||!header.kid)throw Error('Credencial inválida.');
 const response=await fetch('https://www.googleapis.com/oauth2/v3/certs',{cache:'no-store'});
 if(!response.ok)throw Error('Falha ao verificar acesso Google.');
 const {keys}=await response.json() as {keys:Array<JsonWebKey&{kid?:string}>};
 const jwk=keys.find(k=>k.kid===header.kid);if(!jwk)throw Error('Credencial desconhecida.');
 const valid=verifySignature('RSA-SHA256',Buffer.from(`${parts[0]}.${parts[1]}`),createPublicKey({key:jwk as unknown as import('node:crypto').JsonWebKey,format:'jwk'}),Buffer.from(parts[2],'base64url'));
 const clientId=process.env.GOOGLE_CLIENT_ID;
 if(!valid||!clientId||claims.aud!==clientId||!['accounts.google.com','https://accounts.google.com'].includes(claims.iss)||claims.exp<Date.now()/1000||claims.email_verified!==true||typeof claims.email!=='string')throw Error('Credencial expirada ou inválida.');
 return claims.email.trim().toLowerCase() as string;
}
