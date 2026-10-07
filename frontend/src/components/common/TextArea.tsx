import React, { useId } from "react";

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
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
      <textarea id={fieldId} className={`textarea-field ${className}`} {...props} />
      {error && <p className="text-xs text-red-700 mt-1">{error}</p>}
      {helper && !error && (
        <p className="text-xs text-gray-500 mt-1">{helper}</p>
      )}
    </div>
  );
};
