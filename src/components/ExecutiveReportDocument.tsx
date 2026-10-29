import {
  Children,
  Fragment,
  createContext,
  isValidElement,
  useContext,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const Pagination = createContext({ page: 1, totalPages: 1 });
export const useReportPagination = () => useContext(Pagination);

function flattenPages(children: ReactNode): ReactNode[] {
  const pages: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      pages.push(...flattenPages(child.props.children));
    } else if (child != null && typeof child !== "boolean") pages.push(child);
  });
  return pages;
}

/** Count the actual rendered sheets, including every continuation page. */
export function ExecutiveReportDocument({
  partner,
  children,
}: {
  partner: string;
  children: ReactNode;
}) {
  const pages = flattenPages(children);
  return (
    <main className="executive-report min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6">
      <div className="no-print sticky top-3 z-50 mx-auto mb-5 flex max-w-[1120px] items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
        <Button asChild variant="outline">
          <Link to="/resultados">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
        <div className="hidden text-center sm:block">
          <p className="text-xs font-semibold">Relatório executivo · {partner}</p>
          <p className="text-[11px] text-slate-500">A4 horizontal · {pages.length} páginas</p>
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="size-4" />
          Gerar PDF
        </Button>
      </div>
      {pages.map((page, index) => (
        <Pagination.Provider
          key={`${isValidElement(page) ? (page.key ?? "sheet") : "sheet"}-${index}`}
          value={{ page: index + 1, totalPages: pages.length }}
        >
          {page}
        </Pagination.Provider>
      ))}
    </main>
  );
}
