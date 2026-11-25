import { useEffect, useState } from "react";
import { Download, ImageDown, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { renderTowerRankingImage } from "@/lib/tower-ranking-image";
import type { ServiceTower } from "@/lib/snapshot-types";

export function TowerRankingExport({
  towers,
  activeIndex,
}: {
  towers: ServiceTower[];
  activeIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const [first, setFirst] = useState(0);
  const [second, setSecond] = useState(-1);
  const [date, setDate] = useState(() =>
    new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()),
  );
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url = "";
    setPreview("");
    setError("");
    const selected = [towers[first], second >= 0 ? towers[second] : null].filter(
      (t): t is ServiceTower => !!t,
    );
    if (!selected.length || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Selecione uma torre e uma data válida.");
      return;
    }
    void renderTowerRankingImage(selected, date.split("-").reverse().join("/"))
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      })
      .catch(() => {
        if (!cancelled) setError("Não foi possível gerar a imagem. Feche e tente novamente.");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, towers, first, second, date]);
  const control =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground";
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (value) {
          setFirst(activeIndex);
          setSecond(activeIndex + 1 < towers.length ? activeIndex + 1 : -1);
        }
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ImageDown className="mr-2 size-4" />
          Gerar imagem do ranking
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[94dvh] max-w-4xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Imagem do ranking</DialogTitle>
          <DialogDescription>
            Template automático com o ranking completo dos parceiros autorizados e os totais TT da
            base. A seleção de foco da tela não limita esta imagem.
          </DialogDescription>
        </DialogHeader>
        <div className="grid shrink-0 gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm font-medium">
            Primeira torre
            <select
              className={control}
              value={first}
              onChange={(e) => {
                const next = Number(e.target.value);
                setFirst(next);
                if (next === second) setSecond(-1);
              }}
            >
              {towers.map((t, i) => (
                <option key={t.id} value={i}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Segunda torre
            <select
              className={control}
              value={second}
              onChange={(e) => setSecond(Number(e.target.value))}
            >
              <option value={-1}>Somente uma torre</option>
              {towers.map(
                (t, i) =>
                  i !== first && (
                    <option key={t.id} value={i}>
                      {t.title}
                    </option>
                  ),
              )}
            </select>
          </label>
          <label className="space-y-1 text-sm font-medium">
            Data da imagem
            <input
              type="date"
              className={control}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto rounded-md border bg-muted p-2"
          aria-busy={!preview && !error}
        >
          {error ? (
            <p role="alert" className="p-6 text-sm text-destructive">
              {error}
            </p>
          ) : preview ? (
            <img
              src={preview}
              alt="Prévia da imagem do ranking das torres selecionadas"
              className="mx-auto h-auto w-full"
            />
          ) : (
            <p role="status" className="flex items-center justify-center gap-2 p-10 text-sm">
              <LoaderCircle className="size-4 animate-spin" />
              Gerando imagem…
            </p>
          )}
        </div>
        <div className="flex shrink-0 justify-end">
          <Button disabled={!preview || !!error} asChild={!!preview && !error}>
            {preview && !error ? (
              <a
                href={preview}
                download={`ranking-${towers[first]?.id}${second >= 0 ? `-${towers[second]?.id}` : ""}-${date}.png`}
              >
                <Download className="mr-2 size-4" />
                Baixar PNG
              </a>
            ) : (
              <span>
                <Download className="mr-2 size-4" />
                Baixar PNG
              </span>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
