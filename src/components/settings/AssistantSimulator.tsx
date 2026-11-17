import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RotateCcw, Send } from "lucide-react";

type Action = { tipo: string; descricao: string; simulado: boolean; ok: boolean };
type ChatItem =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; actions: Action[] }
  | { role: "error"; content: string };

type AssistantResponse = { reply?: string; actions?: Action[]; error?: string };

async function readFunctionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as { error?: string };
      if (body?.error) return body.error;
    } catch {
      // resposta sem JSON: usa a mensagem genérica abaixo
    }
  }
  return "Não foi possível falar com a atendente agora.";
}

export function AssistantSimulator({ agentName }: { agentName: string }) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [text, setText] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [items, sending]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    const next: ChatItem[] = [...items, { role: "user", content }];
    setItems(next);
    setText("");
    setSending(true);
    const history = next
      .filter((item): item is Exclude<ChatItem, { role: "error" }> => item.role !== "error")
      .slice(-40)
      .map((item) => ({ role: item.role, content: item.content }));
    const { data, error } = await supabase.functions.invoke<AssistantResponse>("clinic-assistant", {
      body: { mode: "simulate", messages: history, phone: phone.trim() || undefined },
    });
    setSending(false);
    if (error || !data?.reply) {
      const message = error ? await readFunctionError(error) : data?.error || "A atendente não respondeu.";
      setItems((current) => [...current, { role: "error", content: message }]);
      return;
    }
    setItems((current) => [...current, { role: "assistant", content: data.reply as string, actions: data.actions || [] }]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Testar a atendente</CardTitle>
        <CardDescription>
          Converse como se fosse um paciente. Ela usa os dentistas, horários e preços cadastrados, mas nada é gravado:
          agendamentos e repasses aparecem só como simulação.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1 space-y-1.5">
            <Label htmlFor="simulator-phone">Telefone do paciente simulado (opcional)</Label>
            <Input id="simulator-phone" value={phone} onChange={(event) => setPhone(event.target.value)}
              placeholder="Use o telefone de um paciente cadastrado para testar a identificação" />
          </div>
          <Button variant="outline" onClick={() => { setItems([]); setText(""); }} disabled={sending || !items.length}>
            <RotateCcw className="mr-2 h-4 w-4" />Recomeçar conversa
          </Button>
        </div>

        <div className="h-96 space-y-3 overflow-y-auto rounded-xl border bg-slate-50 p-4" aria-live="polite">
          {!items.length && (
            <p className="text-sm text-slate-600">
              Experimente: “Oi, quanto custa uma limpeza?”, “Quero marcar uma avaliação na quinta à tarde” ou “Estou com o rosto inchado”.
            </p>
          )}
          {items.map((item, index) => {
            if (item.role === "user") {
              return (
                <div key={index} className="flex justify-end">
                  <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-emerald-700 px-3 py-2 text-sm text-white">{item.content}</p>
                </div>
              );
            }
            if (item.role === "error") {
              return <p key={index} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{item.content}</p>;
            }
            return (
              <div key={index} className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600">{agentName}</p>
                <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border bg-white px-3 py-2 text-sm text-slate-900">{item.content}</p>
                {item.actions.map((action, actionIndex) => (
                  <p key={actionIndex} className="max-w-[80%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900">
                    Simulação: {action.descricao}
                  </p>
                ))}
              </div>
            );
          })}
          {sending && (
            <p className="flex items-center gap-2 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />{agentName} está escrevendo...</p>
          )}
          <div ref={endRef} />
        </div>

        <div className="flex items-end gap-2">
          <Textarea aria-label="Mensagem do paciente simulado" rows={2} value={text} placeholder="Escreva como o paciente escreveria no WhatsApp"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }} />
          <Button onClick={() => void send()} disabled={sending || !text.trim()} aria-label="Enviar mensagem">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
