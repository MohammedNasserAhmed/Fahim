import React, { useState } from 'react';
import { editConceptImage } from '../services/geminiService';
import { Loader2, Wand2, X } from 'lucide-react';

interface Props {
  imageUrl: string;
  conceptName: string;
  onClose: () => void;
  onUpdateImage: (newUrl: string) => void;
}

const ImageEditor: React.FC<Props> = ({ imageUrl, conceptName, onClose, onUpdateImage }) => {
  const [prompt, setPrompt] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [currentImage, setCurrentImage] = useState(imageUrl);
  const [error, setError] = useState<string | null>(null);

  const handleEdit = async () => {
    if (!prompt.trim()) return;
    setIsEditing(true);
    setError(null);
    try {
      const newUrl = await editConceptImage(currentImage, prompt);
      setCurrentImage(newUrl);
      onUpdateImage(newUrl);
      setPrompt('');
    } catch (e) {
      setError('فشل تعديل الصورة. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">استوديو الصور الذكي: {conceptName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-200 rounded-full">
            <X className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto flex flex-col items-center bg-slate-100">
          <div className="relative group w-full max-w-md aspect-square bg-slate-200 rounded-lg overflow-hidden shadow-md">
             <img src={currentImage} alt={conceptName} className="w-full h-full object-contain" />
             {isEditing && (
               <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
                 <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
               </div>
             )}
          </div>
        </div>

        <div className="p-4 border-t bg-white">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            تعديل الصورة باستخدام Gemini 2.5 Flash
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="مثال: أضف فلتر قديم، اجعل الخلفية زرقاء..."
              className="flex-1 border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              onKeyDown={(e) => e.key === 'Enter' && handleEdit()}
            />
            <button
              onClick={handleEdit}
              disabled={isEditing || !prompt.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {isEditing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              تعديل
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
