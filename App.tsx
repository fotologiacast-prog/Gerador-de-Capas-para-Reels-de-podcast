import React, { useState, useRef, useCallback } from 'react';
import type { GeneratedImage } from './types';
import { FileUploader } from './components/FileUploader';
import { ImageCard } from './components/ImageCard';
import { Button } from './components/Button';
import { Loader } from './components/Loader';
import { AddCoverCard } from './components/AddCoverCard';
import JSZip from 'jszip';

const App: React.FC = () => {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [globalHighlightColor, setGlobalHighlightColor] = useState<string>('#00adef');
    const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
    const [isZipping, setIsZipping] = useState<boolean>(false);
    const [isAddingCover, setIsAddingCover] = useState<boolean>(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleFileChange = (file: File | null) => {
        setVideoFile(file);
        setGeneratedImages([]);
        setError(null);
    };

    const generateSingleFrame = useCallback(async (timestamp: number, cropX: number): Promise<Omit<GeneratedImage, 'title'> | null> => {
        if (!videoFile || !videoRef.current || !canvasRef.current) return null;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        return new Promise<Omit<GeneratedImage, 'title'>>((resolve, reject) => {
            const seekedHandler = () => {
                video.removeEventListener('seeked', seekedHandler);
                video.removeEventListener('error', seekErrorHandler);
                try {
                    const videoRatio = video.videoWidth / video.videoHeight;
                    const canvasRatio = canvas.width / canvas.height;
                    let sx = 0, sy = 0, sWidth = video.videoWidth, sHeight = video.videoHeight;

                    if (videoRatio > canvasRatio) {
                        sWidth = video.videoHeight * canvasRatio;
                        const maxSx = video.videoWidth - sWidth;
                        sx = maxSx * (cropX / 100);
                    } else {
                        sHeight = video.videoWidth / canvasRatio;
                        sy = (video.videoHeight - sHeight) / 2;
                    }
                    
                    ctx.filter = 'blur(10px)';
                    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height);
                    ctx.filter = 'none';
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    resolve({
                        id: `${timestamp}-${Math.random()}`,
                        originalBlur: dataUrl,
                        finalImage: dataUrl,
                        text: '',
                        highlightedWords: [],
                        fontSize: 70,
                        cropPositionX: cropX,
                    });
                } catch (e) {
                    reject(e);
                }
            };
            
            const seekErrorHandler = (e: Event) => {
                 video.removeEventListener('seeked', seekedHandler);
                 video.removeEventListener('error', seekErrorHandler);
                 console.error("Video seek error:", e);
                 reject(new Error("Falha ao buscar um momento específico no vídeo."));
            };
            
            video.addEventListener('seeked', seekedHandler, { once: true });
            video.addEventListener('error', seekErrorHandler, { once: true });
            video.currentTime = timestamp;
        });
    }, [videoFile]);

    const extractFrames = useCallback(async () => {
        if (!videoFile || !videoRef.current || !canvasRef.current) return;

        setIsProcessing(true);
        setError(null);
        setGeneratedImages([]);

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const videoUrl = URL.createObjectURL(videoFile);
        
        const cleanup = () => {
            if (video.src.startsWith('blob:')) {
                URL.revokeObjectURL(video.src);
            }
            video.removeAttribute('src');
            video.load();
            setIsProcessing(false);
        };

        const onLoadedMetadata = async () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            
            canvas.width = 1080;
            canvas.height = 1920;

            try {
                const firstFrame = await generateSingleFrame(video.duration / 2, 50);
                if (firstFrame) {
                    const imageWithTitle: GeneratedImage = {
                        ...firstFrame,
                        title: 'Capa 01',
                    };
                    setGeneratedImages([imageWithTitle]);
                }
            } catch (err: any) {
                console.error('Error extracting frame:', err);
                setError(err.message || 'Ocorreu um erro ao extrair o quadro.');
            } finally {
               cleanup();
            }
        };

        const onLoadedDataError = (e: Event) => {
            console.error("Video metadata load error:", e);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onLoadedDataError);
            setError("Falha ao carregar os metadados do vídeo. O arquivo pode estar corrompido ou em um formato não suportado. Tente convertê-lo para um arquivo MP4 padrão.");
            cleanup();
        }

        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true });
        video.addEventListener('error', onLoadedDataError, { once: true });
        video.src = videoUrl;

    }, [videoFile, generateSingleFrame]);
    
    const handleCardUpdate = useCallback((id: string, field: keyof Omit<GeneratedImage, 'id' | 'originalBlur'>, value: any) => {
        setGeneratedImages(prevImages =>
            prevImages.map(img => (img.id === id ? { ...img, [field]: value } : img))
        );
    }, []);

    const findNewTimestamp = (duration: number, existingTimestamps: number[]): number => {
        for (let i = 0; i < 20; i++) {
            const randomTime = Math.random() * duration;
            const minDistance = duration * 0.05;
            const isTooClose = existingTimestamps.some(ts => Math.abs(ts - randomTime) < minDistance);
            if (!isTooClose) {
                return randomTime;
            }
        }
        return Math.random() * duration;
    }

    const handleAddCover = useCallback(async () => {
        if (!videoFile || !videoRef.current || isAddingCover) return;
        setIsAddingCover(true);
        setError(null);

        const video = videoRef.current;
        const videoUrl = URL.createObjectURL(videoFile);
        
        const cleanup = () => {
            if (video.src.startsWith('blob:')) {
                URL.revokeObjectURL(video.src);
            }
            video.removeAttribute('src');
            video.load();
            setIsAddingCover(false);
        };
        
        const onLoadedMetadataForAdd = async () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadataForAdd);
            try {
                const existingTimestamps = generatedImages.map(img => parseFloat(img.id.split('-')[0]));
                const newTimestamp = findNewTimestamp(video.duration, existingTimestamps);
                
                const lastCropPositionX = generatedImages.length > 0 ? generatedImages[generatedImages.length - 1].cropPositionX : 50;

                const newFrame = await generateSingleFrame(newTimestamp, lastCropPositionX);
                if (newFrame) {
                     const imageWithTitle: GeneratedImage = {
                        ...newFrame,
                        title: `Capa 0${generatedImages.length + 1}`,
                    };
                    setGeneratedImages(prev => [...prev, imageWithTitle]);
                }
            } catch (err: any) {
                setError(err.message || 'Falha ao gerar nova capa.');
            } finally {
                cleanup();
            }
        };

        video.addEventListener('loadedmetadata', onLoadedMetadataForAdd, { once: true });
        video.addEventListener('error', () => {
            setError("Falha ao carregar o vídeo para adicionar uma nova capa.");
            cleanup();
        }, { once: true });
        video.src = videoUrl;

    }, [videoFile, generateSingleFrame, generatedImages, isAddingCover]);

    const handleRegenerateFrame = useCallback(async (idToReplace: string) => {
        if (!videoFile || !videoRef.current || isProcessing || regeneratingId) return;

        setRegeneratingId(idToReplace);
        setError(null);

        const video = videoRef.current;
        const originalImage = generatedImages.find(img => img.id === idToReplace);
        if (!originalImage) {
            setRegeneratingId(null);
            return;
        }

        const videoUrl = URL.createObjectURL(videoFile);
        
        const cleanup = () => {
            if (video.src.startsWith('blob:')) {
                URL.revokeObjectURL(video.src);
            }
            video.removeAttribute('src');
            video.load();
            setRegeneratingId(null);
        };

        const onLoadedMetadataForRegen = async () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadataForRegen);
            try {
                const existingTimestamps = generatedImages
                    .filter(img => img.id !== idToReplace)
                    .map(img => parseFloat(img.id.split('-')[0]));

                const newTimestamp = findNewTimestamp(video.duration, existingTimestamps);
                const regeneratedFrame = await generateSingleFrame(newTimestamp, originalImage.cropPositionX);

                if (regeneratedFrame) {
                    const newImage: GeneratedImage = {
                        ...originalImage,
                        id: regeneratedFrame.id,
                        originalBlur: regeneratedFrame.originalBlur,
                        finalImage: regeneratedFrame.finalImage,
                    };
                    setGeneratedImages(prev => prev.map(img => (img.id === idToReplace ? newImage : img)));
                }

            } catch (err: any) {
                setError(err.message || 'Falha ao regerar o quadro.');
            } finally {
                cleanup();
            }
        };
        
        video.addEventListener('loadedmetadata', onLoadedMetadataForRegen, { once: true });
        video.addEventListener('error', () => {
            setError("Falha ao carregar o vídeo para regeração.");
            cleanup();
        }, { once: true });
        video.src = videoUrl;

    }, [videoFile, generatedImages, isProcessing, regeneratingId, generateSingleFrame]);

    const handleRefocusSingleFrame = useCallback(async (idToUpdate: string, newCropX: number) => {
        if (!videoFile || !videoRef.current) return;
        
        const originalImage = generatedImages.find(img => img.id === idToUpdate);
        if (!originalImage) return;

        const video = videoRef.current;
        const videoUrl = URL.createObjectURL(videoFile);

        const cleanup = () => {
            if (video.src.startsWith('blob:')) {
                URL.revokeObjectURL(video.src);
            }
            video.removeAttribute('src');
            video.load();
        };

        const onLoadedMetadataForRefocus = async () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadataForRefocus);
            try {
                const timestamp = parseFloat(originalImage.id.split('-')[0]);
                const newFrameData = await generateSingleFrame(timestamp, newCropX);
                if (newFrameData) {
                    const updatedImage: GeneratedImage = {
                        ...originalImage,
                        originalBlur: newFrameData.originalBlur,
                        finalImage: newFrameData.finalImage, // Start with the new blur, text will be redrawn
                        cropPositionX: newCropX,
                    };
                    setGeneratedImages(prev => prev.map(img => img.id === idToUpdate ? updatedImage : img));
                }
            } catch (err) {
                 setError(`Falha ao atualizar o foco para ${originalImage.title}.`);
            } finally {
                cleanup();
            }
        };
        
        video.addEventListener('loadedmetadata', onLoadedMetadataForRefocus, { once: true });
        video.addEventListener('error', () => {
             setError('Falha ao carregar o vídeo para reajustar o foco.');
             cleanup();
        }, { once: true });
        video.src = videoUrl;
    }, [videoFile, generateSingleFrame, generatedImages]);

    const handleDeleteCover = useCallback((idToDelete: string) => {
        setGeneratedImages(prev => prev.filter(img => img.id !== idToDelete));
    }, []);


    const handleDownloadAll = async () => {
        if (generatedImages.length === 0 || isZipping) return;

        setIsZipping(true);
        setError(null);

        try {
            const zip = new JSZip();

            for (let i = 0; i < generatedImages.length; i++) {
                const image = generatedImages[i];
                const response = await fetch(image.finalImage);
                const blob = await response.blob();
                const sanitizedTitle = image.title.replace(/[\s\W]+/g, '_') || `capa_${i + 1}`;
                zip.file(`${sanitizedTitle}.jpg`, blob);
            }

            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(zipBlob);
            link.download = 'thumbnails.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

        } catch (err) {
            console.error("Error zipping files:", err);
            setError("Não foi possível criar o arquivo zip. Por favor, tente baixar os arquivos individualmente.");
        } finally {
            setIsZipping(false);
        }
    };


    return (
        <div className="relative min-h-screen isolate overflow-hidden">
            <div className="absolute inset-0 -z-10 overflow-hidden">
                <div className="animate-aurora-1 absolute left-[50%] top-0 h-[48rem] w-[48rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#0077b6] to-transparent opacity-20 blur-3xl"></div>
                <div className="animate-aurora-2 absolute left-[20%] top-[20%] h-[32rem] w-[50rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#00adef] to-transparent opacity-10 blur-3xl"></div>
                <div className="animate-aurora-3 absolute right-[20%] bottom-[10%] h-[24rem] w-[40rem] translate-x-1/2 rounded-full bg-gradient-to-br from-purple-600 to-transparent opacity-10 blur-3xl"></div>
            </div>

            <header className="py-4 border-b border-white/10 flex justify-center">
                <img src="https://ik.imagekit.io/zslvvoal4/Logo%20Impact.webp?updatedAt=1761153002773" alt="Gerador de Thumbnails Desfocadas Logo" className="w-auto h-10"/>
            </header>

            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <main>
                    <div className="text-center my-8 sm:my-12">
                        <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#00adef] to-[#0077b6]">
                            Gerador de Thumbnails Desfocadas
                        </h1>
                        <p className="mt-4 text-xl text-gray-400">
                            Crie fundos desfocados incríveis em 9:16 para suas redes sociais, uma capa de cada vez.
                        </p>
                    </div>
                
                    <div className="max-w-2xl mx-auto bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl p-6 mb-12 border border-white/10">
                        <div className="space-y-6">
                            <FileUploader onFileChange={handleFileChange} />
                            
                            <div className="flex items-center justify-between gap-4">
                                <label htmlFor="highlight-color" className="font-medium text-gray-200">
                                    Cor de Destaque:
                                </label>
                                <div className="relative h-10 w-24 flex-shrink-0">
                                    <input
                                        type="color"
                                        id="highlight-color"
                                        value={globalHighlightColor}
                                        onChange={(e) => setGlobalHighlightColor(e.target.value)}
                                        className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                                        title="Escolha a cor de destaque"
                                    />
                                    <div 
                                        className="w-full h-full rounded-lg border border-white/10"
                                        style={{ backgroundColor: globalHighlightColor }}
                                    />
                                </div>
                            </div>
                            
                            <Button 
                                onClick={extractFrames} 
                                disabled={!videoFile || isProcessing || !!regeneratingId || isAddingCover}
                                className="w-full"
                            >
                                {isProcessing ? 'Gerando...' : 'Gerar Capa'}
                            </Button>
                        </div>
                    </div>
                    
                    {error && (
                        <div className="text-center my-8 p-4 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg">
                            <p><strong>Erro:</strong> {error}</p>
                        </div>
                    )}

                    {isProcessing && <Loader />}
                    
                    {generatedImages.length > 0 && (
                        <>
                            <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                                <h2 className="text-2xl font-semibold text-white">Suas Capas</h2>
                                <Button onClick={handleDownloadAll} disabled={isZipping || isProcessing || !!regeneratingId || isAddingCover}>
                                    {isZipping ? 'Compactando...' : 'Baixar Todas'}
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {generatedImages.map((image) => (
                                    <ImageCard 
                                        key={image.id} 
                                        image={image} 
                                        onUpdate={handleCardUpdate}
                                        globalHighlightColor={globalHighlightColor}
                                        onRegenerate={handleRegenerateFrame}
                                        isRegenerating={regeneratingId === image.id}
                                        onRefocus={handleRefocusSingleFrame}
                                        onDelete={handleDeleteCover}
                                    />
                                ))}
                                {generatedImages.length > 0 && (
                                    <AddCoverCard 
                                        onClick={handleAddCover}
                                        isLoading={isAddingCover}
                                        isDisabled={isZipping || isProcessing || !!regeneratingId}
                                    />
                                )}
                            </div>
                        </>
                    )}

                </main>
            </div>
            <video ref={videoRef} className="hidden" muted playsInline crossOrigin="anonymous" />
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
};

export default App;