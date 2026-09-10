import { Component, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import { App } from "./App";
import { initialize } from "./db";
import { config } from "./config";
import "./styles.css";
document.title = config.name;
// GitHub Pages serves static files without SPA rewrites. Hash routes keep
// direct links and refreshes inside the repository's published directory.
const Router = import.meta.env.MODE === 'github-pages' ? HashRouter : BrowserRouter;
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info);
  }
  render() {
    return this.state.failed ? (
      <main className="empty">
        <h1>Չհաջողվեց բացել հավելվածը</h1>
        <p>
          Ստուգեք՝ արդյոք դիտարկիչը թույլ է տալիս տեղական տվյալների պահպանումը։
        </p>
        <button onClick={() => location.reload()}>Փորձել կրկին</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const root = createRoot(document.getElementById("root")!);
root.render(
  <main className="loading" role="status">
    Բեռնվում է…
  </main>,
);
void initialize()
  .then(() =>
    root.render(
      <ErrorBoundary>
        <Router>
          <App />
        </Router>
      </ErrorBoundary>,
    ),
  )
  .catch(() =>
    root.render(
      <main className="empty">
        <h1>Տվյալների պահոցը հասանելի չէ</h1>
        <p>
          Միացրեք տեղական պահպանումը դիտարկիչի կարգավորումներում և փորձեք կրկին։
        </p>
        <button onClick={() => location.reload()}>Կրկին փորձել</button>
      </main>,
    ),
  );
