import { type RouteConfig, route, layout, index } from "@react-router/dev/routes";

export default [
  // Redirect root to expert mode
  index("routes/index.tsx"),
  
  // Legacy: /canvas redirects to /expert
  route("canvas", "routes/canvas.redirect.tsx"),
  
  // Mode layout wrapping game and expert routes
  layout("mode-layout.tsx", [
    route("game", "routes/game.tsx"),
    route("expert", "routes/expert.tsx"),
  ]),
  
  // API routes
  route("api/chat", "routes/api.chat.ts"),
  route("api/generate-map", "routes/api.generate-map.ts"),
  route("api/explain", "routes/api.explain.ts"),
  route("api/score", "routes/api.score.ts"),
  route("api/analyze-explanation", "routes/api.analyze-explanation.ts"),
  route("api/transcribe", "routes/api.transcribe.ts"),
] satisfies RouteConfig;
