import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MindMapNode } from '../types';

interface Props {
  data: MindMapNode;
  onGenerateImage: (node: MindMapNode) => void;
}

// Visual Configuration
const CONFIG = {
  nodeMaxWidth: 240,       // Max width of a node card
  minNodeHeight: 64,       // Minimum height
  levelSpacing: 320,       // Horizontal gap between levels (larger for Arabic breathing room)
  nodePaddingX: 24,        // Horizontal padding inside card
  nodePaddingY: 20,        // Vertical padding inside card
  siblingSpacing: 40,      // Vertical gap between sibling nodes
  fontFamily: "'Cairo', sans-serif",
  fontSize: 15,
  lineHeight: 1.6,
  strokeColors: ["#1e3a8a", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"], // Dark to light blue
};

const MindMapVisualizer: React.FC<Props> = ({ data, onGenerateImage }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current || !wrapperRef.current) return;

    // 1. Setup Canvas for Precise Text Measurement
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      context.font = `bold ${CONFIG.fontSize}px Cairo, sans-serif`; // Match rendering font
    }

    /**
     * Splits text into lines ensuring no line exceeds maxWidth.
     * Uses actual font metrics for precision.
     */
    const wrapText = (text: string, maxWidth: number): string[] => {
      if (!text) return [""];
      if (!context) return [text]; // Fallback

      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = context.measureText(currentLine + " " + word).width;
        if (width < maxWidth) {
          currentLine += " " + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines;
    };

    // 2. Clear Previous Render
    const svgElement = d3.select(svgRef.current);
    svgElement.selectAll("*").remove();
    
    // 3. Process Data: Calculate Dimensions for Every Node
    const root = d3.hierarchy<MindMapNode>(data);
    
    // Compute dimensions based on text content BEFORE layout
    root.descendants().forEach((d: any) => {
      // Wrap text
      const availableWidth = CONFIG.nodeMaxWidth - (CONFIG.nodePaddingX * 2);
      d.data.lines = wrapText(d.data.name, availableWidth);
      
      // Calculate specific height for this node
      const textHeight = d.data.lines.length * CONFIG.fontSize * CONFIG.lineHeight;
      d.data.contentHeight = Math.max(
        CONFIG.minNodeHeight, 
        textHeight + (CONFIG.nodePaddingY * 2)
      );
      
      d.data.contentWidth = CONFIG.nodeMaxWidth;
    });

    // 4. Configure D3 Tree Layout
    // nodeSize([y, x]) -> We use x=1 to treat separation as pixel values
    const treeLayout = d3.tree<MindMapNode>()
      .nodeSize([1, CONFIG.levelSpacing]) 
      .separation((a, b) => {
         // Vertical distance calculation
         const aHeight = (a as any).data.contentHeight;
         const bHeight = (b as any).data.contentHeight;
         // Distance = Half A + Half B + Gap
         return (aHeight / 2) + (bHeight / 2) + CONFIG.siblingSpacing; 
      });

    treeLayout(root);

    // 5. Calculate Bounding Box for Auto-Zoom/Center
    // Note: D3 Horizontal Tree -> x is vertical (screen Y), y is horizontal (screen X)
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    root.descendants().forEach((d: any) => {
      // In our RTL flip: 
      // Screen X = -d.y
      // Screen Y = d.x
      const screenX = -d.y;
      const screenY = d.x;
      
      const w = d.data.contentWidth;
      const h = d.data.contentHeight;

      // Update bounds considering node size
      minX = Math.min(minX, screenX - w/2);
      maxX = Math.max(maxX, screenX + w/2);
      minY = Math.min(minY, screenY - h/2);
      maxY = Math.max(maxY, screenY + h/2);
    });

    // Add padding to viewbox
    const padding = 100;
    const viewBoxX = minX - padding;
    const viewBoxY = minY - padding;
    const viewBoxW = (maxX - minX) + (padding * 2);
    const viewBoxH = (maxY - minY) + (padding * 2);

    const containerWidth = wrapperRef.current.clientWidth;
    const containerHeight = wrapperRef.current.clientHeight;

    svgElement
      .attr("width", containerWidth)
      .attr("height", containerHeight)
      .attr("viewBox", `${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`)
      .attr("dir", "rtl");

    // 6. Rendering
    const g = svgElement.append("g");

    // Coordinate Mappers for RTL
    // Logic: Root is at (0,0). Children are at negative X values.
    const screenX = (d: any) => -d.y;
    const screenY = (d: any) => d.x;

    // -- Links --
    g.selectAll(".link")
      .data(root.links())
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 2)
      .attr("d", (d: any) => {
        // From Parent (Source) Left Edge -> To Child (Target) Right Edge
        const sX = screenX(d.source) - (d.source.data.contentWidth / 2);
        const sY = screenY(d.source);
        
        const tX = screenX(d.target) + (d.target.data.contentWidth / 2);
        const tY = screenY(d.target);

        return d3.linkHorizontal()({
          source: [sX, sY], // [x, y] for linkHorizontal is actually [y, x] in SVG logic?? 
          // Wait, d3.linkHorizontal expects [x, y] where x is horizontal.
          // We are passing coordinates properly here.
          target: [tX, tY]
        });
      });

    // -- Nodes --
    const node = g.selectAll(".node")
      .data(root.descendants())
      .join("g")
      .attr("class", "node group")
      .attr("transform", (d: any) => `translate(${screenX(d)},${screenY(d)})`);

    // Node Card
    node.append("rect")
      .attr("width", (d: any) => d.data.contentWidth)
      .attr("height", (d: any) => d.data.contentHeight)
      .attr("x", (d: any) => -d.data.contentWidth / 2)
      .attr("y", (d: any) => -d.data.contentHeight / 2)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", "#ffffff")
      .attr("stroke", (d) => CONFIG.strokeColors[Math.min(d.depth, CONFIG.strokeColors.length - 1)])
      .attr("stroke-width", (d) => d.depth === 0 ? 3 : 2)
      .attr("filter", "drop-shadow(0px 2px 4px rgba(0,0,0,0.08))");

    // Text Lines
    node.each(function(d: any) {
      const el = d3.select(this);
      const lines = d.data.lines;
      const totalTextH = lines.length * CONFIG.fontSize * CONFIG.lineHeight;
      const startY = -(totalTextH / 2) + (CONFIG.fontSize * CONFIG.lineHeight * 0.35); // V-Center correction

      el.append("text")
        .attr("font-family", CONFIG.fontFamily)
        .attr("font-size", CONFIG.fontSize)
        .attr("font-weight", d.depth === 0 ? "700" : "500")
        .attr("fill", "#1e293b")
        .attr("text-anchor", "middle")
        .selectAll("tspan")
        .data(lines)
        .join("tspan")
        .attr("x", 0)
        .attr("y", (_: any, i: number) => startY + (i * CONFIG.fontSize * CONFIG.lineHeight))
        .text((t: any) => t);
    });

    // Interactive Image Button (Appears on Hover)
    const btnGroup = node.append("g")
      .attr("class", "cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-90 group-hover:scale-100")
      // Position at top-left of the card
      .attr("transform", (d: any) => `translate(${(-d.data.contentWidth/2) + 20}, ${(-d.data.contentHeight/2) + 20})`)
      .on("click", (e, d) => {
        e.stopPropagation();
        onGenerateImage(d.data);
      });

    btnGroup.append("circle")
      .attr("r", 14)
      .attr("fill", "#f8fafc")
      .attr("stroke", "#8b5cf6")
      .attr("stroke-width", 1.5)
      .attr("class", "hover:fill-purple-50");

    // Image Icon Path
    btnGroup.append("path")
      .attr("d", "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5.04-6.71l-2.75 3.54-1.96-2.36L6.5 17h11l-3.54-4.71z")
      .attr("transform", "scale(0.55) translate(-12, -12)") // Centered in circle
      .attr("fill", "#8b5cf6");

    btnGroup.append("title").text("توليد صورة توضيحية");

    // 7. Zoom Behavior
    const zoom = d3.zoom()
      .scaleExtent([0.2, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svgElement.call(zoom as any);

    // Prevent double-click zoom which interferes with rapid interaction
    svgElement.on("dblclick.zoom", null);

  }, [data, onGenerateImage]);

  return (
    <div ref={wrapperRef} className="w-full h-[700px] border border-slate-200 rounded-lg bg-slate-50 overflow-hidden shadow-inner relative text-right" dir="rtl">
       {/* Legend/Controls */}
       <div className="absolute top-4 right-4 z-10 bg-white/90 p-3 text-xs rounded-lg text-slate-600 shadow-md border border-slate-200 backdrop-blur-sm pointer-events-none">
         <div className="flex flex-col gap-1">
             <span className="font-bold text-slate-800 text-sm mb-1">دليل الاستخدام:</span>
             <span className="flex items-center gap-2">🖱️ السحب للتحريك</span>
             <span className="flex items-center gap-2">🔍 العجلة للتكبير</span>
             <span className="flex items-center gap-2">🖼️ ضع الماوس على العقدة لتوليد صورة</span>
         </div>
       </div>
      <svg ref={svgRef} className="w-full h-full touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing"></svg>
    </div>
  );
};

export default MindMapVisualizer;
