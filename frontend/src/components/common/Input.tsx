import React, { useId } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helper,
  id,
  className = "",
  ...props
}) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;

  return (
    <div className="form-group">
      {label && (
        <label htmlFor={fieldId} className="form-label">
          {label}
        </label>
      )}
      <input id={fieldId} className={`input-field ${className}`} {...props} />
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
      {helper && !error && (
        <p className="text-xs text-gray-500 mt-1">{helper}</p>
      )}
    </div>
  );
};
