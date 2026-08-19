import { useState } from "react";
import { StoreProvider, useStore } from "./lib/store";
import { Shell } from "./components/shell";
import { ToastHost } from "./components/ui";
import { Pipeline } from "./views/Pipeline";
import { Candidates, CandidateDrawer } from "./views/Candidates";
import { Requisitions, Clients } from "./views/Requisitions";
import { Interviews } from "./views/Interviews";
import { Reports } from "./views/Reports";
import { Governance } from "./views/Governance";
import { Integration } from "./views/Integration";
import { Portal } from "./views/Portal";

function Workspace() {
  const { role, view } = useStore();
  const [globalCand, setGlobalCand] = useState<string | null>(null);

  if (role === "CANDIDATE") return <Portal />;

  return (
    <>
      <Shell>
        {view === "pipeline" && <Pipeline openCandidate={(id) => setGlobalCand(id)} />}
        {view === "candidates" && <Candidates />}
        {view === "requisitions" && <Requisitions />}
        {view === "clients" && <Clients />}
        {view === "interviews" && <Interviews />}
        {view === "reports" && <Reports />}
        {view === "governance" && <Governance />}
        {view === "integration" && <Integration />}
      </Shell>
      <CandidateDrawer candidateId={globalCand} onClose={() => setGlobalCand(null)} />
      <ToastHost />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Workspace />
    </StoreProvider>
  );
}
