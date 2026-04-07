import { Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout";
import { AdminPage } from "../features/guide/AdminPage";
import { DashboardPage } from "../features/guide/DashboardPage";
import { GuidePage } from "../features/guide/GuidePage";
import { ResultPage } from "../features/guide/ResultPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route element={<DashboardPage />} path="/" />
        <Route element={<GuidePage />} path="/guide" />
        <Route element={<ResultPage />} path="/result" />
        <Route element={<AdminPage />} path="/admin" />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </Layout>
  );
}
