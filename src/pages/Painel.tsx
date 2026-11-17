import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, MessageCircleWarning, TrendingUp, UserPlus, type LucideIcon } from "lucide-react";
import { useClinicIdentity } from "@/hooks/useClinicIdentity";
import { useDentists } from "@/hooks/useClinicData";
import { sampleDashboard, useDashboard, type DailyPoint } from "@/hooks/useDashboard";
import { formatClinicDay, formatShortDay, todayInClinic } from "@/lib/clinicTime";

// Cores de série validadas para leitores com daltonismo (ordem fixa: azul, laranja, verde-água).
const SERIES = [
  { key: "realizadas", label: "Realizadas", color: "#2a78d6" },
  { key: "agendadas", label: "A realizar", color: "#eb6834" },
  { key: "perdidas", label: "Faltas e cancelamentos", color: "#1baf7a" },
] as const;
const FUNNEL_COLOR = "#2a78d6";
const GRID = "#e7e9ec";
const AXIS_TEXT = "#52525b";

const PERIODS = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

const STATUS_LABELS: Record<string, string> = {
  agendada: "Agendada", confirmada: "Confirmada", em_atendimento: "Em atendimento", realizada: "Realizada", faltou: "Faltou",
};

function formatWait(hours: number) {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 24) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} d`;
}

function Tile({ icon: Icon, label, value, detail, to }: { icon: LucideIcon; label: string; value: string; detail: string; to: string }) {
  return (
    <Link to={to} className="group rounded-2xl border bg-white p-5 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <span className="rounded-xl bg-emerald-50 p-2 text-emerald-700 transition-colors group-hover:bg-emerald-100"><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </Link>
  );
}

function DailyTooltip({ active, payload }: { active?: boolean; payload?: { payload: DailyPoint }[] }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  const total = point.realizadas + point.agendadas + point.perdidas;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
      <p className="font-medium capitalize text-slate-900">{formatClinicDay(point.day)}</p>
      {SERIES.map((series) => (
        <p key={series.key} className="mt-1 flex items-center gap-2 text-slate-600">
          <span className="h-0.5 w-3 rounded" style={{ backgroundColor: series.color }} aria-hidden />
          <strong className="text-slate-900">{point[series.key]}</strong> {series.label.toLowerCase()}
        </p>
      ))}
      <p className="mt-1 border-t pt-1 text-xs text-slate-600">{total} no dia · clique para abrir a agenda</p>
    </div>
  );
}

function FunnelTooltip({ active, payload }: { active?: boolean; payload?: { payload: { label: string; count: number } }[] }) {
  if (!active || !payload?.length) return null;
  const stage = payload[0].payload;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-sm shadow-md">
      <p><strong className="text-slate-900">{stage.count}</strong> <span className="text-slate-600">em {stage.label.toLowerCase()}</span></p>
    </div>
  );
}

export default function Painel() {
  const navigate = useNavigate();
  const { clinicName } = useClinicIdentity();
  const dentists = useDentists();
  const [days, setDays] = useState(30);
  const [dentistId, setDentistId] = useState("");
  const [sample, setSample] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);

  const query = useDashboard(days, dentistId || null, !sample);
  const sampleData = useMemo(() => sampleDashboard(days), [days]);
  const data = sample ? sampleData : query.data;
  const today = todayInClinic();

  const isEmpty = !!data && !sample && data.today.total === 0 && data.waiting === 0 && data.newPatients === 0
    && data.daily.every((point) => point.realizadas + point.agendadas + point.perdidas === 0)
    && data.funnel.every((stage) => stage.count === 0);
  const funnelMax = Math.max(1, ...(data?.funnel || []).map((stage) => stage.count));
  const tickEvery = days <= 7 ? 0 : days <= 30 ? 4 : 13;

  return (
    <div className="mx-auto max-w-[1480px] px-4 py-6 md:px-7">
      <div>
        <h1 className="text-2xl font-bold">Painel</h1>
        <p className="mt-1 text-sm capitalize text-slate-600">{clinicName} · {formatClinicDay(today)}</p>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border bg-white p-1" role="group" aria-label="Período">
          {PERIODS.map((period) => (
            <button key={period.days} type="button" onClick={() => setDays(period.days)} aria-pressed={days === period.days}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${days === period.days ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-emerald-50"}`}>
              {period.label}
            </button>
          ))}
        </div>
        <select aria-label="Filtrar por dentista" className="h-10 rounded-xl border bg-white px-3 text-sm" value={dentistId}
          onChange={(event) => setDentistId(event.target.value)} disabled={sample}>
          <option value="">Todos os dentistas</option>
          {(dentists.data || []).map((dentist) => <option key={dentist.id} value={dentist.id}>{dentist.name}</option>)}
        </select>
        <label className="ml-auto flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm text-slate-700">
          <input type="checkbox" checked={sample} onChange={(event) => setSample(event.target.checked)} />
          Ver com dados de exemplo
        </label>
      </div>

      {sample && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Você está vendo <strong>dados de exemplo</strong>, gerados só nesta tela. Nada disso está gravado no sistema.
        </p>
      )}
      {isEmpty && (
        <p className="mt-3 rounded-xl border bg-slate-50 px-4 py-2 text-sm text-slate-700">
          Ainda não há movimento registrado. Marque “Ver com dados de exemplo” para conhecer o painel preenchido.
        </p>
      )}
      {query.isError && !sample && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800">Não foi possível carregar o painel.</p>}
      {!data && !query.isError && <p className="mt-6 text-sm text-slate-600">Carregando painel...</p>}

      {data && (
        <div className={`transition-opacity ${!sample && query.isFetching && query.isPlaceholderData ? "opacity-60" : ""}`}>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Tile icon={CalendarCheck} label="Consultas hoje" value={String(data.today.total)} to="/agenda"
              detail={data.today.total ? `${data.today.done} realizada${data.today.done === 1 ? "" : "s"} · ${data.today.confirmed} confirmada${data.today.confirmed === 1 ? "" : "s"}` : "Nenhuma consulta marcada"} />
            <Tile icon={MessageCircleWarning} label="Conversas aguardando resposta" value={String(data.waiting)} to="/conversas?status=todos"
              detail={data.waitingList[0] ? `A mais antiga espera há ${formatWait(data.waitingList[0].hours)}` : "Tudo respondido"} />
            <Tile icon={UserPlus} label={`Novos pacientes · ${days} dias`} value={String(data.newPatients)} to="/pacientes"
              detail="Cadastrados no período" />
            <Tile icon={TrendingUp} label={`Comparecimento · ${days} dias`} to="/agenda"
              value={data.attendanceRate === null ? "—" : `${Math.round(data.attendanceRate * 100)}%`}
              detail={data.attendanceRate === null ? "Sem consultas encerradas no período" : `${data.attended} realizadas · ${data.missed} falta${data.missed === 1 ? "" : "s"}`} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <section className="rounded-2xl border bg-white p-5 xl:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900">Agendamentos por dia</h2>
                  <p className="text-sm text-slate-600">Últimos {days} dias. Clique em um dia para abrir a agenda.</p>
                </div>
                <button type="button" className="text-sm font-medium text-emerald-800 underline" onClick={() => setShowTable(!showTable)}>
                  {showTable ? "Ver gráfico" : "Ver tabela"}
                </button>
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-700">
                {SERIES.map((series) => (
                  <li key={series.key} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: series.color }} aria-hidden />{series.label}
                  </li>
                ))}
              </ul>
              {showTable ? (
                <div className="mt-3 max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-slate-600">
                      <tr><th className="py-2">Dia</th>{SERIES.map((series) => <th key={series.key} className="py-2 text-right">{series.label}</th>)}</tr>
                    </thead>
                    <tbody>
                      {[...data.daily].reverse().map((point) => (
                        <tr key={point.day} className="border-t">
                          <td className="py-1.5"><Link className="hover:underline" to={`/agenda?dia=${point.day}`}>{formatShortDay(point.day)}</Link></td>
                          {SERIES.map((series) => <td key={series.key} className="py-1.5 text-right tabular-nums">{point[series.key]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mt-3 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
                      onMouseMove={(state) => setHoveredDay(state?.activeLabel ? String(state.activeLabel) : null)}
                      onMouseLeave={() => setHoveredDay(null)}
                      onClick={(state) => { if (state?.activeLabel && !sample) navigate(`/agenda?dia=${state.activeLabel}`); }}>
                      <CartesianGrid vertical={false} stroke={GRID} />
                      <XAxis dataKey="day" tickFormatter={formatShortDay} interval={tickEvery} tickLine={false} axisLine={{ stroke: GRID }}
                        tick={{ fill: AXIS_TEXT, fontSize: 12 }} />
                      <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 12 }} />
                      <Tooltip content={<DailyTooltip />} cursor={{ fill: "#f1f5f9" }} />
                      {SERIES.map((series, index) => (
                        <Bar key={series.key} dataKey={series.key} name={series.label} stackId="dia" fill={series.color} maxBarSize={24}
                          stroke="#ffffff" strokeWidth={2} radius={index === SERIES.length - 1 ? [4, 4, 0, 0] : 0}
                          cursor={sample ? "default" : "pointer"} isAnimationActive={false}>
                          {data.daily.map((point) => (
                            <Cell key={point.day} fillOpacity={hoveredDay && hoveredDay !== point.day ? 0.45 : 1} />
                          ))}
                        </Bar>
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section className="rounded-2xl border bg-white p-5">
              <h2 className="font-semibold text-slate-900">Funil de pacientes</h2>
              <p className="text-sm text-slate-600">Oportunidades em aberto, por etapa.</p>
              <div className="mt-3 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.funnel} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }}>
                    <XAxis type="number" hide domain={[0, funnelMax]} />
                    <YAxis type="category" dataKey="label" width={150} tickLine={false} axisLine={false} tick={{ fill: AXIS_TEXT, fontSize: 12 }} />
                    <Tooltip content={<FunnelTooltip />} cursor={{ fill: "#f1f5f9" }} />
                    <Bar dataKey="count" fill={FUNNEL_COLOR} maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
                      <LabelList dataKey="count" position="right" style={{ fill: "#0f172a", fontSize: 12, fontWeight: 600 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Agenda de hoje</h2>
                <Link to="/agenda" className="text-sm font-medium text-emerald-800 underline">Abrir agenda</Link>
              </div>
              {!data.todayList.length && <p className="mt-3 text-sm text-slate-600">Nenhuma consulta marcada para hoje.</p>}
              <ul className="mt-2 divide-y">
                {data.todayList.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 py-2.5">
                    <span className="w-14 shrink-0 font-semibold tabular-nums text-slate-900">{item.time}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-900">{item.patient}</span>
                      <span className="block truncate text-sm text-slate-600">{item.detail}</span>
                    </span>
                    <span className="shrink-0 rounded-full border bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">{STATUS_LABELS[item.status] || item.status}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Conversas aguardando resposta</h2>
                <Link to="/conversas?status=todos" className="text-sm font-medium text-emerald-800 underline">Abrir conversas</Link>
              </div>
              {!data.waitingList.length && <p className="mt-3 text-sm text-slate-600">Nenhuma conversa esperando resposta.</p>}
              <ul className="mt-2 divide-y">
                {data.waitingList.map((item) => {
                  const row = (
                    <>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-slate-900">{item.name}</span>
                        <span className="block truncate text-sm text-slate-600">{item.preview || "Sem prévia da mensagem"}</span>
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-slate-700">há {formatWait(item.hours)}</span>
                    </>
                  );
                  return (
                    <li key={item.id}>
                      {sample
                        ? <div className="flex items-center gap-4 py-2.5">{row}</div>
                        : <Link to={`/conversas?status=todos&lead=${encodeURIComponent(item.id)}`} className="flex items-center gap-4 py-2.5 hover:bg-emerald-50">{row}</Link>}
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
