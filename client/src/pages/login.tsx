import { useState, useEffect } from "react";
import { useGame } from "@/lib/gameContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowRight, Loader2, FileText, AlertCircle, Eye, EyeOff } from "lucide-react";
import FeedbackForm from "@/components/FeedbackForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import gannLogo from "@assets/Gann_Academy__MA__Red_Heifers_2_Logo_1765161174122.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignupMode, setIsSignupMode] = useState(true);
  const { login, signup, isLoading, currentUser } = useGame();
  const [, setLocation] = useLocation();

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (currentUser) {
      setLocation("/");
    }
  }, [currentUser, setLocation]);
  
  // Check for error in URL params
  const urlParams = new URLSearchParams(window.location.search);
  const error = urlParams.get('error');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    const success = isSignupMode 
      ? await signup(email, password)
      : await login(email, password);
      
    if (success) {
      setLocation("/");
    }
  };

  const handleMicrosoftLogin = () => {
    window.location.href = '/api/auth/microsoft';
  };

  const getErrorMessage = (errorCode: string | null) => {
    switch (errorCode) {
      case 'invalid_email':
        return 'Only @gannacademy.org email addresses are allowed. Please sign in with your school account.';
      case 'auth_failed':
      case 'callback_failed':
        return 'Authentication failed. Please try again.';
      case 'no_code':
      case 'no_account':
        return 'Could not complete sign-in. Please try again.';
      case 'microsoft_not_configured':
        return 'Microsoft sign-in is not configured yet. Please use email login for now.';
      default:
        return null;
    }
  };

  const errorMessage = getErrorMessage(error);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 px-4 py-6 sm:py-10">
      <div className="w-full max-w-md mb-4 sm:absolute sm:top-6 sm:right-6 sm:w-auto sm:mb-0 z-20">
         <Button variant="default" size="default" asChild className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base font-semibold">
            <a href="https://docs.google.com/document/d/14u_YquL67kXpkz7yrw1xmVZAgIYJ3H6z9P9mlUXzeHA/edit?tab=t.0#heading=h.jcl1clyjefps" target="_blank" rel="noopener noreferrer">
              <FileText className="h-4 w-4 sm:h-5 sm:w-5" /> View the Rulebook
            </a>
         </Button>
      </div>

      <Card className="w-full max-w-md relative z-10 border-border/50 bg-white/80 backdrop-blur-xl shadow-xl">
        <CardHeader className="text-center space-y-3 sm:space-y-4 pt-6 sm:pt-10">
          <div className="mx-auto flex flex-col items-center justify-center">
            <img src={gannLogo} alt="Gann Academy" className="w-20 h-20 sm:w-28 sm:h-28 object-contain drop-shadow-sm" />
          </div>
          <div>
            <CardTitle className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-slate-900">
              BRUSHER GAMES
            </CardTitle>
            <CardDescription className="mt-2">
              {isSignupMode ? "Create your account to join the game" : "Sign in to continue playing"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-6 sm:pb-10 space-y-4 sm:space-y-6 px-4 sm:px-6">
          {errorMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
            <strong>Recommended:</strong> Use email sign-in for the best experience! It's faster and more reliable.
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            <Input
              type="email"
              placeholder="student@gannacademy.org"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white border-slate-200 h-11 text-sm sm:text-base placeholder:text-muted-foreground/50 focus:border-primary focus:ring-primary/20 transition-all shadow-sm"
              data-testid="input-email"
              required
            />
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password (min. 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white border-slate-200 h-11 pr-10 text-sm sm:text-base placeholder:text-muted-foreground/50 focus:border-primary focus:ring-primary/20 transition-all shadow-sm"
                data-testid="input-password"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                data-testid="button-toggle-password"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button 
              type="submit" 
              className="w-full h-11 text-base font-semibold bg-primary hover:bg-primary/90"
              disabled={isLoading}
              data-testid="button-email-auth"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {isSignupMode ? "Create Account" : "Sign In"} <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center">
            <button
              onClick={() => setIsSignupMode(!isSignupMode)}
              className="text-sm text-muted-foreground hover:text-foreground underline"
              data-testid="button-toggle-mode"
            >
              {isSignupMode ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">Or use Microsoft</span>
            </div>
          </div>

          <Button 
            onClick={handleMicrosoftLogin}
            variant="outline"
            className="w-full h-11 text-base font-medium"
            disabled={isLoading}
            data-testid="button-microsoft-login"
          >
            <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-2">
              <rect width="10" height="10" fill="#F25022"/>
              <rect x="11" width="10" height="10" fill="#7FBA00"/>
              <rect y="11" width="10" height="10" fill="#00A4EF"/>
              <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
            </svg>
            Sign in with Microsoft
          </Button>

          <div className="text-center text-xs text-muted-foreground">
            Only @gannacademy.org accounts are allowed
          </div>
        </CardContent>
      </Card>

      <div className="w-full max-w-md mt-6 sm:mt-8">
        <FeedbackForm />
      </div>
    </div>
  );
}
