import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Shared hover surfaces for Memory UI — soft spring lift + CSS shadow, matching
 * the Study session card pattern (`whileHover` + `useReducedMotion`).
 */

const DASHBOARD_SPRING = {
  type: "spring" as const,
  stiffness: 320,
  damping: 22,
};

const LIST_SPRING = {
  type: "spring" as const,
  stiffness: 360,
  damping: 26,
};

const dashboardClassName =
  "rounded-xl border bg-card shadow-sm transition-[box-shadow] duration-200 hover:z-10 hover:shadow-md";

const listClassName =
  "rounded-lg border bg-card transition-[box-shadow,background-color,border-color] duration-200 hover:z-10 hover:border-foreground/10 hover:bg-muted/40 hover:shadow-sm";

/** Chart / KPI / Today hero cards on the Memory dashboard. */
export function MemoryDashboardCard({
  className,
  ...props
}: HTMLMotionProps<"div">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(dashboardClassName, className)}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -4, scale: 1.02, transition: DASHBOARD_SPRING }
      }
      {...props}
    />
  );
}

/** Library verse rows and pack list rows — lighter touch than dashboard cards. */
export function MemoryListRow({ className, ...props }: HTMLMotionProps<"div">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(listClassName, className)}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -2, scale: 1.005, transition: LIST_SPRING }
      }
      {...props}
    />
  );
}

/** Pack member rows that are themselves list items. */
export function MemoryListItem({ className, ...props }: HTMLMotionProps<"li">) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.li
      className={cn(listClassName, className)}
      whileHover={
        reduceMotion
          ? undefined
          : { y: -2, scale: 1.005, transition: LIST_SPRING }
      }
      {...props}
    />
  );
}
