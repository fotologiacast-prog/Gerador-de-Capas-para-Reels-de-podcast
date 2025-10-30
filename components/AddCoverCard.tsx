import React from 'react';
import { PlusIcon } from './Icons';

interface AddCoverCardProps {
    onClick: () => void;
    isLoading: boolean;
    isDisabled: boolean;
}

export const AddCoverCard: React.FC<AddCoverCardProps> = ({ onClick, isLoading, isDisabled }) => {
    return (
        <button
            onClick={onClick}
            disabled={isDisabled || isLoading}
            className="aspect-[9/16] bg-black/20 backdrop-blur-xl rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-gray-400 hover:bg-black/30 hover:border-white/30 transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#00adef] disabled:opacity-50 disabled:cursor-not-allowed"
        >
            {isLoading ? (
                <>
                    <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="mt-2 text-sm">Adicionando...</span>
                </>
            ) : (
                <>
                    <PlusIcon className="w-12 h-12" />
                    <span className="mt-2 font-semibold">Adicionar Nova Capa</span>
                </>
            )}
        </button>
    );
};