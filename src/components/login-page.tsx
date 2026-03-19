import { useAuthActions } from "@convex-dev/auth/react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { LoginPageAtmosphere } from "@/components/login-page-atmosphere";
import {
  heroBackgroundLayerStyle,
  heroGradientOverlayLayerStyle,
} from "@/lib/hero-backdrop";

const PARALLAX_DAMPING = 0.04;

function useMouseParallax() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let raf: number;

    const onMouseMove = (e: MouseEvent) => {
      const { left, top, width, height } = node.getBoundingClientRect();
      targetX = ((e.clientX - left) / width - 0.5) * 2;
      targetY = ((e.clientY - top) / height - 0.5) * 2;
    };

    const onMouseLeave = () => {
      targetX = 0;
      targetY = 0;
    };

    const tick = () => {
      currentX += (targetX - currentX) * PARALLAX_DAMPING;
      currentY += (targetY - currentY) * PARALLAX_DAMPING;
      node.style.setProperty("--mx", String(currentX));
      node.style.setProperty("--my", String(currentY));
      raf = requestAnimationFrame(tick);
    };

    node.addEventListener("mousemove", onMouseMove);
    node.addEventListener("mouseleave", onMouseLeave);
    raf = requestAnimationFrame(tick);

    return () => {
      node.removeEventListener("mousemove", onMouseMove);
      node.removeEventListener("mouseleave", onMouseLeave);
      cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}

function slideDelay(ms: number): CSSProperties {
  return { "--slide-delay": `${ms}ms` } as CSSProperties;
}

export function LoginPage({ isLoading = false }: { isLoading?: boolean }) {
  const { signIn } = useAuthActions();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const parallaxRef = useMouseParallax();

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
    <div
      ref={parallaxRef}
      className="relative z-10 flex min-h-screen flex-1 flex-col items-center overflow-hidden px-6 py-12 text-center"
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={heroBackgroundLayerStyle({
          translate: "calc(var(--mx, 0) * 8px) calc(var(--my, 0) * 8px)",
        })}
      />
      <div
        className="absolute inset-0 bg-linear-to-b from-black/60 via-black/50 to-black/90"
        style={heroGradientOverlayLayerStyle({
          translate: "calc(var(--mx, 0) * 8px) calc(var(--my, 0) * 8px)",
        })}
      />

      {!isLoading && <LoginPageAtmosphere />}

      {isLoading ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
          <span
            className="animate-splash-text-in text-2xl tracking-[0.15em] text-white/70"
            style={{ fontFamily: "'Cormorant SC', serif", fontWeight: 300 }}
          >
            Loading&hellip;
          </span>
        </div>
      ) : (
        <>
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
            <div
              className="relative z-10 flex w-full max-w-2xl flex-col items-center px-6 py-12 text-center"
              style={{
                translate:
                  "calc(var(--mx, 0) * -2px) calc(var(--my, 0) * -2px)",
              }}
            >
              <div className="flex w-full max-w-2xl flex-col items-center">
                <h1
                  className="animate-content-slide-in text-7xl tracking-[0.2em] text-white/95 sm:text-8xl"
                  style={{
                    fontFamily: "'Cormorant SC', serif",
                    fontWeight: 300,
                    ...slideDelay(0),
                  }}
                >
                  BEREAN
                </h1>

                <div
                  className="animate-content-slide-in mt-6 flex items-center gap-4"
                  style={slideDelay(80)}
                >
                  <div className="h-px w-16 bg-white/30" />
                  <div className="h-1.5 w-1.5 rotate-45 bg-white/40" />
                  <div className="h-px w-16 bg-white/30" />
                </div>

                <blockquote
                  className="animate-content-slide-in mt-8 max-w-lg"
                  style={slideDelay(160)}
                >
                  <p
                    className="text-lg leading-relaxed text-white/85 sm:text-xl"
                    style={{
                      fontFamily: "'Cormorant Garamond', serif",
                      fontStyle: "italic",
                      fontWeight: 300,
                    }}
                  >
                    &ldquo;...they received the word with all eagerness,
                    examining the Scriptures daily to see if these things were
                    so.&rdquo;
                  </p>
                  <footer
                    className="mt-3 text-sm tracking-[0.15em] text-white/50 uppercase"
                    style={{
                      fontFamily: "'Cormorant SC', serif",
                      fontWeight: 400,
                    }}
                  >
                    Acts 17:11
                  </footer>
                </blockquote>

                <div
                  className="animate-content-slide-in mt-8 flex items-center gap-4"
                  style={slideDelay(240)}
                >
                  <div className="h-px w-12 bg-white/20" />
                  <div className="h-1 w-1 rotate-45 bg-white/30" />
                  <div className="h-px w-12 bg-white/20" />
                </div>

                <p
                  className="animate-content-slide-in mt-8 max-w-md text-base leading-relaxed text-white/65 sm:text-lg"
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontWeight: 400,
                    ...slideDelay(320),
                  }}
                >
                  In Acts 17, the people of Berea received the word with{" "}
                  <span className="italic">eagerness</span>, examining the
                  Scriptures <span className="italic">daily</span>.{" "}
                  <span className="font-bold">Berean</span> invites Christians
                  today to embody that same spirit&mdash;studying God&rsquo;s
                  word with eagerness, care, and devotion.
                </p>

                <div
                  className="animate-content-slide-in mt-12 w-full max-w-xs space-y-4"
                  style={slideDelay(400)}
                >
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
                    {isSigningIn ? "Signing in..." : "Sign in with Google"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p
            className="animate-content-slide-in relative z-10 shrink-0 pb-6 text-center text-sm text-white/35"
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontWeight: 400,
              ...slideDelay(480),
            }}
          >
            <a
              href="https://nathanconnor.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white/70 hover:decoration-white/50"
            >
              Check out my other work
            </a>{" "}
            ·{" "}
            <a
              href="https://github.com/natyconnor/berean"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/50 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white/70 hover:decoration-white/50"
            >
              GitHub
            </a>
          </p>
        </>
      )}
    </div>
  );
}
