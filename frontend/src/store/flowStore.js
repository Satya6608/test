// src/store/useFlowStore.js
import { create } from "zustand";
import { initialNodes } from "../data/nodes";
import { initialEdges } from "../data/edges";

const useFlowStore = create((set) => ({
  nodes: initialNodes,
  edges: initialEdges,
  setNodes: (updater) =>
    set((state) => ({
      nodes: typeof updater === "function" ? updater(state.nodes) : updater,
    })),
  setEdges: (updater) =>
    set((state) => ({
      edges: typeof updater === "function" ? updater(state.edges) : updater,
    })),
}));

export default useFlowStore;
