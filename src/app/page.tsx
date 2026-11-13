import { redirect } from "next/navigation";
import { currentPersonId } from "@/lib/server/auth";
import SignIn from "@/components/SignIn";

export default async function Home() {
  if (await currentPersonId()) redirect("/graph");
  return <SignIn />;
}
