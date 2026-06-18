import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = "",
  elevated = false,
}) => {
  return (
    <div className={`${elevated ? "card-elevated" : "card"} ${className}`}>
      {children}
    </div>
  );
};
