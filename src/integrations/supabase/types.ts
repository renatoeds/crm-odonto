// Tipos do banco do projeto Supabase crm-odonto (bdgtilgnicexcxyzcjks).
// Escritos a partir do schema gerado em 16/11/2026, em forma compacta: Insert e Update
// são derivados de Row. Pode ser substituído pela saída de `supabase gen types typescript`.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type Rel<
  Name extends string,
  Column extends string,
  Ref extends string,
  RefColumn extends string = "id",
  OneToOne extends boolean = false,
> = {
  foreignKeyName: Name
  columns: [Column]
  isOneToOne: OneToOne
  referencedRelation: Ref
  referencedColumns: [RefColumn]
}

/** Row = linha completa; Required = colunas obrigatórias no insert. */
type Table<Row, Required extends keyof Row, Relationships extends unknown[] = []> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Required>
  Update: Partial<Row>
  Relationships: Relationships
}

type AppRole = "admin" | "user"
type LeadStatus =
  | "novo"
  | "em_atendimento"
  | "em_negociacao"
  | "matriculado"
  | "nao_convertido"
  | "resolvido"

type ActivityLogRow = {
  activity_type: string
  actor: string | null
  created_at: string
  description: string
  id: string
  lead_id: string
  metadata: Json | null
  related_entity_id: string | null
  related_entity_type: string | null
  source: string
  user_id: string | null
}

type AppointmentRow = {
  cancel_reason: string | null
  cancelled_at: string | null
  chair_id: string | null
  confirmed_at: string | null
  created_at: string
  created_by: string | null
  dentist_id: string
  ends_at: string
  id: string
  kind: string
  notes: string | null
  patient_id: string
  procedure_id: string | null
  reminder_sent_at: string | null
  source: string
  starts_at: string
  status: string
  treatment_plan_id: string | null
  updated_at: string
}

type AttendanceProcedureRow = {
  attendance_id: string
  created_at: string
  description: string | null
  id: string
  notes: string | null
  price: number | null
  procedure_id: string | null
  surface: string | null
  tooth: string | null
  treatment_plan_item_id: string | null
}

type AttendanceRow = {
  appointment_id: string | null
  attended_at: string
  chief_complaint: string | null
  clinical_notes: string | null
  created_at: string
  created_by: string | null
  dentist_id: string
  diagnosis: string | null
  id: string
  next_steps: string | null
  patient_id: string
  prescription: string | null
  updated_at: string
}

type AuditLogRow = {
  actor_email: string | null
  actor_id: string | null
  changed_fields: string[]
  created_at: string
  entity_label: string | null
  id: string
  operation: string
  outcome: string
  record_id: string | null
  schema_name: string
  table_name: string
}

type ChairRow = {
  active: boolean
  created_at: string
  id: string
  name: string
}

type DeliveryLogRow = {
  created_at: string
  destination: string
  id: string
  lead_id: string
  response: Json | null
  sent_at: string
  url: string | null
}

type DentistRow = {
  active: boolean
  color: string | null
  created_at: string
  cro: string | null
  id: string
  name: string
  phone: string | null
  specialty: string | null
  updated_at: string
  user_id: string | null
}

type EmailAttachmentRow = {
  content_hash: string | null
  content_type: string | null
  created_at: string
  deleted_at: string | null
  email_message_id: string | null
  filename: string
  id: string
  lead_id: string | null
  legal_analysis: Json | null
  legal_analysis_at: string | null
  size_bytes: number | null
  storage_path: string
  whatsapp_message_id: string | null
}

type EmailMessageRow = {
  also_received_by: string[]
  created_at: string
  direction: string
  followup_intent: string | null
  followup_intent_at: string | null
  followup_intent_reason: string | null
  html_body: string | null
  id: string
  internet_message_id: string | null
  lead_id: string | null
  message: string | null
  outlook_message_id: string | null
  raw_data: Json | null
  recipients_bcc: string[]
  recipients_cc: string[]
  recipients_to: string[]
  resend_message_id: string | null
  subject: string | null
  timestamp: string
}

type LeadNoteRow = {
  created_at: string
  id: string
  lead_id: string
  note: string
  updated_at: string
}

type LeadRow = {
  agent_replied_at: string | null
  ai_close_probability: number | null
  ai_diagnosis: string | null
  ai_diagnosis_reason: string | null
  ai_diagnosis_updated_at: string | null
  ai_next_step: string | null
  archived: boolean | null
  assunto: string | null
  attention_level: string | null
  attention_reason: string | null
  client_interaction_count: number | null
  created_at: string
  data_proximo_pagamento: string | null
  delivered_at: string | null
  description: string | null
  description_updated_at: string | null
  email: string | null
  email_inbound_count: number | null
  email_outbound_count: number | null
  emails: string[] | null
  handoff_at: string | null
  handoff_reason: string | null
  id: string
  interesse: string | null
  is_recurring: boolean | null
  language: string | null
  last_inbound_message: string | null
  last_inbound_message_at: string | null
  last_outbound_message: string | null
  last_outbound_message_at: string | null
  matriculado_at: string | null
  message: string | null
  moeda: string | null
  name: string
  nao_convertido_at: string | null
  negociacao_at: string | null
  origem: string | null
  phone: string | null
  phones: string[] | null
  produto: string | null
  profile_picture_url: string | null
  proposal_last_viewed_at: string | null
  proposal_sent_at: string | null
  proposal_url: string | null
  proposal_view_count: number | null
  publicidade_quantidade: number | null
  publicidade_subtipo: string | null
  reopened_at: string | null
  resolved_at: string | null
  resolvido_at: string | null
  source: string | null
  status: LeadStatus | null
  suggested_followup: string | null
  triage_status: string
  triage_summary: string | null
  unclassified: boolean | null
  updated_at: string | null
  valor: number | null
  valor_manually_edited: boolean | null
  valor_pago: number | null
  whatsapp_chat_lids: string[] | null
  whatsapp_inbound_count: number | null
  whatsapp_outbound_count: number | null
  whatsapp_phone_lid_map: Json
  whatsapp_phone_name_map: Json
}

type OpportunityRow = {
  assigned_to: string | null
  closed_at: string | null
  created_at: string
  created_by: string | null
  estimated_value: number | null
  id: string
  interest: string | null
  lead_id: string | null
  loss_reason: string | null
  next_action: string | null
  next_action_at: string | null
  patient_id: string | null
  stage: string
  treatment_plan_id: string | null
  updated_at: string
}

type OpportunityStageHistoryRow = {
  changed_at: string
  changed_by: string | null
  from_stage: string | null
  id: string
  opportunity_id: string
  to_stage: string
}

type PatientRow = {
  address_city: string | null
  address_complement: string | null
  address_district: string | null
  address_number: string | null
  address_state: string | null
  address_street: string | null
  address_zip: string | null
  allergies: string | null
  anamnesis: Json
  anamnesis_updated_at: string | null
  birth_date: string | null
  cpf: string | null
  created_at: string
  created_by: string | null
  email: string | null
  full_name: string
  health_insurance: string | null
  health_insurance_number: string | null
  id: string
  lead_id: string | null
  medications: string | null
  notes: string | null
  origin: string | null
  phone: string | null
  phone_secondary: string | null
  responsible_cpf: string | null
  responsible_name: string | null
  responsible_phone: string | null
  sex: string | null
  status: string
  updated_at: string
  whatsapp_opt_in: boolean
}

type ProcedureRow = {
  active: boolean
  category: string | null
  code: string | null
  created_at: string
  default_duration_min: number
  default_price: number | null
  id: string
  name: string
  updated_at: string
}

type ScheduledFollowupRow = {
  attempt_number: number
  created_at: string
  id: string
  last_error: string | null
  lead_id: string
  next_run_at: string
  status: string
  updated_at: string
}

type SystemSettingRow = {
  key: string
  updated_at: string
  value: string
}

type TreatmentPlanItemRow = {
  created_at: string
  description: string | null
  id: string
  plan_id: string
  procedure_id: string | null
  quantity: number
  sort_order: number
  status: string
  surface: string | null
  tooth: string | null
  unit_price: number
}

type TreatmentPlanRow = {
  approved_at: string | null
  created_at: string
  created_by: string | null
  dentist_id: string | null
  discount: number
  id: string
  notes: string | null
  patient_id: string
  payment_terms: string | null
  presented_at: string | null
  refusal_reason: string | null
  status: string
  title: string
  updated_at: string
  valid_until: string | null
}

type UserPresenceRow = {
  last_path: string | null
  last_seen_at: string
  updated_at: string
  user_id: string
}

type UserProductAccessRow = {
  created_at: string
  id: string
  produto: string
  user_id: string
}

type UserRoleRow = {
  created_at: string
  id: string
  role: AppRole
  user_id: string
}

type WhatsAppMessageRow = {
  created_at: string
  direction: string
  id: string
  is_audio: boolean | null
  lead_id: string | null
  message: string | null
  phone: string
  raw_data: Json | null
  timestamp: string | null
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      activity_log: Table<ActivityLogRow, "activity_type" | "description" | "lead_id">
      appointments: Table<
        AppointmentRow,
        "dentist_id" | "ends_at" | "patient_id" | "starts_at",
        [
          Rel<"appointments_chair_id_fkey", "chair_id", "chairs">,
          Rel<"appointments_dentist_id_fkey", "dentist_id", "dentists">,
          Rel<"appointments_patient_id_fkey", "patient_id", "patients">,
          Rel<"appointments_procedure_id_fkey", "procedure_id", "procedures">,
          Rel<"appointments_treatment_plan_fkey", "treatment_plan_id", "treatment_plan_totals", "plan_id">,
          Rel<"appointments_treatment_plan_fkey", "treatment_plan_id", "treatment_plans">,
        ]
      >
      attendance_procedures: Table<
        AttendanceProcedureRow,
        "attendance_id",
        [
          Rel<"attendance_procedures_attendance_id_fkey", "attendance_id", "attendances">,
          Rel<"attendance_procedures_plan_item_fkey", "treatment_plan_item_id", "treatment_plan_items">,
          Rel<"attendance_procedures_procedure_id_fkey", "procedure_id", "procedures">,
        ]
      >
      attendances: Table<
        AttendanceRow,
        "dentist_id" | "patient_id",
        [
          Rel<"attendances_appointment_id_fkey", "appointment_id", "appointments", "id", true>,
          Rel<"attendances_dentist_id_fkey", "dentist_id", "dentists">,
          Rel<"attendances_patient_id_fkey", "patient_id", "patients">,
        ]
      >
      audit_logs: Table<AuditLogRow, "operation" | "schema_name" | "table_name">
      chairs: Table<ChairRow, "name">
      delivery_logs: Table<
        DeliveryLogRow,
        "destination" | "lead_id",
        [Rel<"delivery_logs_lead_id_fkey", "lead_id", "leads">]
      >
      dentists: Table<DentistRow, "name">
      email_attachments: Table<
        EmailAttachmentRow,
        "filename" | "storage_path",
        [
          Rel<"email_attachments_email_message_id_fkey", "email_message_id", "email_messages">,
          Rel<"email_attachments_lead_id_fkey", "lead_id", "leads">,
          Rel<"email_attachments_whatsapp_message_id_fkey", "whatsapp_message_id", "whatsapp_messages">,
        ]
      >
      email_messages: Table<
        EmailMessageRow,
        never,
        [Rel<"email_messages_lead_id_fkey", "lead_id", "leads">]
      >
      lead_notes: Table<LeadNoteRow, "lead_id" | "note">
      leads: Table<LeadRow, "name">
      opportunities: Table<
        OpportunityRow,
        never,
        [
          Rel<"opportunities_lead_id_fkey", "lead_id", "leads">,
          Rel<"opportunities_patient_id_fkey", "patient_id", "patients">,
          Rel<"opportunities_treatment_plan_id_fkey", "treatment_plan_id", "treatment_plan_totals", "plan_id">,
          Rel<"opportunities_treatment_plan_id_fkey", "treatment_plan_id", "treatment_plans">,
        ]
      >
      opportunity_stage_history: Table<
        OpportunityStageHistoryRow,
        "opportunity_id" | "to_stage",
        [Rel<"opportunity_stage_history_opportunity_id_fkey", "opportunity_id", "opportunities">]
      >
      patients: Table<
        PatientRow,
        "full_name",
        [Rel<"patients_lead_id_fkey", "lead_id", "leads", "id", true>]
      >
      procedures: Table<ProcedureRow, "name">
      scheduled_followups: Table<
        ScheduledFollowupRow,
        "lead_id" | "next_run_at",
        [Rel<"scheduled_followups_lead_id_fkey", "lead_id", "leads", "id", true>]
      >
      system_settings: Table<SystemSettingRow, "key" | "value">
      treatment_plan_items: Table<
        TreatmentPlanItemRow,
        "plan_id",
        [
          Rel<"treatment_plan_items_plan_id_fkey", "plan_id", "treatment_plan_totals", "plan_id">,
          Rel<"treatment_plan_items_plan_id_fkey", "plan_id", "treatment_plans">,
          Rel<"treatment_plan_items_procedure_id_fkey", "procedure_id", "procedures">,
        ]
      >
      treatment_plans: Table<
        TreatmentPlanRow,
        "patient_id",
        [
          Rel<"treatment_plans_dentist_id_fkey", "dentist_id", "dentists">,
          Rel<"treatment_plans_patient_id_fkey", "patient_id", "patients">,
        ]
      >
      user_presence: Table<UserPresenceRow, "user_id">
      user_product_access: Table<UserProductAccessRow, "produto" | "user_id">
      user_roles: Table<UserRoleRow, "role" | "user_id">
      whatsapp_messages: Table<
        WhatsAppMessageRow,
        "direction" | "phone",
        [Rel<"whatsapp_messages_lead_id_fkey", "lead_id", "leads">]
      >
    }
    Views: {
      treatment_plan_totals: {
        Row: {
          discount: number | null
          gross_total: number | null
          items_done: number | null
          items_total: number | null
          net_total: number | null
          plan_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      available_slots: {
        Args: {
          p_close?: string
          p_day: string
          p_dentist_id: string
          p_duration_min?: number
          p_open?: string
          p_step_min?: number
        }
        Returns: {
          slot_end: string
          slot_start: string
        }[]
      }
      create_patient_from_lead: {
        Args: {
          p_birth_date?: string
          p_cpf?: string
          p_full_name?: string
          p_lead_id: string
        }
        Returns: string
      }
      has_role: {
        Args: { _role: AppRole; _user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      user_can_access_lead: {
        Args: { _lead_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: AppRole
      lead_status: LeadStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database["public"]

export type Tables<
  Name extends keyof (PublicSchema["Tables"] & PublicSchema["Views"]),
> = (PublicSchema["Tables"] & PublicSchema["Views"])[Name] extends { Row: infer R } ? R : never

export type TablesInsert<Name extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][Name]["Insert"]

export type TablesUpdate<Name extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][Name]["Update"]

export type Enums<Name extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][Name]

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      lead_status: [
        "novo",
        "em_atendimento",
        "em_negociacao",
        "matriculado",
        "nao_convertido",
        "resolvido",
      ],
    },
  },
} as const
