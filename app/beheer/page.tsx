import type { Metadata } from "next";
import { AdminDashboard } from "./admin-dashboard";

export const metadata: Metadata = { title: "Beheer | Zware Berging", robots: { index: false, follow: false } };
export default function BeheerPage() { return <AdminDashboard />; }
