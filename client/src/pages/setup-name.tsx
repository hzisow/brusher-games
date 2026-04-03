import { useState, useEffect, useRef } from "react";
import { useGame } from "@/lib/gameContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, UserCheck, ArrowLeft } from "lucide-react";
import gannLogo from "@assets/Gann_Academy__MA__Red_Heifers_2_Logo_1765161174122.png";

export default function SetupName() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameSubmitted, setNameSubmitted] = useState(false);
  const { currentUser, updateName, logout } = useGame();
  const [, setLocation] = useLocation();
  const redirectAttempted = useRef(false);

  // Redirect to dashboard after name is successfully updated
  useEffect(() => {
    if (nameSubmitted && currentUser && currentUser.name.includes(" ") && !redirectAttempted.current) {
      redirectAttempted.current = true;
      // Force redirect using window.location for reliability
      window.location.href = "/";
    }
  }, [nameSubmitted, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setIsSubmitting(true);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const success = await updateName(fullName);
    
    if (success) {
      setNameSubmitted(true);
      // Also try immediate redirect
      setTimeout(() => {
        window.location.href = "/";
      }, 100);
    }
    setIsSubmitting(false);
  };

  const handleGoBack = () => {
    logout();
    setLocation("/login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-full max-w-md mx-4 shadow-xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <img src={gannLogo} alt="Gann Academy" className="w-20 h-20 object-contain mx-auto" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Welcome to Brusher Games!</CardTitle>
            <CardDescription className="mt-2">
              Please enter your name so other players can identify you.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">First Name</label>
              <Input
                type="text"
                placeholder="John"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-12"
                data-testid="input-first-name"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Last Name</label>
              <Input
                type="text"
                placeholder="Doe"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-12"
                data-testid="input-last-name"
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={isSubmitting || !firstName.trim() || !lastName.trim()}
              data-testid="button-save-name"
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <UserCheck className="h-5 w-5 mr-2" />
                  Continue to Game
                </>
              )}
            </Button>
          </form>

          <div className="space-y-3 mt-4">
            <p className="text-xs text-muted-foreground text-center">
              Signed in as {currentUser?.email}
            </p>
            <Button
              variant="ghost"
              className="w-full gap-2"
              onClick={handleGoBack}
              data-testid="button-back-to-signin"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back to sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
