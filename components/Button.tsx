import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ children, className, ...props }) => {
    return (
        <button
            className={`
                px-4 py-2.5 font-semibold text-white rounded-lg shadow-md
                flex items-center justify-center gap-2
                bg-gradient-to-r from-[#00adef] to-[#0077b6] hover:opacity-90
                focus:outline-none focus:ring-2 focus:ring-[#00adef] focus:ring-offset-2 focus:ring-offset-[#010409]
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all duration-300 ease-in-out
                ${className}
            `}
            {...props}
        >
            {children}
        </button>
    );
};