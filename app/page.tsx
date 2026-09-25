'use client';
import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, CircleHelp, ClipboardList, Clock3, LayoutDashboard, Plus, Send, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Client = { id: string; name: string };
type Task = { id: string; clientId: string; title: string; detail: string; status: string; origin: string; createdAt: string; updatedAt: string };
type Data = { me: { email: string; role: string; clientId: string | null }; clients: Client[]; tasks: Task[]; members: { id: string; email: string; clientId: string | null }[] };
const states: Record<string, string> = { solicitada: 'Solicitada', a_fazer: 'A fazer', em_andamento: 'Em andamento', concluida: 'Concluída' };
const stateOrder = ['solicitada', 'a_fazer', 'em_andamento', 'concluida'];
const date = (s: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? s : new Date(s).toLocaleDateString('pt-BR');

export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState('');
  const [tab, setTab] = useState('todas');
  const [dialog, setDialog] = useState<'task' | 'client' | 'access' | null>(null);
  const [title, setTitle] = useState(''); const [detail, setDetail] = useState('');
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const admin = data?.me.role === 'admin';
  async function reload() {
    try { const res = await fetch('/api/data', { cache: 'no-store' }); const json = await res.json() as Data & { error?: string }; if (!res.ok) throw Error(json.error); setData(json); setError(''); setClientId(v => v || String(json.me.role === 'admin' ? json.clients[0]?.id || '' : json.me.clientId || '')); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao carregar.'); }
  }
  useEffect(() => { void reload(); const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: object, options: { signal: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool || !data) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: 'list_client_actions', title: 'Listar ações', description: 'Lista as ações visíveis no portal para o cliente selecionado.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async () => ({ client: current?.name || '', actions: subset.map(t => ({ id: t.id, title: t.title, status: t.status })) }),
    }, { signal: lifecycle.signal })).catch(() => {});
    return () => lifecycle.abort();
  }, [data, clientId]);
  async function save(body: Record<string, unknown>) {
    setBusy(true); setError('');
    try { const res = await fetch('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const json = await res.json() as { error?: string }; if (!res.ok) throw Error(json.error); setDialog(null); setTitle(''); setDetail(''); setName(''); setEmail(''); await reload(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Falha ao salvar.'); }
    finally { setBusy(false); }
  }
  const current = data?.clients.find(c => String(c.id) === clientId);
  const subset = useMemo(() => (data?.tasks || []).filter(t => t.clientId === clientId), [data, clientId]);
  const visible = subset.filter(t => tab === 'todas' || t.status === tab);
  const counts = Object.fromEntries(stateOrder.map(s => [s, subset.filter(t => t.status === s).length]));
  if (!data && error.includes('Entre com uma conta Google')) return <Login onSuccess={() => void reload()}/>;
  return <div className="portal">
    <aside className="rail">
      <div className="brand"><span className="brand-icon">M</span><span>MaVPros<span className="brand-suffix">.</span><small>PORTAL DO CLIENTE</small></span></div>
      <div className="rail-section">ESPAÇO DE TRABALHO</div>
      <div className="rail-link active"><LayoutDashboard size={18}/> Visão geral</div>
      <div className="rail-link"><ClipboardList size={18}/> Ações <span className="rail-count">{subset.length}</span></div>
      {admin && <div className="rail-link" onClick={() => setDialog('access')} role="button" tabIndex={0}><Settings2 size={18}/> Acessos</div>}
      <div className="rail-bottom"><div className="avatar">{data?.me.email?.slice(0, 1).toUpperCase() || 'M'}</div><div><strong>{admin ? 'Equipe MaVPros' : 'Área do cliente'}</strong><small>{data?.me.email || 'Acesso protegido'}</small></div><button className="logout" onClick={async () => { await fetch('/api/auth', { method: 'DELETE' }); window.location.reload(); }}>Sair</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><span><span className="green-dot"/> Portal de acompanhamento</span><span className="topbar-right">MaVPros <span>/</span> {current?.name || 'Visão geral'}</span></header>
      <div className="content">
        <div className="heading"><div><span className="eyebrow">VISÃO GERAL</span><h1>{admin ? 'Acompanhe cada ação.' : 'Seu trabalho em andamento.'}</h1><p>Veja as próximas entregas, acompanhe o progresso e envie novas solicitações.</p></div><button className="primary" onClick={() => setDialog('task')} disabled={!current}><Plus size={18}/> {admin ? 'Nova ação' : 'Fazer solicitação'}</button></div>
        {error && <div className="notice error" role="alert">{error} <button onClick={() => void reload()}>Tentar novamente</button></div>}
        {!data && !error && <div className="notice">Carregando suas informações...</div>}
        {data && <>
          {admin && <div className="clientbar"><div><span className="label">CLIENTE</span><Select value={clientId} onValueChange={v => setClientId(v || '')}><SelectTrigger className="client-select"><SelectValue placeholder="Selecione um cliente"/></SelectTrigger><SelectContent>{data.clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent></Select></div><button className="textbutton" onClick={() => setDialog('client')}><Plus size={16}/> Cadastrar cliente</button></div>}
          {current ? <>
            <div className="summary-grid">
              <div className="summary-card"><span className="summary-icon dark"><ClipboardList size={20}/></span><div><span className="summary-label">A fazer</span><strong>{counts.a_fazer}</strong><small>Ações planejadas</small></div></div>
              <div className="summary-card"><span className="summary-icon lime"><Clock3 size={20}/></span><div><span className="summary-label">Em andamento</span><strong>{counts.em_andamento}</strong><small>Em execução pela equipe</small></div></div>
              <div className="summary-card"><span className="summary-icon light"><Check size={20}/></span><div><span className="summary-label">Concluídas</span><strong>{counts.concluida}</strong><small>Entregas finalizadas</small></div></div>
              <div className="summary-card"><span className="summary-icon pale"><Send size={20}/></span><div><span className="summary-label">Solicitações</span><strong>{counts.solicitada}</strong><small>Aguardando análise</small></div></div>
            </div>
            <section className="work"><div className="sectionhead"><div><span className="eyebrow">ATIVIDADES</span><h2>Ações de {current.name}</h2></div><span className="total">{subset.length} {subset.length === 1 ? 'ação registrada' : 'ações registradas'}</span></div>
              <Tabs value={tab} onValueChange={setTab}><TabsList className="filter-tabs"><TabsTrigger value="todas">Todas</TabsTrigger><TabsTrigger value="solicitada">Solicitadas</TabsTrigger><TabsTrigger value="a_fazer">A fazer</TabsTrigger><TabsTrigger value="em_andamento">Em andamento</TabsTrigger><TabsTrigger value="concluida">Concluídas</TabsTrigger></TabsList></Tabs>
              <div className="tasklist">{visible.length ? visible.map(t => <article className="task" key={t.id}><div className={'task-marker '+t.status}/><div className="task-body"><div className="task-line"><h3>{t.title}</h3><span className={'badge '+t.status}>{states[t.status]}</span></div>{t.detail && <p>{t.detail}</p>}<div className="taskmeta">{t.origin === 'cliente' ? 'Solicitação do cliente' : 'Ação da equipe'} <span>·</span> Criada em {date(t.createdAt)}{t.updatedAt !== t.createdAt && <> <span>·</span> Atualizada em {date(t.updatedAt)}</>}</div></div>{admin && <Select value={t.status} onValueChange={v => void save({ kind: 'status', id: t.id, status: v })}><SelectTrigger className="status-select"><SelectValue/></SelectTrigger><SelectContent>{stateOrder.map(s => <SelectItem key={s} value={s}>{states[s]}</SelectItem>)}</SelectContent></Select>}</article>) : <div className="empty"><CircleHelp size={28}/><strong>{tab === 'todas' ? 'Nenhuma ação registrada ainda' : 'Nenhuma ação nesta etapa'}</strong><p>{tab === 'todas' ? (admin ? 'Cadastre a primeira ação para este cliente.' : 'Quando a equipe registrar uma ação, ela aparecerá aqui.') : 'As ações aparecerão aqui quando chegarem a esta etapa.'}</p></div>}</div>
            </section>
          </> : <div className="empty large"><ClipboardList size={30}/><strong>Comece cadastrando um cliente</strong><p>Depois, adicione ações e libere o acesso individual pelo e-mail.</p><button className="primary" onClick={() => setDialog('client')}><Plus size={17}/> Cadastrar cliente</button></div>}
          {admin && <div className="integration"><div><span className="integration-icon">↗</span><div><strong>Planilha Google conectada</strong><p>Clientes, ações e solicitações são lidos e atualizados nesta planilha.</p></div></div><span className="pending">Sincronizada</span></div>}
        </>}
      </div>
    </main>
    <Dialog open={dialog === 'task'} onOpenChange={v => !v && setDialog(null)}><DialogContent className="modal"><DialogHeader><DialogTitle>{admin ? 'Nova ação' : 'Nova solicitação'}</DialogTitle></DialogHeader><p>{admin ? `Registre o que a equipe fará para ${current?.name}.` : 'Descreva o que você precisa. A equipe verá sua solicitação.'}</p><label>Título<input value={title} onChange={e => setTitle(e.target.value)} maxLength={160} placeholder="Ex.: Revisar anúncios da curva A"/></label><label>Detalhes (opcional)<textarea value={detail} onChange={e => setDetail(e.target.value)} maxLength={1000} rows={4} placeholder="Inclua links, anúncios ou contexto relevante"/></label>{error && <span className="form-error">{error}</span>}<button className="primary full" disabled={busy || !title.trim()} onClick={() => void save({ kind: 'task', clientId, title, detail })}>{busy ? 'Salvando...' : admin ? 'Registrar ação' : 'Enviar solicitação'} <ArrowRight size={17}/></button></DialogContent></Dialog>
    <Dialog open={dialog === 'client'} onOpenChange={v => !v && setDialog(null)}><DialogContent className="modal"><DialogHeader><DialogTitle>Cadastrar cliente</DialogTitle></DialogHeader><label>Nome da conta ou empresa<input value={name} onChange={e => setName(e.target.value)} maxLength={100} placeholder="Ex.: Loja Exemplo"/></label>{error && <span className="form-error">{error}</span>}<button className="primary full" disabled={busy || name.trim().length < 2} onClick={() => void save({ kind: 'client', name })}>Salvar cliente</button></DialogContent></Dialog>
    <Dialog open={dialog === 'access'} onOpenChange={v => !v && setDialog(null)}><DialogContent className="modal"><DialogHeader><DialogTitle>Acesso do cliente</DialogTitle></DialogHeader><p>Cadastre o e-mail que poderá ver as ações de {current?.name}. O cliente entra com esta conta Google e vê apenas as ações da sua empresa.</p><label>E-mail do cliente<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@empresa.com"/></label><button className="primary full" disabled={busy || !current || !email.includes('@')} onClick={() => void save({ kind: 'member', clientId, email })}>Cadastrar acesso</button><div className="memberlist">{data?.members.filter(m => m.clientId === clientId).map(m => <span key={m.id}>{m.email}</span>)}</div></DialogContent></Dialog>
  </div>;
}

function Login({onSuccess}:{onSuccess:()=>void}) {
 const [message,setMessage]=useState('');
 useEffect(()=>{
  let active=true;let script:HTMLScriptElement|null=null;
  async function setup(){
   try {
    const config=await (await fetch('/api/auth')).json() as {clientId:string|null};
    if(!config.clientId){setMessage('Configure GOOGLE_CLIENT_ID na Vercel para ativar o acesso.');return;}
    script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;
    script.onload=()=>{if(!active)return;
     const google=(window as Window & {google?:{accounts:{id:{initialize:(v:object)=>void;renderButton:(el:HTMLElement,v:object)=>void}}}}).google;
     google?.accounts.id.initialize({client_id:config.clientId,callback:async ({credential}:{credential:string})=>{
      try {const res=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential})});const json=await res.json() as {error?:string};if(!res.ok)throw Error(json.error);onSuccess();}
      catch(e){setMessage(e instanceof Error?e.message:'Falha ao entrar.')}
     }});
     const target=document.getElementById('google-login');if(target)google?.accounts.id.renderButton(target,{theme:'outline',size:'large',text:'signin_with',width:280});
    };
    document.head.appendChild(script);
   }catch{setMessage('Não foi possível carregar o acesso Google.');}
  }
  void setup();return()=>{active=false;script?.remove();};
 },[onSuccess]);
 return <main className="login-page"><section className="login-card"><span className="brand-icon">M</span><span className="eyebrow">PORTAL MAVPROS</span><h1>Acompanhe suas ações.</h1><p>Entre com o e-mail autorizado para ver o andamento e enviar solicitações.</p><div id="google-login"/><div className="login-message">{message}</div></section></main>
}
