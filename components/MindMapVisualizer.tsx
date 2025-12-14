import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { MindMapNode } from '../types';

interface Props {
  data: MindMapNode;
}

// Visual Configuration - Strict Palette
const CONFIG = {
  nodeMaxWidth: 240,
  minNodeHeight: 64,
  levelSpacing: 320,
  nodePaddingX: 24,
  nodePaddingY: 20,
  siblingSpacing: 40,
  fontFamily: "'Cairo', sans-serif",
  fontSize: 15,
  lineHeight: 1.6,
  // Palette
  colors: {
    background: "#FFFFFF",
    text: "#111111",
    border: "#111111",
    accent: "#E65100", // Dark Orange
    nodes: {
        root: "#FFF8E1",  // Very light amber for root
        main: "#FFF3E0",  // Light orange tint for main branches
        sub: "#FAFAFA",   // Very light gray for sub-branches
        detail: "#FFFFFF" // Pure white for details
    }
  }
};

const MindMapVisualizer: React.FC<Props> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!data || !svgRef.current || !wrapperRef.current) return;

    // 1. Setup Canvas for Precise Text Measurement
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (context) {
      context.font = `bold ${CONFIG.fontSize}px Cairo, sans-serif`;
    }

    const wrapText = (text: string, maxWidth: number): string[] => {
      if (!text) return [""];
      if (!context) return [text];

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
    
    // 3. Process Data
    const root = d3.hierarchy<MindMapNode>(data);
    
    root.descendants().forEach((d: any) => {
      const availableWidth = CONFIG.nodeMaxWidth - (CONFIG.nodePaddingX * 2);
      d.data.lines = wrapText(d.data.name, availableWidth);
      
      const textHeight = d.data.lines.length * CONFIG.fontSize * CONFIG.lineHeight;
      d.data.contentHeight = Math.max(
        CONFIG.minNodeHeight, 
        textHeight + (CONFIG.nodePaddingY * 2)
      );
      
      d.data.contentWidth = CONFIG.nodeMaxWidth;
    });

    // 4. Tree Layout
    const treeLayout = d3.tree<MindMapNode>()
      .nodeSize([1, CONFIG.levelSpacing]) 
      .separation((a, b) => {
         const aHeight = (a as any).data.contentHeight;
         const bHeight = (b as any).data.contentHeight;
         return (aHeight / 2) + (bHeight / 2) + CONFIG.siblingSpacing; 
      });

    treeLayout(root);

    // 5. Calculate Bounding Box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    root.descendants().forEach((d: any) => {
      const screenX = -d.y;
      const screenY = d.x;
      const w = d.data.contentWidth;
      const h = d.data.contentHeight;

      minX = Math.min(minX, screenX - w/2);
      maxX = Math.max(maxX, screenX + w/2);
      minY = Math.min(minY, screenY - h/2);
      maxY = Math.max(maxY, screenY + h/2);
    });

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

    // Define Shadow Filter
    const defs = svgElement.append("defs");
    const filter = defs.append("filter")
      .attr("id", "node-shadow")
      .attr("height", "130%");
    
    filter.append("feGaussianBlur")
      .attr("in", "SourceAlpha")
      .attr("stdDeviation", 2) // Subtle blur
      .attr("result", "blur");
      
    filter.append("feOffset")
      .attr("in", "blur")
      .attr("dx", 1) // Subtle offset
      .attr("dy", 2)
      .attr("result", "offsetBlur");
      
    filter.append("feComponentTransfer")
       .append("feFuncA")
       .attr("type", "linear")
       .attr("slope", 0.3); // Reduce shadow opacity

    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "offsetBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // 6. Rendering
    const g = svgElement.append("g");

    const screenX = (d: any) => -d.y;
    const screenY = (d: any) => d.x;

    // -- Links (Whimsical Style) --
    // Smooth, organic curves with rounded caps
    g.selectAll(".link")
      .data(root.links())
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", CONFIG.colors.accent) // Dark Orange
      .attr("stroke-width", (d: any) => Math.max(1, 3 - d.target.depth * 0.5)) // Thicker near root
      .attr("stroke-opacity", 0.6)
      .attr("stroke-linecap", "round") // Rounded ends
      .attr("stroke-linejoin", "round")
      .attr("d", (d: any) => {
        const sX = screenX(d.source) - (d.source.data.contentWidth / 2);
        const sY = screenY(d.source);
        const tX = screenX(d.target) + (d.target.data.contentWidth / 2);
        const tY = screenY(d.target);
        
        // Slightly curvier links
        return d3.linkHorizontal()
          .x((d: any) => d[0])
          .y((d: any) => d[1])
          ({ source: [sX, sY], target: [tX, tY] });
      });

    // -- Nodes --
    const node = g.selectAll(".node")
      .data(root.descendants())
      .join("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${screenX(d)},${screenY(d)})`);

    // Node Card
    node.append("rect")
      .attr("width", (d: any) => d.data.contentWidth)
      .attr("height", (d: any) => d.data.contentHeight)
      .attr("x", (d: any) => -d.data.contentWidth / 2)
      .attr("y", (d: any) => -d.data.contentHeight / 2)
      .attr("rx", (d) => {
          // Visually distinct corners based on hierarchy
          if (d.depth === 0) return 16;
          if (d.depth === 1) return 12;
          return 8;
      })
      .attr("ry", (d) => {
          if (d.depth === 0) return 16;
          if (d.depth === 1) return 12;
          return 8;
      })
      .attr("fill", (d) => {
         // Semantic background coloring
         if (d.depth === 0) return CONFIG.colors.nodes.root;
         if (d.depth === 1) return CONFIG.colors.nodes.main;
         if (d.depth === 2) return CONFIG.colors.nodes.sub;
         return CONFIG.colors.nodes.detail;
      })
      .attr("stroke", CONFIG.colors.border) 
      .attr("stroke-width", (d) => {
         // Thicker borders for higher hierarchy
         if (d.depth === 0) return 3;
         if (d.depth === 1) return 2.5;
         if (d.depth === 2) return 1.5;
         return 1;
      })
      .attr("filter", (d) => {
          // Apply shadow to top-level nodes for depth
          return d.depth < 2 ? "url(#node-shadow)" : null;
      });

    // Text Lines
    node.each(function(d: any) {
      const el = d3.select(this);
      const lines = d.data.lines;
      const totalTextH = lines.length * CONFIG.fontSize * CONFIG.lineHeight;
      const startY = -(totalTextH / 2) + (CONFIG.fontSize * CONFIG.lineHeight * 0.35);

      el.append("text")
        .attr("font-family", CONFIG.fontFamily)
        .attr("font-size", (d: any) => {
            if (d.depth === 0) return CONFIG.fontSize * 1.2;
            return CONFIG.fontSize;
        })
        .attr("font-weight", (d: any) => {
             if (d.depth === 0) return "800";
             if (d.depth === 1) return "700";
             return "500";
        })
        .attr("fill", (d: any) => {
            if (d.depth === 0) return CONFIG.colors.accent; 
            return CONFIG.colors.text;
        })
        .attr("text-anchor", "middle")
        .selectAll("tspan")
        .data(lines)
        .join("tspan")
        .attr("x", 0)
        .attr("y", (_: any, i: number) => startY + (i * CONFIG.fontSize * CONFIG.lineHeight))
        .text((t: any) => t);
    });

    // Zoom Behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svgElement.call(zoom as any);
    svgElement.on("dblclick.zoom", null);

  }, [data]);

  return (
    <div ref={wrapperRef} className="w-full h-[700px] border-2 border-[#111111] bg-white overflow-hidden relative text-right rounded-xl" dir="rtl">
       {/* Legend/Controls */}
       <div className="absolute top-4 right-4 z-10 bg-white/95 p-3 text-xs border border-[#111111] rounded-lg shadow-sm">
         <div className="flex flex-col gap-1 text-[#111111]">
             <span className="font-bold mb-1">التحكم:</span>
             <span className="flex items-center gap-2">🖱️ السحب للتحريك</span>
             <span className="flex items-center gap-2">🔍 العجلة للتكبير</span>
         </div>
       </div>
      <svg ref={svgRef} className="w-full h-full touch-pan-x touch-pan-y cursor-grab active:cursor-grabbing"></svg>
    </div>
  );
};

export default MindMapVisualizer;
