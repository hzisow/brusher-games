import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { GameProvider, useGame } from "./lib/gameContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout";
import Login from "@/pages/login";
import Live from "@/pages/live";
import Dashboard from "@/pages/dashboard";
import AdminDashboard from "@/pages/admin";
import SetupName from "@/pages/setup-name";
import { useEffect } from "react";

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { currentUser, needsNameSetup } = useGame();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!currentUser) {
      setLocation("/login");
    } else if (needsNameSetup && location !== '/setup') {
      setLocation("/setup");
    }
  }, [currentUser, needsNameSetup, location, setLocation]);

  if (!currentUser) return null;
  if (needsNameSetup) return null;

  return <Component />;
}

function Router() {
  const { currentUser, needsNameSetup } = useGame();
  const [location, setLocation] = useLocation();

  // Redirect to setup if name needs to be set
  useEffect(() => {
    if (currentUser && needsNameSetup && location !== '/setup' && location !== '/login') {
      setLocation("/setup");
    }
  }, [currentUser, needsNameSetup, location, setLocation]);
  
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/live" component={Live} />
      <Route path="/setup" component={SetupName} />
      <Route path="/">
         <Layout>
            <PrivateRoute component={Dashboard} />
         </Layout>
      </Route>
      <Route path="/admin">
         <Layout>
            <PrivateRoute component={AdminDashboard} />
         </Layout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <GameProvider>
          <Router />
          <Toaster />
        </GameProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
