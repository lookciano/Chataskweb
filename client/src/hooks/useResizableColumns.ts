import { useState } from 'react';

export interface ColumnWidths {
  rooms: number;
  chat: number;
  tasks: number;
}

export function useResizableColumns() {
  const [isResizing, setIsResizing] = useState<'rooms' | 'chat' | null>(null);

  // Proporções fixas: rooms 20%, chat 60%, tasks 20%
  const widths = {
    rooms: 20,  // percentual
    chat: 60,   // percentual
    tasks: 20,  // percentual
  };

  const handleMouseDown = (column: 'rooms' | 'chat') => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(column);
  };

  const resetWidths = () => {
    // Noop - widths são fixas
  };

  return {
    widths,
    isResizing,
    handleMouseDown,
    resetWidths,
  };
}
