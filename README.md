# CRM Odonto

CRM da clínica odontológica: conversas de WhatsApp (Z-API), pacientes, agenda, atendimentos/prontuário, orçamentos e funil.

Derivado do CRM do COC Macapá Norte (`charlyjhone/crm-coc-macapa`, commit `3d251fe`). O primeiro commit é a cópia do código escolar, sem os arquivos específicos do COC/Conceito; a adaptação para a clínica acontece em branches e pull requests a partir dele.

## Estado

- Banco: projeto Supabase `crm-odonto` (`bdgtilgnicexcxyzcjks`), já com as tabelas do núcleo e as clínicas.
- Código: **em adaptação**. Prontas: painel, conversas, pendentes, pacientes, agenda, equipe, auditoria e configurações. Atendente virtual pronta e testável pelo simulador em Configurações; falta ligá-la ao WhatsApp. Faltam também: prontuário, orçamentos, funil e as demais Edge Functions.

## Edge Functions

- `clinic-assistant`: atendente virtual (modo `simulate` para a tela de teste, modo `lead` para a integração de WhatsApp). Regras puras e testes em `supabase/functions/_shared/clinic-assistant-core*.ts`, também usadas pela Agenda. Secrets: `OPENAI_API_KEY` (obrigatório) e `OPENAI_MODEL` (opcional, padrão `gpt-4.1-mini`).
- Publicação: o arquivo `_shared/clinic-assistant-core.ts` vai junto com a função; o import fica `./clinic-assistant-core.ts` no pacote publicado.

## Desenvolvimento

```sh
npm ci
cp .env.example .env   # preencha a chave publicável do projeto crm-odonto
npm run dev
```

Stack: Vite, React, TypeScript, Tailwind, shadcn/ui, Supabase (Postgres, Auth, Edge Functions).

Nunca grave no repositório chaves secretas, tokens da Z-API ou qualquer dado de paciente.
