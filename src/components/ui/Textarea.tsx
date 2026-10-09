import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, wrapperClassName, label, error, id, ...props }, ref) => {
    const inputId = id ?? props.name;
    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label ? (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-white/80"
          >
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            "input-base min-h-[80px] resize-y py-2.5",
            error && "border-red-400/70 focus:border-red-400 focus:ring-red-400/50",
            className,
          )}
          {...props}
        />
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
