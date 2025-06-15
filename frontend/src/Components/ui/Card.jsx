// components/ui/card.jsx
import React from "react";
import clsx from "clsx";

export const Card = ({ className, children }) => {
  return (
    <div
      className={clsx(
        "rounded-2xl border border-gray-300 bg-white shadow-sm p-4",
        className
      )}
    >
      {children}
    </div>
  );
};
