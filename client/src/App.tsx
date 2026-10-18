import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ErrorBox, LoadingBlock, ToastProvider } from './components/ui';
import { useAuthStatus, useMeta } from './lib/hooks';
import { LangProvider } from './lib/i18n';
import { SelectionProvider } from './lib/selection';
import LoginPage from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Statistics = lazy(() => import('./pages/Statistics'));
const RollCall = lazy(() => import('./pages/RollCall'));
const DailyPerformance = lazy(() => import('./pages/DailyPerformance'));
const WeeklyControls = lazy(() => import('./pages/WeeklyControls'));
const MonthlyMarks = lazy(() => import('./pages/MonthlyMarks'));
const TermMarks = lazy(() => import('./pages/TermMarks'));
const WeeklyReport = lazy(() => import('./pages/WeeklyReport'));
const MonthlyReport = lazy(() => import('./pages/MonthlyReport'));
const TermReport = lazy(() => import('./pages/TermReport'));
const ReportCards = lazy(() => import('./pages/ReportCards'));
const Pupils = lazy(() => import('./pages/Pupils'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const RemindersPage = lazy(() => import('./pages/Reminders'));
const SettingsPage = lazy(() => import('./pages/Settings'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 0 },
  },
});

function FullScreen({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6">{children}</div>;
}

function AuthGate() {
  const auth = useAuthStatus();
  const qc = useQueryClient();

  useEffect(() => {
    const onUnauthorized = () => qc.invalidateQueries({ queryKey: ['auth'] });
    window.addEventListener('sm:unauthorized', onUnauthorized);
    return () => window.removeEventListener('sm:unauthorized', onUnauthorized);
  }, [qc]);

  if (auth.isPending) return <FullScreen><LoadingBlock /></FullScreen>;
  if (auth.error) return <FullScreen><ErrorBox error={auth.error} onRetry={() => auth.refetch()} /></FullScreen>;
  if (!auth.data.user) return <LoginPage status={auth.data} />;
  return <MetaGate />;
}

function MetaGate() {
  const meta = useMeta();
  if (meta.isPending) return <FullScreen><LoadingBlock /></FullScreen>;
  if (meta.error) return <FullScreen><ErrorBox error={meta.error} onRetry={() => meta.refetch()} /></FullScreen>;
  return (
    <SelectionProvider meta={meta.data}>
      <Layout>
        <Suspense fallback={<LoadingBlock />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/statistics" element={<Statistics />} />
            <Route path="/roll-call" element={<RollCall />} />
            <Route path="/performance" element={<DailyPerformance />} />
            <Route path="/controls" element={<WeeklyControls />} />
            <Route path="/monthly-marks" element={<MonthlyMarks />} />
            <Route path="/term-marks" element={<TermMarks />} />
            <Route path="/reports/weekly" element={<WeeklyReport />} />
            <Route path="/reports/monthly" element={<MonthlyReport />} />
            <Route path="/reports/term" element={<TermReport />} />
            <Route path="/report-cards" element={<ReportCards />} />
            <Route path="/pupils" element={<Pupils />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/reminders" element={<RemindersPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </SelectionProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <ToastProvider>
          <BrowserRouter>
            <AuthGate />
          </BrowserRouter>
        </ToastProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}
