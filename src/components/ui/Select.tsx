import * as React from "react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  label?: string;
  error?: string;
  wrapperClassName?: string;
  options?: Array<{ value: string; label: string; disabled?: boolean }>;
  placeholder?: string;
  onChange?: (value: string, event: React.ChangeEvent<HTMLSelectElement>) => void;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    { className, wrapperClassName, label, error, options, placeholder, id, onChange, ...props },
    ref,
  ) => {
    const selectId = id ?? props.name;
    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value, e);
    };
    return (
      <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
        {label ? (
          <label htmlFor={selectId} className="text-sm font-medium text-white/80">
            {label}
          </label>
        ) : null}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            "input-base appearance-none bg-[image:var(--select-chevron)] pr-10",
            error && "border-red-400/70",
            className,
          )}
          onChange={handleChange}
          {...props}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options && options.length > 0 ? (
            options.map((o) => (
              <option key={o.value} value={o.value} disabled={o.disabled}>
                {o.label}
              </option>
            ))
          ) : (
            (props as any).children
          )}
        </select>
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
