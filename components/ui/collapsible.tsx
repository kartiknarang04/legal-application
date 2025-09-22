"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"

const Collapsible = CollapsiblePrimitive.Root
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }

// lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "twMerge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}