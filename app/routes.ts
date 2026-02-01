import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("chat", "routes/chat.tsx"),
  route("api/chat", "routes/api.chat.ts"),
  route("api/personalize", "routes/api.personalize.ts"),
  route("tree", "routes/tree.tsx"),
] satisfies RouteConfig;
