# Fahim 🚀📄🤖

[![Project](https://img.shields.io/badge/project-Fahim-blue)](https://github.com/MohammedNasserAhmed/Fahim)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Vite](https://img.shields.io/badge/built%20with-vite-FF69B4.svg)](https://vitejs.dev/)
[![Gemini LLM](https://img.shields.io/badge/LLM-Gemini--2.5--flash-orange.svg)](#)
[![PDF.js](https://img.shields.io/badge/pdf.js-text-extraction-green.svg)](#)

> Fahim — Intelligent Arabic PDF-to-Mind-Map and chat interface  
> Convert Arabic PDFs to structured, searchable mind maps using Google Gemini and modern PDF processing.

---

## About ✨

arabic-chat-with-pdf (a.k.a. "Fahim") is a frontend application that extracts Arabic text from PDF files, cleans and structures the text using a large language model (Google Gemini), and builds hierarchical mind maps to help learners and educators navigate academic Arabic content. The app supports export and sharing of results and visualizes the extracted semantic structure.

Core features are implemented in:
- services/pdfService.ts — PDF text extraction (PDF.js)
- services/geminiService.ts — LLM analysis & JSON mind map creation (Google Gemini via @google/genai)
- App.tsx — UI flow for upload, processing, visualization, and export
- metadata.json — project metadata and short description

---

## Technologies 🧰

- React 19 with TypeScript
- Vite (dev server & build)
- PDF.js (text extraction from PDF)
- Google Gemini via @google/genai (model: `gemini-2.5-flash`)
- d3 (visualization)
- lucide-react (icons)
- html2canvas & jspdf (PDF export)
- Node.js + npm

Packages (from package.json):
- react, react-dom, d3, lucide-react, @google/genai, html2canvas, jspdf, vite, typescript

---

## Features ✨

- Upload Arabic PDF files and extract per-page text using PDF.js
- Clean and normalize typical PDF text artifacts (whitespace, broken joins)
- Analyze Arabic text with Gemini to:
  - Fix broken sentences from PDF extraction
  - Produce a structured JSON output containing:
    - title
    - cleaned originalText
    - hierarchical mindMap (nodes with children)
- Visualize mind maps with an interactive UI
- Export visualizations / sections to PDF
- Share via UI modal (share flow provided in app)
- Lightweight frontend-first architecture (no backend required for basic flow)

---

## ETL (Extract → Transform → Load) Process 🧩

The app implements a clear ETL pipeline that runs in the browser:

1. Extract (E)
   - File upload UI accepts only `application/pdf`.
   - `services/pdfService.ts` uses PDF.js to read the PDF as ArrayBuffer and iterate pages.
   - Text is extracted using `page.getTextContent()` and items are concatenated with spaces.
   - Basic normalization applied: collapsing multiple whitespace and trimming.

   Notes:
   - PDF text extraction often scrambles ordering or produces broken sentences due to document layout (columns, footnotes, headers).
   - The code skips pages with very short extracted text (< 50 characters) to avoid noise.

2. Transform (T)
   - Each page's raw text is sent to `services/geminiService.ts`.
   - The Gemini prompt instructs the model to:
     - Clean and reorganize the text (fix broken PDF sentences)
     - Produce a hierarchical mind map and additional metadata
     - Output MUST be valid JSON.
   - Model used: `gemini-2.5-flash` (fast, large context window)
   - Response is parsed as JSON and converted into an internal `AnalyzedSection` structure with UUIDs.

   Prompt engineering highlights:
   - The prompt constrains outputs (JSON-only) and requests one-idea-per-node.
   - The app relies on the model to "repair" the semantic flow lost in extraction.

3. Load (L)
   - The cleaned, structured sections are stored in React state (`sections`) and presented in the UI.
   - Selected section's mind map is visualized with the MindMapVisualizer component.
   - Export flows (pdfExportService + html2canvas/jspdf) allow saving the mind map and related content.

---

## LLMs & PDF Processing Techniques 🧠📝

- LLM: Google Gemini (accessed via `@google/genai` client). The project uses `gemini-2.5-flash` for a balance of speed and context window size. The app sends a carefully constructed prompt instructing the model to return strict JSON:
  - Title, cleaned original text, and a nested `mindMap` object.
  - On failure, fallback JSON with an error node is used.

- PDF processing:
  - PDF.js is used to extract text from the PDF text layer.
  - Limitations: PDF.js extracts text only when a text layer exists (not for purely scanned images).
  - The code normalizes whitespace and removes obvious artifacts, but relies on Gemini to reconstruct sentence boundaries and semantic structure.

---

## Limitations & Considerations ⚠️

- Scanned PDFs / Images:
  - This project does not include OCR. If the PDF contains scanned pages (images), text extraction will fail; integrate Tesseract or an OCR API to support scanned documents.

- Extraction Order & Layout:
  - PDF text extraction can scramble order (columns, sidebars, headers). The model attempts to fix flow, but results may vary.

- LLM Issues:
  - Responses may hallucinate or misinterpret ambiguous fragments.
  - The app enforces a JSON constraint in the prompt, but malformed LLM responses may cause parsing errors — a fallback is implemented.

- Cost & Privacy:
  - Using Gemini via Google GenAI may incur costs. Ensure you understand model billing and quotas.
  - Do not send sensitive/private documents to the LLM without proper data-handling and consent processes.

- Context & Rate Limits:
  - Large documents may exceed a single prompt window. Consider chunking strategies or an approach that stores embeddings and uses retrieval during chat.

---

## Getting Started — Quickstart 🛠️

Prerequisites:
- Node.js (16+ recommended)
- npm
- A Google GenAI API key (export as `API_KEY` in your environment)

Steps:

1. Clone the repo
   ```bash
   git clone https://github.com/MohammedNasserAhmed/Fahim.git
   cd Fahim
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set your environment variable (example)
   - On macOS / Linux:
     ```bash
     export API_KEY="your_google_genai_api_key"
     ```
   - Or create a `.env` file (note: your build tooling must load it; the app expects `process.env.API_KEY` at runtime).

4. Run dev server
   ```bash
   npm run dev
   ```
   Open the app in the browser (Vite typically serves at http://localhost:5173).

5. Usage
   - Upload an Arabic PDF via the UI.
   - Follow status messages (extracting → analyzing → complete).
   - Click to explore generated mind maps and export or share.

Notes about configuration:
- The LLM client is instantiated in `services/geminiService.ts`:
  ```ts
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  ```
- Model: `gemini-2.5-flash` and response MIME type is forced to `application/json` by the request.

---

## File / Component Overview 📁

- index.html: Arabic UI locale with fonts and PDF.js worker configuration.
- App.tsx: Primary UI logic for file upload, conversion flow, state management, export state, share modal.
- services/pdfService.ts: Extracts text per page using PDF.js and normalizes whitespace.
- services/geminiService.ts: Sends prompts to Google Gemini, enforces JSON output, constructs `AnalyzedSection`.
- components/: UI components (MindMapVisualizer, PdfExportTemplate, ShareModal, etc.)
- metadata.json: Project description and metadata.

---

## Example JSON Output (from Gemini) 🧾

Expected structure returned by the LLM (example):
```json
{
  "title": "Main section title",
  "originalText": "Cleaned Arabic text for this section...",
  "mindMap": {
    "name": "Central Concept",
    "type": "root",
    "details": "optional details",
    "children": [
      {
        "name": "Sub concept",
        "type": "node",
        "children": []
      }
    ]
  }
}
```

This JSON is parsed and converted into an `AnalyzedSection` (with a generated UUID) for visualization.

---

## Limitations of Usage & Responsible Use 🛡️

- Verify you have rights to process uploaded PDFs.
- Avoid uploading personal, secret, or sensitive data unless you implement data governance and encryption.
- Monitor API usage and costs for the Gemini model.
- Validate LLM outputs before using them for academic or legal decisions — the model can make mistakes.

---

## Roadmap & Suggested Improvements ⤴️

- Add OCR pipeline (Tesseract or cloud OCR) for scanned PDFs.
- Implement chunking + embedding storage (vector DB) for long documents and improved chat retrieval.
- Add server-side processing option to keep API keys off client devices.
- Add pagination, better error handling for malformed JSON responses, and retry strategies.
- Support for tables, equations, and image captioning.

---

## Contributing 🤝

Contributions are welcome. Please open issues or pull requests. Good first tasks:
- Add OCR support for scanned PDFs.
- Improve prompt robustness and add a schema validation step for LLM outputs.
- Add server-side proxy for the GenAI requests to better manage API keys and rate limits.

---

## Author 👤

Mohammed Nasser Ahmed — [https://github.com/MohammedNasserAhmed](https://github.com/MohammedNasserAhmed)

---

## License 📜

This repository does not include an explicit license file in the scanned files. You can use MIT as a permissive default:

MIT License — see LICENSE file (recommended).

---

If you want, I can:
- Produce the final README.md file in the repository (create PR or push) — let me know whether to use MIT or another license and whether you want the README written in Arabic (or bilingual).
- Inspect additional files in `components/` and `services/` to enrich the README with exact prop names, screenshots, or examples (note: my earlier search may be incomplete; I can fetch more files).
