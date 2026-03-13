import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useState } from "react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated } = useConvexAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      await signIn("google");
    } catch (error) {
      console.error("Sign in failed:", error);
      setIsSigningIn(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/berea-hero.png)" }}
      />
      {/* Dark overlay with gradient */}
      <div className="absolute inset-0 bg-linear-to-b from-black/70 via-black/60 to-black/80" />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center px-6 py-12 text-center">
        {/* App name */}
        <h1
          className="text-7xl tracking-[0.2em] text-white/95 sm:text-8xl"
          style={{ fontFamily: "'Cormorant SC', serif", fontWeight: 300 }}
        >
          BEREA
        </h1>

        {/* Decorative divider */}
        <div className="mt-6 flex items-center gap-4">
          <div className="h-px w-16 bg-white/30" />
          <div className="h-1.5 w-1.5 rotate-45 bg-white/40" />
          <div className="h-px w-16 bg-white/30" />
        </div>

        {/* Verse */}
        <blockquote className="mt-8 max-w-lg">
          <p
            className="text-lg leading-relaxed text-white/85 sm:text-xl"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontStyle: "italic",
              fontWeight: 300,
            }}
          >
            &ldquo;...they received the word with all eagerness, examining the
            Scriptures daily to see if these things were so.&rdquo;
          </p>
          <footer
            className="mt-3 text-sm tracking-[0.15em] text-white/50 uppercase"
            style={{ fontFamily: "'Cormorant SC', serif", fontWeight: 400 }}
          >
            Acts 17:11
          </footer>
        </blockquote>

        {/* Decorative divider */}
        <div className="mt-8 flex items-center gap-4">
          <div className="h-px w-12 bg-white/20" />
          <div className="h-1 w-1 rotate-45 bg-white/30" />
          <div className="h-px w-12 bg-white/20" />
        </div>

        {/* Description */}
        <p
          className="mt-8 max-w-md text-base leading-relaxed text-white/65 sm:text-lg"
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontWeight: 400,
          }}
        >
          In Acts 17, Paul and Silas arrive in the small city of Berea. Luke
          records one remarkable detail about its people: they eagerly received
          God&rsquo;s word and examined the Scriptures daily. Berea invites
          Christians today to continue that heritage&mdash;studying God&rsquo;s
          word with eagerness, care, and devotion.
        </p>

        {/* Sign in */}
        <div className="mt-12 w-full max-w-xs space-y-4">
          <button
            onClick={handleGoogleSignIn}
            disabled={isSigningIn}
            className="flex w-full items-center justify-center gap-3 rounded-md border border-white/20 bg-white/10 px-6 py-3 text-white/90 backdrop-blur-sm transition-all hover:border-white/30 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 600,
              fontSize: "1.05rem",
              letterSpacing: "0.05em",
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {isSigningIn ? "Signing in..." : "Continue with Google"}
          </button>

          <p
            className="text-center text-sm text-white/35"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 400,
            }}
          >
            Your notes are private and synced across devices
          </p>
        </div>
      </div>
    </div>
  );
}
