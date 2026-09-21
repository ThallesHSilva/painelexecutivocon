import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Campo base.
 *
 * `tone` separa os três papéis que a auditoria via misturados:
 * - `editable` (padrão): campo preenchível, com borda e foco visíveis;
 * - `readonly`: valor fechado ou calculado. Continua legível em contraste pleno e
 *   não imita um campo habilitado — `disabled` deixa de significar "texto apagado".
 *
 * O anel de foco segue o DESIGN: 2 px com 2 px de offset, visível sobre qualquer
 * superfície e não encoberto pelo header.
 */
type InputTone = "editable" | "readonly";

const toneClass: Record<InputTone, string> = {
  editable:
    "border-input bg-background focus-visible:border-ring disabled:border-transparent disabled:bg-muted disabled:text-foreground disabled:opacity-100 disabled:shadow-none disabled:cursor-default",
  readonly:
    "border-transparent bg-muted text-foreground shadow-none cursor-default disabled:opacity-100 disabled:cursor-default",
};

export interface InputProps extends React.ComponentProps<"input"> {
  tone?: InputTone;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, tone = "editable", ...props }, ref) => {
    return (
      <input
        type={type}
        data-tone={tone}
        className={cn(
          "flex h-9 w-full rounded-sm border bg-transparent px-3 py-1 text-base transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:text-sm",
          toneClass[tone],
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
