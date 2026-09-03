import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "@fontsource/geist-sans";
import "@fontsource/geist-mono";
import "./globals.css";
import AppShell from "./AppShell";
import Router from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AppShell>
        <Router />
      </AppShell>
    </BrowserRouter>
  </StrictMode>
);
