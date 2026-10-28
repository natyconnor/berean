import { createRoot } from "react-dom/client";

import { MemoryRestartMenu } from "@/components/memory/memory-restart-menu";
import "@/index.css";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <div className="flex justify-end p-8">
    <MemoryRestartMenu
      name="Psalm 46:10"
      isDrawer={false}
      refreshHref="/memory/practice"
      onRefresh={async () => {}}
      onStartOver={async () => {}}
      onUndo={async () => {}}
      stop={{
        label: "Stop memorizing",
        title: "Stop memorizing Psalm 46:10?",
        description: "Your progress is saved if you start again.",
        onConfirm: async () => {},
      }}
    />
  </div>,
);
