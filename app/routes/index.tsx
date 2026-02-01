import { redirect } from "react-router";
import type { Route } from "./+types/index";

export async function loader({}: Route.LoaderArgs) {
  return redirect("/expert");
}
