import React from "react";
import ReactDOM from "react-dom/client";
import ErrorBoundary from "./components/ErrorBoundary/ErrorBoundary.jsx";
import Layout from "./Layout.jsx";
import "./main.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <ErrorBoundary>
    <Layout />
  </ErrorBoundary>
);
