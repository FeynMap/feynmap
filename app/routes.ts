import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  
  index("routes/home.tsx"),
  route("chat", "routes/chat.tsx"),
  route("api/chat", "routes/api.chat.ts"),
  route("canvas", "routes/canvas.tsx"),
  route("api/generate-map", "routes/api.generate-map.ts"),
] satisfies RouteConfig;
