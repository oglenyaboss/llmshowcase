import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility to merge Tailwind CSS classes with clsx and tailwind-merge
 * Handles conditional classes, arrays, and objects while properly deduplicating
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
