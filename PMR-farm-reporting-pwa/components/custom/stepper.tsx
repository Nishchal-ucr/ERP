"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Step = {
  id: string;
  title: string;
  description?: string;
};

interface StepperProps {
  steps: Step[];
  currentStep?: number;
  onStepChange?: (step: number) => void;
  className?: string;
}

export function Stepper({
  steps,
  currentStep,
  onStepChange,
  className,
}: StepperProps) {
  const [internalStep, setInternalStep] = React.useState(0);

  const activeStep = currentStep ?? internalStep;

  const setStep = (index: number) => {
    if (onStepChange) {
      onStepChange(index);
    } else {
      setInternalStep(index);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          const isCompleted = index < activeStep;

          return (
            <div
              key={step.id}
              className="flex flex-1 items-center"
              role="button"
              onClick={() => setStep(index)}
            >
              {/* Circle */}
              <div className="flex flex-col items-center text-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-all",
                    "border",
                    isActive &&
                      "bg-primary text-primary-foreground border-primary",
                    isCompleted &&
                      "bg-primary text-primary-foreground border-primary",
                    !isActive &&
                      !isCompleted &&
                      "bg-muted text-muted-foreground",
                  )}
                >
                  {isCompleted ? "✓" : index + 1}
                </div>

                {/* Label */}
                <span
                  className={cn(
                    "mt-2 text-xs leading-tight max-w-[70px]",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.title}
                </span>
              </div>

              {/* Line */}
              {index !== steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-[2px] mx-2",
                    index < activeStep ? "bg-primary" : "bg-muted",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
