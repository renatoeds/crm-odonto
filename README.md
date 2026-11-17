# CRM Odonto

CRM da clínica odontológica: conversas de WhatsApp (Z-API), pacientes, agenda, atendimentos/prontuário, orçamentos e funil.

Derivado do CRM do COC Macapá Norte (`charlyjhone/crm-coc-macapa`, commit `3d251fe`). O primeiro commit é a cópia do código escolar, sem os arquivos específicos do COC/Conceito; a adaptação para a clínica acontece em branches e pull requests a partir dele.

## Estado

- Banco: projeto Supabase `crm-odonto` (`bdgtilgnicexcxyzcjks`), já com as tabelas do núcleo e as clínicas.
- Código: **em adaptação**. Prontas: conversas, pendentes, equipe, auditoria e configurações. Faltam: pacientes, agenda, prontuário, orçamentos, funil, assistente virtual e a publicação das Edge Functions.

## Desenvolvimento

```sh
npm ci
cp .env.example .env   # preencha a chave publicável do projeto crm-odonto
npm run dev
```

Stack: Vite, React, TypeScript, Tailwind, shadcn/ui, Supabase (Postgres, Auth, Edge Functions).

Nunca grave no repositório chaves secretas, tokens da Z-API ou qualquer dado de paciente.
