import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  
  index("routes/home.tsx"),
  route("chat", "routes/chat.tsx"),
  route("api/chat", "routes/api.chat.ts"),
  route("canvas", "routes/canvas.tsx"),
  route("api/generate-map", "routes/api.generate-map.ts"),
  route("api/explain", "routes/api.explain.ts"),
  route("api/score", "routes/api.score.ts"),
  route("api/analyze-explanation", "routes/api.analyze-explanation.ts"),
  route("api/transcribe", "routes/api.transcribe.ts"),
] satisfies RouteConfig;
