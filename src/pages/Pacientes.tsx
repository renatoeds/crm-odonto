import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { usePatients, type Patient } from "@/hooks/useClinicData";
import { PatientDialog } from "@/components/clinic/PatientDialog";
import { ageFromBirthDate, formatBirthDate } from "@/lib/clinicTime";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CalendarPlus, Pencil, Plus } from "lucide-react";

const digits = (value: string | null) => (value || "").replace(/\D/g, "");

export default function Pacientes() {
  const { data, isLoading, isError } = usePatients();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);

  const list = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const termDigits = term.replace(/\D/g, "");
    return (data || []).filter((patient) => {
      if (!showInactive && patient.status !== "ativo") return false;
      if (!term) return true;
      return patient.full_name.toLocaleLowerCase("pt-BR").includes(term)
        || (patient.email || "").toLocaleLowerCase("pt-BR").includes(term)
        || (termDigits.length >= 3 && (digits(patient.phone).includes(termDigits) || digits(patient.cpf).includes(termDigits)));
    });
  }, [data, search, showInactive]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (patient: Patient) => { setEditing(patient); setDialogOpen(true); };

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-6 md:px-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="mt-1 text-sm text-slate-600">Cadastro, contato e ficha de saúde dos pacientes da clínica.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" />Novo paciente</Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Input aria-label="Buscar paciente" className="max-w-md" placeholder="Buscar por nome, telefone, CPF ou e-mail"
          value={search} onChange={(event) => setSearch(event.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          Mostrar inativos
        </label>
        <span className="text-sm text-slate-600">{list.length} paciente{list.length === 1 ? "" : "s"}</span>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-4 py-3">Paciente</th>
              <th className="px-4 py-3">Contato</th>
              <th className="px-4 py-3">Nascimento</th>
              <th className="px-4 py-3">Convênio</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-slate-600">Carregando pacientes...</td></tr>}
            {isError && <tr><td colSpan={5} className="px-4 py-6 text-red-700">Não foi possível carregar os pacientes.</td></tr>}
            {!isLoading && !isError && !list.length && (
              <tr><td colSpan={5} className="px-4 py-6 text-slate-600">{data?.length ? "Nenhum paciente encontrado para esta busca." : "Nenhum paciente cadastrado ainda."}</td></tr>
            )}
            {list.map((patient) => {
              const age = ageFromBirthDate(patient.birth_date);
              return (
                <tr key={patient.id} className="border-b last:border-b-0 hover:bg-emerald-50/50">
                  <td className="px-4 py-3">
                    <button type="button" className="text-left font-medium hover:underline" onClick={() => openEdit(patient)}>{patient.full_name}</button>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {patient.status !== "ativo" && <Badge variant="secondary">Inativo</Badge>}
                      {patient.allergies && (
                        <Badge variant="outline" className="border-red-300 text-red-700">
                          <AlertTriangle className="mr-1 h-3 w-3" />Alergia
                        </Badge>
                      )}
                      {patient.responsible_name && <span className="text-xs text-slate-600">Resp.: {patient.responsible_name}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    <div>{patient.phone || "Sem telefone"}</div>
                    {patient.email && <div className="text-xs text-slate-600">{patient.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {patient.birth_date ? `${formatBirthDate(patient.birth_date)}${age !== null ? ` · ${age} anos` : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{patient.health_insurance || "Particular"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/agenda?paciente=${encodeURIComponent(patient.id)}`}><CalendarPlus className="mr-1.5 h-4 w-4" />Agendar</Link>
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(patient)} aria-label={`Editar ${patient.full_name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <PatientDialog open={dialogOpen} onOpenChange={setDialogOpen} patient={editing} />
    </div>
  );
}
