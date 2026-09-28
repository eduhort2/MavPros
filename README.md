# Portal do Cliente MaVPros — Vercel + Google Sheets

Projeto Next.js pronto para publicar na Vercel. A planilha Google é a fonte dos dados: o portal lê as abas `Clientes` e `Ações`, grava novas ações e solicitações e atualiza status. Edições diretas na planilha aparecem no portal em até 30 segundos enquanto ele está aberto. Cada cliente entra com seu próprio Google e vê somente as contas vinculadas ao seu e-mail.

## Planilha conectada

O ID da planilha já está em `.env.example` (`GOOGLE_SHEET_ID`). Ela precisa manter estes cabeçalhos na primeira linha:

- `Clientes`: ID do cliente | Nome da conta | E-mail de acesso | Situação
- `Ações`: ID da ação | ID do cliente | Conta | Origem | Título da ação | Detalhes e links | Status | Data de criação | Última atualização | Responsável

Não renomeie abas ou cabeçalhos. Para uma nova conta, use **Cadastrar cliente** no portal; ele cria um ID único. Se cadastrar manualmente, use IDs diferentes. Em `Clientes`, preencha `E-mail de acesso` com o Google que o cliente usará. A situação pode ser `Ativo` ou `Inativo`. Solicitações do cliente entram em `Ações` com status `Solicitada`.

## Configuração do Google

1. No Google Cloud Console, crie um projeto e ative a **Google Sheets API**.
2. Crie uma **conta de serviço** sem chave e compartilhe a planilha com seu e-mail como **Editor**. Ative também as APIs **Security Token Service** e **IAM Service Account Credentials** no projeto Google.
3. Na Vercel, em **Settings → Security**, mantenha o emissor OIDC em modo **Team**. No Google Cloud, em **IAM e administrador → Federação de identidade da carga de trabalho**, crie um pool e provedor OIDC, ambos com ID `vercel`. Emissor: `https://oidc.vercel.com/SEU_TEAM_SLUG`. Use **Allowed audiences** com `https://vercel.com/SEU_TEAM_SLUG` e mapeie `google.subject` para `assertion.sub`. Conceda ao principal específico `owner:SEU_TEAM_SLUG:project:SEU_PROJETO_VERCEL:environment:production` a permissão **Workload Identity User** sobre a conta de serviço.
4. Em Google Auth Platform, crie um **ID do cliente OAuth 2.0 do tipo Aplicativo Web**. Em *Origens JavaScript autorizadas*, adicione o domínio final, como `https://seu-portal.vercel.app` (sem barra final). Este botão usa JavaScript e não precisa de URI de redirecionamento.
5. Na Vercel, em **Project Settings → Environment Variables**, configure estas variáveis para Production.

| Variável | Valor |
| --- | --- |
| `GOOGLE_SHEET_ID` | ID da planilha; já preenchido em `.env.example` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` da conta de serviço |
| `GCP_PROJECT_NUMBER` | Número do projeto Google Cloud, em IAM e administrador → Configurações |
| `GCP_WORKLOAD_IDENTITY_POOL_ID` | ID do pool, por exemplo `vercel` |
| `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID` | ID do provedor OIDC, por exemplo `vercel` |
| `GOOGLE_CLIENT_ID` | ID OAuth do Aplicativo Web |
| `ADMIN_EMAIL` | E-mail Google de quem gerenciará todas as contas |
| `SESSION_SECRET` | Sequência aleatória com pelo menos 32 caracteres |

Para gerar `SESSION_SECRET`, rode `openssl rand -base64 48` no terminal e cole o resultado somente na Vercel. Para usar um domínio de teste, adicione a origem dele ao mesmo cliente OAuth. `GOOGLE_PRIVATE_KEY` fica vazio na autenticação sem chave. Projetos antigos que já possuem chave ainda podem usá-la, mas não é necessário criar uma nova.

## Publicação

1. Extraia o ZIP e abra a pasta do projeto no terminal. Pode enviar a pasta para um repositório Git privado e importá-lo na Vercel.
2. Se preferir a linha de comando, rode `npx vercel` na pasta; depois de configurar as variáveis no projeto, execute `npx vercel deploy --prod`.
3. Entre com `ADMIN_EMAIL`, cadastre um cliente e o e-mail Google dele em **Acessos**, crie uma ação e confira a linha na planilha. Mude o status na planilha e confirme que o portal o atualiza.

Para testar localmente: copie `.env.example` para `.env.local`, preencha as variáveis e execute `npm install && npm run dev`. Autorize `http://localhost:3000` no cliente OAuth.

## Acesso

As chaves ficam só no servidor. O login verifica o token do Google, abre sessão por cookie assinado e restringe os dados por e-mail. Não compartilhe a planilha inteira com os clientes; eles precisam apenas do endereço do portal. O modelo oferece um e-mail por cliente, mas a mesma conta Google pode constar em vários clientes.
