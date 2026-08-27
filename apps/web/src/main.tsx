import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { IosHomeHint } from "./components/IosHomeHint";
import { applyDisplayModeClass, installIosNoPinchZoom } from "./lib/displayMode";
import "./styles/index.css";

applyDisplayModeClass();
installIosNoPinchZoom();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <IosHomeHint />
  </StrictMode>,
);
