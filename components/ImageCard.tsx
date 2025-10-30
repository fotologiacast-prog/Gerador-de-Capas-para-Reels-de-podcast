import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { GeneratedImage } from '../types';
import { DownloadIcon, RefreshIcon, DeleteIcon } from './Icons';

// Preload icon to avoid canvas drawing race conditions
const micIcon = new Image();
micIcon.src = `data:image/svg+xml,${encodeURIComponent('<svg id="fi_2882877" enable-background="new 0 0 512 512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="white"><g><path d="m226 270h-73.92c7.29 50.82 51.11 90 103.92 90s96.63-39.18 103.92-90h-73.92v-30h75v-45h-75v-30h75v-45h-75v-30h73.92c-7.29-50.82-51.11-90-103.92-90s-96.63 39.18-103.92 90h73.92v30h-75v45h75v30h-75v45h75z"></path><path d="m271 419.33c83.98-7.61 150-78.41 150-164.33-3.801 0-21.451 0-30 0 0 74.514-60.629 135-135 135-74.44 0-135-60.56-135-135h-30c0 85.92 66.02 156.72 150 164.33v62.67h-105v30h240v-30h-105z"></path></g></svg>')}`;

interface ImageCardProps {
    image: GeneratedImage;
    onUpdate: (id: string, field: keyof Omit<GeneratedImage, 'id' | 'originalBlur'>, value: string | number) => void;
    globalHighlightColor: string;
    onRegenerate: (id: string) => void;
    isRegenerating: boolean;
    onRefocus: (id: string, newCropX: number) => void;
    onDelete: (id: string) => void;
}

const ActionButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, className, ...props }) => (
    <button
        className={`p-2 rounded-lg text-white backdrop-blur-md border transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
    >
        {children}
    </button>
);


export const ImageCard: React.FC<ImageCardProps> = ({ image, onUpdate, globalHighlightColor, onRegenerate, isRegenerating, onRefocus, onDelete }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [finalImageSrc, setFinalImageSrc] = useState(image.finalImage);
    const [isRefocusing, setIsRefocusing] = useState(false);
    const [localCropX, setLocalCropX] = useState(image.cropPositionX);

    useEffect(() => {
        setLocalCropX(image.cropPositionX);
    }, [image.cropPositionX]);

    const drawImageWithText = useCallback(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bgImage = new Image();
        bgImage.onload = () => {
            canvas.width = bgImage.width;
            canvas.height = bgImage.height;
            ctx.drawImage(bgImage, 0, 0);

            if (!image.text.trim()) {
                const newFinal = canvas.toDataURL('image/jpeg');
                setFinalImageSrc(newFinal);
                onUpdate(image.id, 'finalImage', newFinal);
                return;
            }

            const BOX_WIDTH = canvas.width * 0.8;
            const BOX_PADDING = BOX_WIDTH * 0.1;
            const BOX_RADIUS = 35;
            const BORDER_WIDTH = 4;
            const MAX_LINES = 3;

            let effectiveFontSize = image.fontSize;
            let lines: string[] = [];

            // Loop to adjust font size if text overflows 3 lines
            if (image.text.trim()) {
                let lastAttemptLines: string[] = [];
                while (effectiveFontSize >= 20) {
                    ctx.font = `500 ${effectiveFontSize}px Sora, sans-serif`;
                    const words = image.text.split(' ');
                    let line = '';
                    const currentLines: string[] = [];
                    for(let n = 0; n < words.length; n++) {
                        const testLine = line + words[n] + ' ';
                        const metrics = ctx.measureText(testLine);
                        if (metrics.width > BOX_WIDTH - BOX_PADDING * 2 && n > 0) {
                            currentLines.push(line.trim());
                            line = words[n] + ' ';
                        } else {
                            line = testLine;
                        }
                    }
                    currentLines.push(line.trim());
                    lastAttemptLines = currentLines.filter(l => l);

                    if(lastAttemptLines.length <= MAX_LINES) {
                        break; // Found a good size
                    }
                    effectiveFontSize -= 4; // Shrink and try again
                }
                lines = lastAttemptLines;
                effectiveFontSize = Math.max(20, effectiveFontSize);
            }
            
            // Define fonts and line height based on the final effective font size
            const LINE_HEIGHT = effectiveFontSize * 1.2;
            const FONT_NORMAL = `500 ${effectiveFontSize}px Sora, sans-serif`;
            const FONT_BOLD = `800 ${effectiveFontSize}px Sora, sans-serif`;
            
            // Box height is fixed, based on 3 lines of the ORIGINAL font size from the slider
            const baseLineHeight = image.fontSize * 1.2;
            const boxHeight = (MAX_LINES * baseLineHeight) + (BOX_PADDING * 2);
            const boxX = (canvas.width - BOX_WIDTH) / 2;
            const boxY = (canvas.height - boxHeight) / 2;

            // Icon size is also based on the original font size for consistency
            const ICON_SIZE = image.fontSize * 1.5;

            const boxPath = new Path2D();
            boxPath.moveTo(boxX + BOX_RADIUS, boxY);
            boxPath.lineTo(boxX + BOX_WIDTH - BOX_RADIUS, boxY);
            boxPath.arcTo(boxX + BOX_WIDTH, boxY, boxX + BOX_WIDTH, boxY + BOX_RADIUS, BOX_RADIUS);
            boxPath.lineTo(boxX + BOX_WIDTH, boxY + boxHeight - BOX_RADIUS);
            boxPath.arcTo(boxX + BOX_WIDTH, boxY + boxHeight, boxX + BOX_WIDTH - BOX_RADIUS, boxY + boxHeight, BOX_RADIUS);
            boxPath.lineTo(boxX + BOX_RADIUS, boxY + boxHeight);
            boxPath.arcTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - BOX_RADIUS, BOX_RADIUS);
            boxPath.lineTo(boxX, boxY + BOX_RADIUS);
            boxPath.arcTo(boxX, boxY, boxX + BOX_RADIUS, boxY, BOX_RADIUS);
            boxPath.closePath();

            ctx.fillStyle = 'rgba(20, 20, 20, 0.75)';
            ctx.fill(boxPath);

            ctx.save();
            ctx.lineWidth = BORDER_WIDTH;

            const cornerSize = BOX_WIDTH * 0.5;

            // Top-Right Corner Gradient
            const trGradient = ctx.createRadialGradient(
                boxX + BOX_WIDTH, boxY, 0,
                boxX + BOX_WIDTH, boxY, cornerSize
            );
            trGradient.addColorStop(0, globalHighlightColor);
            trGradient.addColorStop(1, 'transparent');

            // Bottom-Left Corner Gradient
            const blGradient = ctx.createRadialGradient(
                boxX, boxY + boxHeight, 0,
                boxX, boxY + boxHeight, cornerSize
            );
            blGradient.addColorStop(0, globalHighlightColor);
            blGradient.addColorStop(1, 'transparent');

            // Stroke with the first gradient
            ctx.strokeStyle = trGradient;
            ctx.stroke(boxPath);

            // Use 'lighter' to additively blend the second gradient
            ctx.globalCompositeOperation = 'lighter';
            ctx.strokeStyle = blGradient;
            ctx.stroke(boxPath);
            
            ctx.restore();

            if(micIcon.complete) {
                ctx.drawImage(micIcon, (canvas.width - ICON_SIZE) / 2, boxY - (ICON_SIZE / 1.8), ICON_SIZE, ICON_SIZE);
            }
            
            ctx.textBaseline = 'middle';
            // Center the actual text block vertically within the fixed-height box
            const actualTextBlockHeight = lines.length * LINE_HEIGHT;
            const startY = boxY + boxHeight / 2 - (actualTextBlockHeight / 2) + (LINE_HEIGHT / 2);
            const highlight = image.highlightedWord.trim().toLowerCase();
            
            lines.forEach((currentLine, i) => {
                const lineY = startY + (i * LINE_HEIGHT);
                const lineWords = currentLine.split(' ');
                
                let totalLineWidth = 0;
                lineWords.forEach(word => {
                    const cleanWord = word.replace(/[.,!?;:]/g, '').toLowerCase();
                    const isHighlighted = highlight && cleanWord === highlight;
                    ctx.font = isHighlighted ? FONT_BOLD : FONT_NORMAL;
                    totalLineWidth += ctx.measureText(word).width;
                });
                totalLineWidth += ctx.measureText(' ').width * (lineWords.length > 0 ? lineWords.length - 1 : 0);

                let currentX = (canvas.width / 2) - (totalLineWidth / 2);
                ctx.textAlign = 'left';

                lineWords.forEach(word => {
                    const cleanWord = word.replace(/[.,!?;:]/g, '').toLowerCase();
                    const isHighlighted = highlight && cleanWord === highlight;
                    
                    ctx.font = isHighlighted ? FONT_BOLD : FONT_NORMAL;
                    ctx.fillStyle = isHighlighted ? globalHighlightColor : 'white';
                    
                    ctx.fillText(word, currentX, lineY);
                    currentX += ctx.measureText(word + ' ').width;
                });
            });
            const newFinalImage = canvas.toDataURL('image/jpeg');
            setFinalImageSrc(newFinalImage);
            onUpdate(image.id, 'finalImage', newFinalImage);
        };
        bgImage.src = image.originalBlur;
    }, [image.text, image.highlightedWord, image.originalBlur, globalHighlightColor, image.fontSize, onUpdate, image.id]);

    useEffect(() => {
        const render = () => drawImageWithText();
        if (micIcon.complete) {
            render();
        } else {
            micIcon.onload = render;
        }
    }, [image.originalBlur, image.text, image.highlightedWord, globalHighlightColor, image.fontSize, drawImageWithText]);

    const handleDownload = () => {
        const link = document.createElement('a');
        link.href = finalImageSrc;
        const sanitizedTitle = image.title.replace(/[\s\W]+/g, '_') || `capa`;
        link.download = `${sanitizedTitle}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = () => {
        if (window.confirm('Tem certeza que deseja excluir esta capa? Esta ação não pode ser desfeita.')) {
            onDelete(image.id);
        }
    };

    const handleHighlight = () => {
        if (!textareaRef.current) return;
        const textarea = textareaRef.current;
        const selection = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
        if (selection && selection.length > 0) {
            onUpdate(image.id, 'highlightedWord', selection);
        }
    };
    
    const handleFocusSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newCropX = parseInt(e.target.value, 10);
        setLocalCropX(newCropX);
    };

    const handleFocusSliderRelease = () => {
        if (localCropX !== image.cropPositionX) {
            setIsRefocusing(true);
            onUpdate(image.id, 'cropPositionX', localCropX);
            onRefocus(image.id, localCropX);
        }
    };

    useEffect(() => {
      setIsRefocusing(false);
    }, [image.originalBlur]);
    
    const isLoading = isRegenerating || isRefocusing;

    return (
        <div className="bg-black/40 backdrop-blur-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col">
            <div className="relative group aspect-[9/16]">
                <img src={finalImageSrc} alt="Generated thumbnail" className="w-full h-full object-cover" />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>

                <div className="absolute top-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionButton
                        onClick={handleDelete}
                        disabled={isLoading}
                        title="Excluir Capa"
                        className="bg-red-500/20 border-red-400/30 hover:bg-red-500/40"
                    >
                        <DeleteIcon className="w-5 h-5" />
                    </ActionButton>
                    <ActionButton
                        onClick={() => onRegenerate(image.id)}
                        disabled={isLoading}
                        title="Regerar Quadro"
                        className="bg-blue-500/20 border-blue-400/30 hover:bg-blue-500/40"
                    >
                        <RefreshIcon className="w-5 h-5" />
                    </ActionButton>
                    <ActionButton
                        onClick={handleDownload}
                        disabled={isLoading}
                        title="Baixar Imagem"
                        className="bg-green-500/20 border-green-400/30 hover:bg-green-500/40"
                    >
                        <DownloadIcon className="w-5 h-5" />
                    </ActionButton>
                </div>
                
                {isLoading && (
                     <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}
            </div>
            <div className="p-4 flex-grow flex flex-col space-y-4">
                <input
                    type="text"
                    value={image.title}
                    onChange={(e) => onUpdate(image.id, 'title', e.target.value)}
                    className="w-full bg-black/30 text-white font-semibold text-center rounded-lg p-2 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#00adef] transition"
                    placeholder="Digite o título da capa..."
                    disabled={isLoading}
                />
                <textarea
                    ref={textareaRef}
                    onMouseUp={handleHighlight}
                    onTouchEnd={handleHighlight}
                    placeholder="Texto Principal..."
                    value={image.text}
                    onChange={(e) => {
                        if (image.highlightedWord) {
                            onUpdate(image.id, 'highlightedWord', '');
                        }
                        onUpdate(image.id, 'text', e.target.value)
                    }}
                    className="w-full bg-black/30 text-white rounded-2xl p-2 border border-white/10 focus:outline-none focus:ring-2 focus:ring-[#00adef] transition font-mono"
                    rows={3}
                    disabled={isLoading}
                />
                 <div className="text-xs text-gray-400">
                    Selecione o texto acima para destacá-lo.
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                         <label htmlFor={`font-size-${image.id}`} className="text-xs text-gray-400">Tamanho da Fonte</label>
                         <span className="w-12 text-center text-sm font-mono text-gray-400 bg-black/30 rounded-md py-1">
                            {image.fontSize}
                        </span>
                    </div>
                    <div className="flex items-center gap-3">
                        <input
                            id={`font-size-${image.id}`}
                            type="range"
                            min="40"
                            max="150"
                            step="1"
                            value={image.fontSize}
                            onChange={(e) => onUpdate(image.id, 'fontSize', parseInt(e.target.value, 10))}
                            className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer accent-[#00adef]"
                            disabled={isLoading}
                        />
                    </div>
                </div>
                 <div className="space-y-1">
                     <label htmlFor={`crop-position-${image.id}`} className="text-xs text-gray-400">Foco Horizontal</label>
                    <input
                        id={`crop-position-${image.id}`}
                        type="range"
                        value={localCropX}
                        onChange={handleFocusSliderChange}
                        onMouseUp={handleFocusSliderRelease}
                        onTouchEnd={handleFocusSliderRelease}
                        min="0"
                        max="100"
                        className="w-full h-2 bg-black/30 rounded-lg appearance-none cursor-pointer accent-[#00adef]"
                        disabled={isLoading}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Esquerda</span>
                        <span>Centro</span>
                        <span>Direita</span>
                    </div>
                </div>
            </div>
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};