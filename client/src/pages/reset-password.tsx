import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import gannLogo from "@assets/Gann_Academy__MA__Red_Heifers_2_Logo_1765161174122.png";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const token = new URLSearchParams(window.location.search).get("token");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to reset password");
      }
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 px-4 py-6 sm:py-10">
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
              Reset your password
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pb-6 sm:pb-10 space-y-4 sm:space-y-6 px-3 sm:px-6">
          {!token ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">Invalid reset link</AlertDescription>
            </Alert>
          ) : success ? (
            <div className="text-center space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
                Your password has been reset successfully.
              </div>
              <a
                href="/login"
                className="text-xs sm:text-sm text-muted-foreground hover:text-foreground underline"
              >
                Go to Login
              </a>
            </div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="New password (min. 6 characters)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-slate-200 h-10 sm:h-11 pr-10 text-sm sm:text-base placeholder:text-muted-foreground/50 focus:border-primary focus:ring-primary/20 transition-all shadow-sm"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-white border-slate-200 h-10 sm:h-11 text-sm sm:text-base placeholder:text-muted-foreground/50 focus:border-primary focus:ring-primary/20 transition-all shadow-sm"
                  required
                  minLength={6}
                />
                <Button
                  type="submit"
                  className="w-full h-10 sm:h-11 text-base font-semibold bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Reset Password"
                  )}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
