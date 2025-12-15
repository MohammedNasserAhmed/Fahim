import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Creates a Web Worker to handle timing, preventing browser throttling.
 */
const createTimerWorker = () => {
  const workerScript = `
    self.onmessage = function(e) {
      setTimeout(function() {
        self.postMessage('tick');
      }, e.data);
    };
  `;
  const blob = new Blob([workerScript], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

/**
 * Explicitly waits for critical Arabic fonts to load.
 */
const ensureFontsLoaded = async () => {
  const fontFamilies = ['Amiri', 'Cairo', 'Noto Naskh Arabic'];
  // Create a dummy element to force font loading
  const div = document.createElement('div');
  div.style.visibility = 'hidden';
  div.style.position = 'absolute';
  div.style.top = '-9999px';
  // Include some arabic text to trigger glyph loading
  div.innerHTML = fontFamilies.map(f => `<span style="font-family: '${f}'">بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ</span>`).join('');
  document.body.appendChild(div);

  try {
    // Wait for document fonts
    await document.fonts.ready;
    
    // Explicit check
    let allReady = false;
    for (let i = 0; i < 20; i++) { // Wait up to 10 seconds
        const check = fontFamilies.every(font => document.fonts.check(`16px "${font}"`));
        if (check) {
            allReady = true;
            break;
        }
        await new Promise(r => setTimeout(r, 500));
    }
    
    if (!allReady) {
        console.warn("Fonts might not be fully loaded. Export may have artifacts.");
    }
  } catch (e) {
    console.warn("Font loading error:", e);
  } finally {
    document.body.removeChild(div);
  }
};

/**
 * Captures a DOM element with a specific timeout.
 */
const captureWithTimeout = async (element: HTMLElement, options: any, timeoutMs: number): Promise<HTMLCanvasElement> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Render timeout after ${timeoutMs}ms`)), timeoutMs);
  });

  const renderPromise = html2canvas(element, {
    useCORS: true,
    logging: false,
    allowTaint: true,
    backgroundColor: '#ffffff',
    ...options
  });

  return Promise.race([renderPromise, timeoutPromise]);
};

/**
 * Safely captures a DOM element with retries and quality fallback.
 */
const safeCaptureWithRetry = async (element: HTMLElement, options: any): Promise<HTMLCanvasElement> => {
  // Attempt 1: High Quality (Scale 2) - 60s
  try {
    return await captureWithTimeout(element, { ...options, scale: 2 }, 60000);
  } catch (error) {
    console.warn('High quality export failed. Retrying standard...', error);
  }

  // Attempt 2: Standard Quality (Scale 1) - 60s
  await new Promise(r => setTimeout(r, 500));
  try {
    return await captureWithTimeout(element, { ...options, scale: 1 }, 60000);
  } catch (error) {
    console.warn('Standard quality export failed. Retrying low...', error);
  }

  // Attempt 3: Low Quality (Scale 0.7) - 60s
  await new Promise(r => setTimeout(r, 500));
  return await captureWithTimeout(element, { ...options, scale: 0.7 }, 60000);
};

export type PDFExportAction = 'download' | 'blob';

export const generatePDF = async (
  elementId: string, 
  filename: string,
  onProgress: (status: string, progress: number) => void,
  action: PDFExportAction = 'download'
): Promise<Blob | void> => {
  
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Export template not found.');

  // Initialize Worker
  const timerWorker = createTimerWorker();
  const yieldToMain = (ms: number = 50) => new Promise(resolve => {
    const handler = () => {
        timerWorker.removeEventListener('message', handler);
        resolve(true);
    };
    timerWorker.addEventListener('message', handler);
    timerWorker.postMessage(ms);
  });

  try {
    onProgress('جاري التحقق من الخطوط وتجهيز المستند...', 2);
    await yieldToMain(100);
    
    // STRICT FONT LOADING
    await ensureFontsLoaded();
    
    onProgress('بدء عملية المعالجة...', 5);

    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 10;
    const contentWidth = pdfWidth - (2 * margin);

    const pdf = new jsPDF('p', 'mm', 'a4');
    const sections = Array.from(element.querySelectorAll('.pdf-export-section'));
    
    if (sections.length === 0) throw new Error('لا يوجد محتوى للتصدير.');

    let currentY = margin;
    let pageNumber = 1;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i] as HTMLElement;
      
      // -- Part A: Text Content --
      const textPart = section.querySelector('.pdf-text-part') as HTMLElement;
      if (textPart) {
        const sectionTitle = textPart.querySelector('h2')?.textContent || `فصل ${i + 1}`;
        onProgress(`جاري معالجة النصوص: ${sectionTitle}`, Math.round((i / sections.length) * 100));
        await yieldToMain(50); 

        try {
          // Temporarily force font usage on the element before capture
          textPart.style.fontFamily = "'Amiri', serif";
          
          const textCanvas = await safeCaptureWithRetry(textPart, {
            onclone: (clonedDoc: Document) => {
               // Ensure fonts are preserved in clone
               const clonedElement = clonedDoc.querySelector('.pdf-text-part') as HTMLElement;
               if (clonedElement) {
                 clonedElement.style.fontFamily = "'Amiri', serif";
               }
            }
          });
          
          const imgData = textCanvas.toDataURL('image/jpeg', 0.85); // Increased quality for text readability
          const imgProps = pdf.getImageProperties(imgData);
          const imgHeight = (imgProps.height * contentWidth) / imgProps.width;

          if (currentY + imgHeight > pdfHeight - margin) {
            pdf.addPage();
            currentY = margin;
            pageNumber++;
          }

          pdf.addImage(imgData, 'JPEG', margin, currentY, contentWidth, imgHeight);
          currentY += imgHeight + 5;
        } catch (err) {
          console.error(`Failed text section ${i}`, err);
          pdf.setFontSize(10);
          pdf.setTextColor(255, 0, 0);
          pdf.text(`Error rendering section ${i + 1}`, margin, currentY);
          currentY += 10;
        }
      }

      // -- Part B: Mind Map --
      const mapPart = section.querySelector('.pdf-map-part') as HTMLElement;
      if (mapPart) {
        onProgress(`جاري رسم الخريطة: القسم ${i + 1}`, Math.round(((i + 0.5) / sections.length) * 100));
        await yieldToMain(50);

        try {
          const mapCanvas = await safeCaptureWithRetry(mapPart, {
             ignoreElements: (el: Element) => el.classList.contains('ignore-export')
          });

          const mapImgData = mapCanvas.toDataURL('image/jpeg', 0.85);
          const mapImgProps = pdf.getImageProperties(mapImgData);
          const mapHeight = (mapImgProps.height * contentWidth) / mapImgProps.width;

          if (currentY + mapHeight > pdfHeight - margin) {
            pdf.addPage();
            currentY = margin;
            pageNumber++;
          }

          pdf.addImage(mapImgData, 'JPEG', margin, currentY, contentWidth, mapHeight);
          currentY += mapHeight + 10;
        } catch (err) {
          console.error(`Failed map section ${i}`, err);
          pdf.setFontSize(10);
          pdf.setTextColor(255, 0, 0);
          pdf.text(`Error rendering map`, margin, currentY);
          currentY += 10;
        }
      }

      if (i < sections.length - 1) {
         if (currentY < pdfHeight - 30) {
           pdf.setDrawColor(200, 200, 200);
           pdf.line(margin, currentY, pdfWidth - margin, currentY);
           currentY += 10;
         } else {
           pdf.addPage();
           currentY = margin;
           pageNumber++;
         }
      }
    }

    onProgress('جاري حفظ الملف النهائي...', 100);
    await yieldToMain(100);
    
    // Page Numbers
    const totalPages = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(10);
      pdf.setTextColor(150);
      pdf.text(`صفحة ${i} من ${totalPages}`, pdfWidth / 2, pdfHeight - 5, { align: 'center' });
    }

    if (action === 'download') {
      pdf.save(filename);
    } else {
      return pdf.output('blob');
    }

  } finally {
    timerWorker.terminate();
  }
};