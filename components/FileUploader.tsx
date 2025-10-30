import React, { useState, useCallback } from 'react';

interface FileUploaderProps {
    onFileChange: (file: File | null) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileChange }) => {
    const [fileName, setFileName] = useState<string>('');

    const handleDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            if (file.type.startsWith('video/')) {
                setFileName(file.name);
                onFileChange(file);
            }
        }
    }, [onFileChange]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            const file = files[0];
             if (file.type.startsWith('video/')) {
                setFileName(file.name);
                onFileChange(file);
            } else {
                setFileName('');
                onFileChange(null);
            }
        }
    };

    return (
        <div className="flex items-center justify-center w-full">
            <label 
                htmlFor="dropzone-file" 
                className="flex flex-col items-center justify-center w-full h-40 border-2 border-white/10 border-dashed rounded-2xl cursor-pointer bg-black/20 hover:bg-black/30 transition-all duration-300 ease-in-out"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                    </svg>
                    {fileName ? (
                        <p className="font-semibold text-[#00adef]">{fileName}</p>
                    ) : (
                        <>
                            <p className="mb-2 text-sm text-gray-400"><span className="font-semibold text-gray-200">Clique para enviar</span> ou arraste e solte</p>
                            <p className="text-xs text-gray-500">Qualquer formato de vídeo (MP4, MOV, etc.)</p>
                        </>
                    )}
                </div>
                <input id="dropzone-file" type="file" className="hidden" onChange={handleChange} accept="video/*" />
            </label>
        </div>
    );
};