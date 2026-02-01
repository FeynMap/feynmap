import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("expert", "routes/expert.tsx"),
  route("api/chat", "routes/api.chat.ts"),
] satisfies RouteConfig;
