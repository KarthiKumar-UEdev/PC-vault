import { create } from 'zustand';

interface ViewerState {
  /** Part currently highlighted in the 3D viewer's side panel. */
  selectedPartId: string | null;
  hoveredPartId: string | null;
  autoRotate: boolean;
  select: (id: string | null) => void;
  hover: (id: string | null) => void;
  setAutoRotate: (on: boolean) => void;
}

export const useViewerStore = create<ViewerState>((set) => ({
  selectedPartId: null,
  hoveredPartId: null,
  autoRotate: true,
  select: (id) => set({ selectedPartId: id, autoRotate: id === null }),
  hover: (id) => set({ hoveredPartId: id }),
  setAutoRotate: (on) => set({ autoRotate: on }),
}));
