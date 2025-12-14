import React from 'react';
import { Share2, X, MessageCircle, Send, Mail, Copy, Smartphone, Twitter, Linkedin } from 'lucide-react';
import { AnalyzedSection } from '../types';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSharePDF: () => void;
  sections: AnalyzedSection[];
}

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, onSharePDF, sections }) => {
  if (!isOpen) return null;

  const appUrl = window.location.origin;
  const title = sections.length > 0 ? sections[0].title : 'ملخص فهيم';
  const summaryText = `اطلع على هذا الملخص الذكي من فهيم: "${title}"\n\n${appUrl}`;

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(summaryText)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(appUrl)}&text=${encodeURIComponent(title)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(summaryText)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(appUrl)}`,
    email: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(summaryText)}`
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(summaryText).then(() => {
      alert('تم نسخ الرابط والنص إلى الحافظة');
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100" dir="rtl">
        
        {/* Header */}
        <div className="bg-[#111111] p-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            <h3 className="font-bold text-lg">مشاركة المحتوى</h3>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-1 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Primary Action: Share File */}
          <div className="bg-orange-50 rounded-xl p-5 border border-orange-100">
             <h4 className="font-bold text-[#E65100] mb-3 flex items-center gap-2">
                <Smartphone className="w-5 h-5" />
                مشاركة ملف PDF
             </h4>
             <p className="text-sm text-gray-600 mb-4">
                توليد ملف PDF عالي الدقة ومشاركته مباشرة عبر تطبيقات الجهاز (واتساب، تيليجرام، وغيرها).
             </p>
             <button 
               onClick={onSharePDF}
               className="w-full bg-[#E65100] hover:bg-[#CC4700] text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2"
             >
               <Share2 className="w-4 h-4" />
               مشاركة الملف عبر النظام
             </button>
          </div>

          <div className="border-t border-gray-100"></div>

          {/* Secondary Actions: Social Links */}
          <div>
            <h4 className="font-bold text-[#111111] mb-4 text-sm opacity-70">أو مشاركة الرابط والنص:</h4>
            <div className="grid grid-cols-4 gap-4">
               {/* WhatsApp */}
               <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-medium text-gray-600">واتساب</span>
               </a>

               {/* Telegram */}
               <a href={shareLinks.telegram} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 rounded-full bg-[#0088cc] text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Send className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-600">تيليجرام</span>
               </a>

               {/* X / Twitter */}
               <a href={shareLinks.twitter} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Twitter className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-600">منصة X</span>
               </a>

               {/* Email */}
               <a href={shareLinks.email} className="flex flex-col items-center gap-2 group">
                  <div className="w-12 h-12 rounded-full bg-gray-600 text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <Mail className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-medium text-gray-600">بريد</span>
               </a>
            </div>
          </div>
          
          {/* Copy Link */}
          <button 
            onClick={handleCopyLink}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 text-gray-600 font-medium transition-all"
          >
            <Copy className="w-4 h-4" />
            نسخ رابط التطبيق وملخص العنوان
          </button>

        </div>
      </div>
    </div>
  );
};

export default ShareModal;
