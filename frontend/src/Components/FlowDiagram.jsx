import React, { useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Handle,
  Position,
  applyEdgeChanges,
  applyNodeChanges,
} from "reactflow";
import * as XLSX from "xlsx";
import "reactflow/dist/style.css";
import { Card } from "./ui/Card";
import HomePage from "./ui/HomePage";
import useFlowStore from "../store/FlowStore";

const LOCAL_STORAGE_KEY = "flow-diagram-data";

const PageNode = ({ data }) => {
  if (data.label === "HomePage")
    return (
      <>
        <HomePage data={data} />
        <Handle
          type="source"
          position={Position.Bottom}
          style={{ background: "#555" }}
        />
      </>
    );

  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: "#555" }}
      />
      <Card className="w-50 p-2 border border-blue-600 h-[100px] flex items-center justify-center flex-col">
        <div className="font-bold text-center text-blue-600">{data.label}</div>
        {data.sections.map((section, index) => (
          <div key={index} className="my-1 bg-gray-100 rounded p-1 cursor-move">
            {section}
          </div>
        ))}
      </Card>
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: "#555" }}
      />
    </>
  );
};

const nodeTypes = {
  pageNode: PageNode,
};

export default function FlowDiagram() {
  const { nodes, edges, setNodes, setEdges } = useFlowStore();

  const onNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes) => {
      setEdges((eds) => applyEdgeChanges(changes, eds));
    },
    [setEdges]
  );

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const saveToLocalStorage = () => {
    const data = { nodes, edges };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    alert("Diagram saved to localStorage!");
  };

  const loadFromLocalStorage = () => {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const { nodes: savedNodes, edges: savedEdges } = JSON.parse(saved);
      setNodes(savedNodes || []);
      setEdges(savedEdges || []);
    } else {
      alert("No data found in localStorage.");
    }
  };

  const exportToExcel = () => {
    const nodeData = nodes.map((n) => ({
      id: n.id,
      label: n.data.label,
      x: n.position.x,
      y: n.position.y,
      sections: (n.data.sections || []).join(", "),
    }));
    const edgeData = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));

    const nodeSheet = XLSX.utils.json_to_sheet(nodeData);
    const edgeSheet = XLSX.utils.json_to_sheet(edgeData);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, nodeSheet, "Nodes");
    XLSX.utils.book_append_sheet(workbook, edgeSheet, "Edges");

    XLSX.writeFile(workbook, "flow-diagram.xlsx");
  };

  return (
    <div style={{ height: "90vh", width: "100%" }}>
      <div className="flex gap-4 p-2">
        <button
          onClick={saveToLocalStorage}
          className="border p-2 rounded bg-blue-500 text-white"
        >
          💾 Save
        </button>
        <button
          onClick={loadFromLocalStorage}
          className="border p-2 rounded bg-green-500 text-white"
        >
          📥 Load
        </button>
        <button
          onClick={exportToExcel}
          className="border p-2 rounded bg-yellow-500 text-black"
        >
          📤 Export Excel
        </button>
      </div>
      {nodes.length > 0 && edges.length > 0 && (
        <>
          {console.log(nodes, edges)}
          <ReactFlow
            nodes={Array.isArray(nodes) ? nodes : []}
            edges={Array.isArray(edges) ? edges : []}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
          >
            <MiniMap />
            <Controls />
            <Background gap={12} size={1} />
          </ReactFlow>
        </>
      )}
    </div>
  );
}
