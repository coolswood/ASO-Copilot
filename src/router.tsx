import { Route, Routes } from "react-router";
import DashboardPage from "@/pages/DashboardPage";
import SearchPage from "@/pages/SearchPage";
import NewAppPage from "@/pages/NewAppPage";
import AppDetailPage from "@/pages/AppDetailPage";

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/search" element={<SearchPage />} />
      <Route path="/apps/new" element={<NewAppPage />} />
      <Route path="/apps/:id" element={<AppDetailPage />} />
    </Routes>
  );
}
