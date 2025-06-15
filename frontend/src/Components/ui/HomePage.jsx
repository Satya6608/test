import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";

import React, { useEffect, useState } from "react";
import SortableItem from "./SortableItem";
import useFlowStore from "../../store/FlowStore";

const HomePage = ({ data }) => {
  const [homeSections, setHomeSections] = useState(data.sections || []);

  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = homeSections.indexOf(active.id);
      const newIndex = homeSections.indexOf(over.id);

      const updatedSections = arrayMove(homeSections, oldIndex, newIndex);
      setHomeSections(updatedSections);

      // Update Zustand store
      useFlowStore.setState((state) => ({
        nodes: state.nodes.map((node) =>
          node.data.label === "HomePage"
            ? {
                ...node,
                data: {
                  ...node.data,
                  sections: updatedSections,
                },
              }
            : node
        ),
      }));
    }
  };
  useEffect(() => {
    setHomeSections(data.sections || []);
  }, [data]);

  return (
    <div className="p-2 bg-white rounded shadow border border-blue-600">
      <h2 className="text-lg font-semibold text-blue-600 mb-2 text-center">
        Home Page Sections
      </h2>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={homeSections}
          strategy={verticalListSortingStrategy}
        >
          {homeSections.map((section) => (
            <SortableItem key={section} id={section} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default HomePage;
