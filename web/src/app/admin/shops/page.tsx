import { redirect } from "next/navigation";

/** Approved shops are managed from the Sellers section. */
export default function AdminShopsPage() {
  redirect("/admin/sellers?status=APPROVED");
}
