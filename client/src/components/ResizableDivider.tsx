import { GripVertical } from 'lucide-react';

interface ResizableDividerProps {
  onMouseDown: (e: React.MouseEvent) => void;
  isResizing: boolean;
}

export function ResizableDivider({ onMouseDown, isResizing }: ResizableDividerProps) {
  return (
    <div
      onMouseDown={onMouseDown}
      className={`
        w-1 bg-slate-200 hover:bg-teal-500 cursor-col-resize
        transition-colors duration-200 relative group
        ${isResizing ? 'bg-teal-500' : ''}
      `}
    >
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="w-4 h-4 text-teal-500" />
      </div>
    </div>
  );
}
