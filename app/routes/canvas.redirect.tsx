import { redirect } from "react-router";

export async function loader() {
  return redirect("/expert");
}

export default function CanvasRedirect() {
  return null;
}
