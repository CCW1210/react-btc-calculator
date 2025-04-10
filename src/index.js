import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import BtcCalculator from "./BtcCalculator";

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <React.StrictMode>
    <BtcCalculator />
  </React.StrictMode>
);
