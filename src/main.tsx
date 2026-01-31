import { Auth0Provider } from "@auth0/auth0-react";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "react-tooltip/dist/react-tooltip.css";
import App from "./App.tsx";
import "./index.css";
import ProtectedRoute from "./ProtectedRoute.tsx";
import { getEnvironmentConfig } from "./services/envValidation";

// Validate environment configuration early
const config = getEnvironmentConfig();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Auth0Provider
      domain={config.auth0Domain}
      clientId={config.auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <BrowserRouter>
        <ProtectedRoute>
          <App />
        </ProtectedRoute>
      </BrowserRouter>
    </Auth0Provider>
  </React.StrictMode>,
);
