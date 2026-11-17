# AGENTS.md — Regras de trabalho no CRM Odonto

## Identidade do projeto

CRM de uma clínica odontológica: conversas de WhatsApp, pacientes, agenda, atendimentos/prontuário, orçamentos e funil. O código nasceu como cópia do CRM escolar do COC Macapá Norte; o que ainda for escolar (famílias, visitas, matrículas, Ana) está em processo de remoção ou adaptação.

## Regras

- O banco é o projeto Supabase `crm-odonto` (`bdgtilgnicexcxyzcjks`). Nunca aponte este código para os projetos do COC ou do Conceito.
- O estado atual do código e do banco é a fonte de verdade quando divergir de documentação antiga.
- Antes de remover código, pesquise dependências no frontend e nas Edge Functions.
- Mudanças vão em branch + pull request; a `main` deve sempre compilar (`npm run build`).
- Dados de saúde (anamnese, prontuário) são sensíveis: acesso só para a equipe, sempre auditado, nunca em logs, exemplos ou testes.
- Nunca grave secrets, tokens ou credenciais no repositório nem na documentação.
